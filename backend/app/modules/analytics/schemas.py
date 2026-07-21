from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_videos: int
    total_frames: int
    total_annotations: int
    total_datasets: int
    total_training_jobs: int
    total_inspections: int
    defect_rate_percent: float
    annotation_accuracy_percent: float


class VideoStatusBreakdown(BaseModel):
    status: str
    count: int


class DefectTrendPoint(BaseModel):
    date: str  # ISO date string
    defect_count: int
    inspection_count: int


class AnalyticsSummary(BaseModel):
    dashboard: DashboardStats
    video_status_breakdown: List[VideoStatusBreakdown]
    defect_trend: List[DefectTrendPoint]
    top_labels: List[Dict[str, Any]]
