from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import CurrentUser, get_current_user
from app.modules.analytics.schemas import AnalyticsSummary, DashboardStats
from app.modules.analytics.service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=DashboardStats, summary="Get dashboard KPI stats")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> DashboardStats:
    service = AnalyticsService(db)
    return await service.get_dashboard_stats()


@router.get("/summary", response_model=AnalyticsSummary, summary="Get full analytics summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> AnalyticsSummary:
    service = AnalyticsService(db)
    return await service.get_summary()
