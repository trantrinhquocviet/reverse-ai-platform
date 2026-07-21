from __future__ import annotations

import asyncio
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

import structlog

from app.core.logging import configure_logging
from app.config import settings

configure_logging(debug=settings.DEBUG)

logger = structlog.get_logger(__name__)

HEARTBEAT_INTERVAL = 10  # seconds
DEQUEUE_TIMEOUT = 5       # seconds blocking pop timeout


class BaseWorker(ABC):
    """Abstract base class for all background queue workers.

    Subclasses must implement `process(job)`.  The run loop:
    1. Blocks on dequeue with timeout
    2. Calls process(job)
    3. On exception: calls handle_error(job, exc)
    4. Updates heartbeat every HEARTBEAT_INTERVAL seconds
    """

    def __init__(self, queue_name: str, redis_url: str | None = None) -> None:
        self.queue_name = queue_name
        self.redis_url = redis_url or settings.REDIS_URL
        self.worker_id = f"{self.__class__.__name__}-{uuid.uuid4().hex[:8]}"
        self._running = False
        self._jobs_processed = 0
        self._jobs_failed = 0
        self._started_at: datetime | None = None
        self._log = logger.bind(worker_id=self.worker_id, queue=queue_name)

    async def run(self) -> None:
        """Start the infinite worker loop."""
        from app.core.redis import dequeue_job, get_redis_pool

        self._running = True
        self._started_at = datetime.now(timezone.utc)
        self._log.info("Worker started")

        heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        try:
            while self._running:
                try:
                    job = await dequeue_job(self.queue_name, timeout=DEQUEUE_TIMEOUT)
                    if job is None:
                        continue  # timeout, loop again

                    job_id = job.get("job_id", "unknown")
                    self._log.info("Dequeued job", job_id=job_id)

                    try:
                        await self.process(job)
                        self._jobs_processed += 1
                        self._log.info("Job completed", job_id=job_id)
                    except Exception as exc:
                        self._jobs_failed += 1
                        await self.handle_error(job, exc)

                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    self._log.exception("Unexpected error in run loop", exc_info=exc)
                    await asyncio.sleep(1)
        finally:
            heartbeat_task.cancel()
            self._running = False
            self._log.info(
                "Worker stopped",
                jobs_processed=self._jobs_processed,
                jobs_failed=self._jobs_failed,
            )

    def stop(self) -> None:
        """Signal the run loop to exit after the current job."""
        self._running = False

    @abstractmethod
    async def process(self, job: dict[str, Any]) -> None:
        """Process a single dequeued job. Must be implemented by subclasses."""
        ...

    async def handle_error(self, job: dict[str, Any], error: Exception) -> None:
        """Log the error and optionally push to a dead-letter queue."""
        job_id = job.get("job_id", "unknown")
        self._log.error(
            "Job processing failed",
            job_id=job_id,
            error=str(error),
            error_type=type(error).__name__,
            exc_info=error,
        )
        # TODO: Push to dead-letter queue in Redis: queue:{queue_name}:failed
        # TODO: Retry logic with exponential back-off

    async def heartbeat(self) -> None:
        """Update this worker's liveness record in Redis."""
        from app.core.redis import set_worker_heartbeat

        status: dict[str, Any] = {
            "worker_id": self.worker_id,
            "queue": self.queue_name,
            "jobs_processed": self._jobs_processed,
            "jobs_failed": self._jobs_failed,
            "running": self._running,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "last_heartbeat": datetime.now(timezone.utc).isoformat(),
        }
        await set_worker_heartbeat(self.worker_id, status, ttl=HEARTBEAT_INTERVAL * 3)

    async def _heartbeat_loop(self) -> None:
        while self._running:
            try:
                await self.heartbeat()
            except Exception as exc:
                self._log.warning("Heartbeat failed", error=str(exc))
            await asyncio.sleep(HEARTBEAT_INTERVAL)
