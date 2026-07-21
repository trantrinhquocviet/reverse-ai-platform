.PHONY: dev dev-build test lint format migrate shell-backend shell-db build push clean help

# ── Configuration ─────────────────────────────────────────────────────────────
COMPOSE        := docker compose
COMPOSE_DEV    := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
BACKEND_DIR    := backend
REGISTRY       := ghcr.io
IMAGE_PREFIX   := your-org/reverse-ai-studio

# ── Development ───────────────────────────────────────────────────────────────

## Start all services in development mode (with hot reload)
dev:
	$(COMPOSE_DEV) up

## Start all services in development mode (rebuild images first)
dev-build:
	$(COMPOSE_DEV) up --build

## Start services in production mode (detached)
up:
	$(COMPOSE) up -d

## Stop all running services
down:
	$(COMPOSE) down

## Show logs for all services (follow)
logs:
	$(COMPOSE) logs -f

## Show logs for backend only
logs-backend:
	$(COMPOSE) logs -f backend

# ── Testing ───────────────────────────────────────────────────────────────────

## Run the full test suite
test:
	cd $(BACKEND_DIR) && pytest tests/ -v --tb=short

## Run tests with coverage report
test-cov:
	cd $(BACKEND_DIR) && pytest tests/ -v --tb=short --cov=app --cov=workers --cov-report=term-missing

# ── Linting & Formatting ──────────────────────────────────────────────────────

## Lint with ruff and mypy
lint:
	cd $(BACKEND_DIR) && ruff check . && mypy app/ workers/ --ignore-missing-imports

## Auto-fix lint issues with ruff
format:
	cd $(BACKEND_DIR) && ruff check . --fix && ruff format .

# ── Database Migrations ───────────────────────────────────────────────────────

## Apply all pending Alembic migrations
migrate:
	cd $(BACKEND_DIR) && alembic upgrade head

## Generate a new migration (usage: make migration MSG="add user table")
migration:
	cd $(BACKEND_DIR) && alembic revision --autogenerate -m "$(MSG)"

## Roll back the last migration
migrate-down:
	cd $(BACKEND_DIR) && alembic downgrade -1

## Show migration history
migrate-history:
	cd $(BACKEND_DIR) && alembic history

# ── Shells ────────────────────────────────────────────────────────────────────

## Open a shell inside the running backend container
shell-backend:
	$(COMPOSE) exec backend bash

## Open a psql shell in the postgres container
shell-db:
	$(COMPOSE) exec postgres psql -U postgres -d reverse_ai

## Open a redis-cli shell
shell-redis:
	$(COMPOSE) exec redis redis-cli

# ── Build & Push ──────────────────────────────────────────────────────────────

## Build all Docker images
build:
	$(COMPOSE) build

## Build and push images to registry
push:
	$(COMPOSE) build
	docker push $(REGISTRY)/$(IMAGE_PREFIX)-backend:latest
	docker push $(REGISTRY)/$(IMAGE_PREFIX)-frontend:latest

# ── Cleanup ───────────────────────────────────────────────────────────────────

## Stop containers and remove volumes (WARNING: destroys all data)
clean:
	$(COMPOSE) down -v --remove-orphans

## Remove all unused Docker resources
prune:
	docker system prune -f

# ── Help ──────────────────────────────────────────────────────────────────────

## Show this help message
help:
	@echo ""
	@echo "Reverse AI Studio — Makefile targets"
	@echo "======================================"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /' | column -t -s ':'
	@echo ""
