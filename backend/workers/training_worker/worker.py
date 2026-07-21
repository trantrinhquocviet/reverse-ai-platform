from __future__ import annotations

import asyncio
from typing import Any

import structlog

from workers.base_worker import BaseWorker
from workers.training_worker.processor import run_training_epochs

logger = structlog.get_logger(__name__)

TRAINING_QUEUE = "queue:training"


class TrainingWorker(BaseWorker):
    """Worker that runs AI model training jobs."""

    def __init__(self) -> None:
        super().__init__(queue_name=TRAINING_QUEUE)

    async def process(self, job: dict[str, Any]) -> None:
        job_id: str = job["job_id"]
        dataset_id: str = job["dataset_id"]
        epochs: int = int(job.get("epochs", 100))

        logger.info("Starting training job", job_id=job_id, dataset_id=dataset_id)

        best_map50 = 0.0
        best_map95 = 0.0

        async for metrics in run_training_epochs(
            job_id=job_id, dataset_id=dataset_id, epochs=epochs
        ):
            best_map50 = max(best_map50, metrics["map50"])
            best_map95 = max(best_map95, metrics["map95"])

            # TODO: Update training_jobs record in DB with current_epoch + metrics
            # TODO: Publish progress event via Redis pub/sub for real-time UI updates

        logger.info(
            "Training job complete",
            job_id=job_id,
            best_map50=best_map50,
            best_map95=best_map95,
        )

        # TODO: Update training_jobs.status = "completed", .best_map50, .best_map95, .completed_at
        # TODO: Save model artifact path to training_jobs.output_path


async def main() -> None:
    worker = TrainingWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
