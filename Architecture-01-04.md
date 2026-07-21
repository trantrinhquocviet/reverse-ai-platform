# Reverse AI Studio

# Phase 0 - Platform Foundation

## Objective

Build a scalable and maintainable platform foundation for Reverse AI Studio.

This phase focuses on infrastructure, project architecture, development standards, deployment, monitoring, and cloud readiness.

No business features or AI functionality will be developed in this phase.

The goal is to establish a solid technical foundation that supports all future phases without major architectural changes.

---

# Architecture Principle

Adopt a **Modular Monolith Architecture** instead of Microservices.

The application should be deployed as a single backend application while keeping every business domain isolated into independent modules.

AI workloads should run as separate asynchronous workers connected through a message queue.

This architecture provides:

- Faster development
- Easier debugging
- Lower deployment cost
- Simpler maintenance
- Easy migration to Microservices in the future

---

# High-Level Architecture

Frontend

↓

React Application

↓

FastAPI Backend

↓

Redis Queue

↓

AI Workers

↓

Supabase Database & Storage

---

# System Components

## Frontend

Technology

- React
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui

Responsibilities

- User Interface
- Authentication
- Dashboard
- Video Management
- Dataset Management
- AI Management

---

## Backend API

Technology

- FastAPI

Responsibilities

- Authentication
- REST API
- Business Logic
- Permission Management
- File Management
- Job Scheduling
- Integration APIs

The backend should remain a single deployable application.

Business domains must be separated into modules.

Example

- Auth Module
- Video Module
- Dataset Module
- Annotation Module
- AI Module
- Training Module
- Inspector Module
- Analytics Module
- Integration Module

---

## Database

Technology

- PostgreSQL (Supabase)

Responsibilities

- Business Data
- AI Metadata
- User Data
- Configuration
- Dataset Metadata
- Job Metadata

---

## Object Storage

Technology

- Supabase Storage

Store

- Videos
- Images
- Extracted Frames
- Model Files
- Dataset Export
- AI Reports

---

## Queue

Technology

- Redis

Responsibilities

- Background Jobs
- OCR Queue
- Video Processing Queue
- Training Queue
- Notification Queue

Every long-running process should execute asynchronously.

---

## AI Workers

Separate Python worker processes.

Workers

OCR Worker

Frame Extraction Worker

Training Worker

Inference Worker

Quality Detection Worker

Workers consume jobs from Redis.

Workers communicate with Backend through APIs or Queue Events.

Workers are independently scalable.

---

# Folder Structure

backend/

app/

modules/

auth/

video/

dataset/

annotation/

training/

inspector/

analytics/

integration/

core/

database/

schemas/

services/

workers/

ocr_worker/

training_worker/

inference_worker/

frame_worker/

frontend/

shared/

docker/

---

# Authentication

Support

- Email Login
- Google Login (Future)
- Role-Based Access Control (RBAC)

Roles

Admin

AI Engineer

Reviewer

Operator

Viewer

---

# Configuration Management

Use environment variables.

Separate

Development

Testing

Production

Store secrets securely.

Never hardcode credentials.

---

# Docker

Every component should be containerized.

Containers

Frontend

Backend

Redis

Worker

Local development should start with a single command.

Example

docker compose up

---

# CI/CD

GitHub Actions

Automatically

Run Tests

Lint Code

Build Docker Images

Deploy

Notify Deployment Status

---

# Logging

Centralized logging.

Every request should generate

Request ID

Timestamp

User

Endpoint

Execution Time

Errors

Workers should also produce structured logs.

---

# Monitoring

Monitor

API Health

Worker Status

Queue Length

GPU Usage

CPU Usage

RAM Usage

Storage Usage

Database Connections

---

# Error Handling

Every API should return

Status

Message

Error Code

Request ID

Support global exception handling.

---

# Coding Standards

TypeScript

Python Type Hints

Linting

Formatting

Reusable Components

Dependency Injection

Clean Architecture

Repository Pattern (optional)

Service Layer

DTO

Schema Validation

---

# Security

JWT Authentication

HTTPS Ready

CORS

Rate Limiting

Input Validation

SQL Injection Protection

XSS Protection

Secure File Upload

---

# Future Scalability

Architecture must support future migration to

API Gateway

Microservices

Kubernetes

GPU Cluster

Distributed Queue

Object Storage

without requiring major code refactoring.

---

# Deliverables

Claude should build

✅ Project Structure

✅ FastAPI Backend

✅ React Frontend

✅ Docker Configuration

✅ Redis Integration

✅ Background Worker Framework

✅ Authentication Module

✅ Logging Framework

✅ Monitoring Dashboard (Placeholder)

✅ CI/CD Configuration

✅ Environment Configuration

No business logic required.

No AI implementation required.

This phase establishes the technical foundation for all future development.
```

## Sau Phase 0, kiến trúc sẽ như sau

```text
                   React (Frontend)
                           │
                    REST / WebSocket
                           │
                    FastAPI Backend
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
 PostgreSQL          Supabase Storage      Redis Queue
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                Background AI Workers
        ┌────────────┬────────────┬────────────┐
        │            │            │            │
 OCR Worker   Frame Worker  Training Worker  Inspector Worker
```

Đây là kiến trúc mình khuyên cho **Phase 0–4** vì vừa đủ đơn giản để phát triển nhanh, vừa có khả năng mở rộng sau này. Khi hệ thống lớn (Phase 6–7), bạn có thể tách từng AI Worker hoặc từng module backend thành microservice mà gần như không phải thay đổi logic nghiệp vụ.
