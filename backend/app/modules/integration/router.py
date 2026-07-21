from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from app.dependencies import CurrentUser, get_current_user
from app.modules.integration.service import IntegrationService

router = APIRouter(prefix="/integrations", tags=["Integrations"])


@router.get("", response_model=List[Dict[str, Any]], summary="List all configured integrations")
async def list_integrations(
    current_user: CurrentUser = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    service = IntegrationService()
    return await service.list_integrations()


@router.get(
    "/{integration_id}",
    response_model=Dict[str, Any],
    summary="Get integration details",
)
async def get_integration(
    integration_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    service = IntegrationService()
    return await service.get_integration(integration_id)


@router.post(
    "/{integration_id}/test",
    response_model=Dict[str, Any],
    summary="Test integration connectivity",
)
async def test_integration(
    integration_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    service = IntegrationService()
    return await service.test_integration(integration_id)
