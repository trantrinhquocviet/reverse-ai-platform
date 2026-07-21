from __future__ import annotations

import asyncio
import json
from typing import Any

import structlog

from workers.base_worker import BaseWorker
from workers.inference_worker.processor import run_inference

logger = structlog.get_logger(__name__)

INFERENCE_QUEUE = "queue:inference"


class InferenceWorker(BaseWorker):
    """Worker that runs model inference for quality inspection jobs."""

    def __init__(self) -> None:
        super().__init__(queue_name=INFERENCE_QUEUE)

    async def process(self, job: dict[str, Any]) -> None:
        inspection_id: str = job["inspection_id"]
        video_id: str = job["video_id"]
        model_id: str | None = job.get("model_id")

        logger.info(
            "Processing inference job",
            inspection_id=inspection_id,
            video_id=video_id,
            model_id=model_id,
        )

        result = await run_inference(
            inspection_id=inspection_id,
            video_id=video_id,
            model_id=model_id,
        )

        # TODO: Persist inspection results to DB:
        #   - inspection_results.defect_count = result["defect_count"]
        #   - inspection_results.confidence_avg = result["confidence_avg"]
        #   - inspection_results.frames_processed = result["frames_processed"]
        #   - inspection_results.result_payload = json.dumps(result["detections"])
        #   - inspection_results.status = "completed"

        logger.info(
            "Inference job complete",
            inspection_id=inspection_id,
            defect_count=result["defect_count"],
            frames_processed=result["frames_processed"],
        )


async def main() -> None:
    worker = InferenceWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
