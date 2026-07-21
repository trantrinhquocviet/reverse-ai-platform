from __future__ import annotations

import asyncio
import random
from collections.abc import AsyncGenerator
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


async def run_training_epochs(
    job_id: str,
    dataset_id: str,
    epochs: int = 100,
) -> AsyncGenerator[dict[str, Any], None]:
    """Simulate a training loop, yielding metrics after each epoch.

    In production this would:
    - Load annotations from DB and prepare a YOLO-format dataset
    - Spawn a training subprocess (ultralytics train …)
    - Stream stdout metrics back and persist to DB
    - Save best model weights to Supabase Storage

    TODO: Replace with real training integration
    """
    logger.info("Training started", job_id=job_id, dataset_id=dataset_id, epochs=epochs)

    map50 = 0.0
    map95 = 0.0

    for epoch in range(1, epochs + 1):
        await asyncio.sleep(0.05)  # simulate epoch compute time

        # Slowly improve metrics with noise
        map50 = min(0.99, map50 + random.uniform(0.005, 0.02))
        map95 = min(0.99, map95 + random.uniform(0.002, 0.012))
        loss = max(0.01, 1.0 - map50 + random.uniform(-0.02, 0.02))

        metrics: dict[str, Any] = {
            "epoch": epoch,
            "total_epochs": epochs,
            "map50": round(map50, 4),
            "map95": round(map95, 4),
            "loss": round(loss, 4),
        }

        if epoch % 10 == 0 or epoch == epochs:
            logger.info("Training epoch", job_id=job_id, **metrics)

        yield metrics

    logger.info("Training complete", job_id=job_id, final_map50=map50, final_map95=map95)
