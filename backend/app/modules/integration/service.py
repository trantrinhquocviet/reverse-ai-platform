from __future__ import annotations

from typing import Any, Dict, List

import structlog

logger = structlog.get_logger(__name__)


class IntegrationService:
    """Stub integration service for connecting to external systems.

    TODO: Implement connections to:
    - Supabase Storage (file management)
    - External label-management platforms (CVAT, Label Studio)
    - MLflow / W&B experiment tracking
    - Slack / email notifications
    - Webhook delivery
    """

    async def list_integrations(self) -> List[Dict[str, Any]]:
        logger.info("Listing integrations (placeholder)")
        return [
            {"id": "supabase-storage", "type": "storage", "status": "configured"},
            {"id": "mlflow", "type": "experiment-tracking", "status": "not_configured"},
            {"id": "label-studio", "type": "annotation", "status": "not_configured"},
        ]

    async def get_integration(self, integration_id: str) -> Dict[str, Any]:
        # TODO: Load from DB / secrets manager
        logger.info("Getting integration", integration_id=integration_id)
        return {"id": integration_id, "status": "not_configured", "config": {}}

    async def test_integration(self, integration_id: str) -> Dict[str, Any]:
        # TODO: Ping external service and return health
        logger.info("Testing integration", integration_id=integration_id)
        return {"id": integration_id, "reachable": False, "message": "Test not implemented yet."}
