from __future__ import annotations

import asyncio
import random
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


async def extract_frames(video_id: str, file_path: str) -> dict[str, Any]:
    """Placeholder frame extraction logic.

    In production this would:
    - Download the video from Supabase Storage
    - Use ffmpeg (via asyncio subprocess) to extract frames at N fps
    - Upload frames back to storage
    - Return frame metadata list

    TODO: Implement real ffmpeg-based extraction
    """
    logger.info("Extracting frames", video_id=video_id, file_path=file_path)

    # Simulate extraction duration
    simulated_frame_count = random.randint(50, 500)
    await asyncio.sleep(random.uniform(0.5, 2.0))

    frames = [
        {
            "frame_index": i,
            "timestamp_ms": i * 33,  # ~30 fps
            "path": f"frames/{video_id}/frame_{i:06d}.jpg",
            "width": 1920,
            "height": 1080,
        }
        for i in range(simulated_frame_count)
    ]

    logger.info("Frame extraction complete", video_id=video_id, frame_count=len(frames))
    return {
        "video_id": video_id,
        "frame_count": len(frames),
        "frames": frames,
    }
