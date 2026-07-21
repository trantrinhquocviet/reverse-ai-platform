from __future__ import annotations

import asyncio
from typing import Any

import structlog

from workers.base_worker import BaseWorker
from workers.frame_worker.processor import extract_frames

logger = structlog.get_logger(__name__)

FRAME_QUEUE = "queue:frame_extraction"


class FrameExtractionWorker(BaseWorker):
    """Worker that dequeues frame-extraction jobs for uploaded videos."""

    def __init__(self) -> None:
        super().__init__(queue_name=FRAME_QUEUE)

    async def process(self, job: dict[str, Any]) -> None:
        video_id: str = job["video_id"]
        file_path: str = job["file_path"]

        logger.info("Processing frame extraction job", video_id=video_id)

        result = await extract_frames(video_id=video_id, file_path=file_path)

        # TODO: Persist frame records to DB
        # TODO: Update video.frame_count and video.status = "ready"
        # TODO: Enqueue OCR jobs for each extracted frame

        logger.info(
            "Frame extraction job finished",
            video_id=video_id,
            frame_count=result["frame_count"],
        )


async def main() -> None:
    worker = FrameExtractionWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
