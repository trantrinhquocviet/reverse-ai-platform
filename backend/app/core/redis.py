from __future__ import annotations

import json
from typing import Any

import aioredis
from aioredis import Redis

from app.config import settings

_redis_pool: Redis | None = None


async def get_redis_pool() -> Redis:
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = await aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return _redis_pool


async def close_redis_pool() -> None:
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.close()
        _redis_pool = None


async def get_redis() -> Redis:
    """Dependency that provides a Redis client."""
    return await get_redis_pool()


async def enqueue_job(queue_name: str, payload: dict[str, Any]) -> str:
    """Push a job payload onto the named Redis list queue.

    Returns the job id embedded in the payload (or generated).
    """
    import uuid

    job_id: str = payload.get("job_id", str(uuid.uuid4()))
    payload["job_id"] = job_id

    redis = await get_redis_pool()
    await redis.lpush(queue_name, json.dumps(payload))
    return job_id


async def dequeue_job(queue_name: str, timeout: int = 5) -> dict[str, Any] | None:
    """Blocking pop from the named Redis list queue.

    Returns the deserialized payload or None on timeout.
    """
    redis = await get_redis_pool()
    result = await redis.brpop(queue_name, timeout=timeout)
    if result is None:
        return None
    _, raw = result
    return json.loads(raw)  # type: ignore[no-any-return]


async def set_worker_heartbeat(worker_id: str, status: dict[str, Any], ttl: int = 30) -> None:
    """Update a worker's heartbeat in Redis with a TTL."""
    redis = await get_redis_pool()
    key = f"worker:heartbeat:{worker_id}"
    await redis.set(key, json.dumps(status), ex=ttl)


async def get_worker_statuses() -> list[dict[str, Any]]:
    """Retrieve all active worker heartbeats."""
    redis = await get_redis_pool()
    keys = await redis.keys("worker:heartbeat:*")
    if not keys:
        return []
    values = await redis.mget(*keys)
    return [json.loads(v) for v in values if v is not None]
