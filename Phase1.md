# Reverse AI Studio

## Phase 1 - Foundation

### Objective

Build the first version of Reverse AI Studio.

This phase focuses on creating a modern web application for managing warehouse inspection videos before AI processing.

No AI model training is required in this phase.

The goal is to build a scalable architecture that will support AI modules in future phases.

---

# Tech Stack

Frontend

- React
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- React Router
- TanStack Query
- React Hook Form

Backend

- Supabase

Storage

- Supabase Storage

Database

- PostgreSQL

Theme

Dark Mode only.

Design style:

- Linear
- Cursor
- OpenAI
- GitHub

---

# Application Structure

Dashboard

Video Center

Dataset

AI Models

Settings

---

# Dashboard

Create a dashboard showing summary cards.

Cards

- Uploaded Videos
- Processing Videos
- Need Review
- Total Dataset
- AI Models
- Storage Usage

Show recent uploaded videos.

Show recent activities.

Use dummy data.

---

# Video Center

Main module.

Functions

- Upload video
- Delete video
- Search
- Filter
- Pagination

Each uploaded video contains

- Thumbnail
- Name
- Warehouse
- Brand
- Upload Time
- Duration
- Status

Status

- Uploaded
- Processing
- Ready
- Failed

Click a video opens Video Detail page.

---

# Video Detail

Layout

Left

Large video player.

Bottom

Timeline.

Right

Metadata panel.

Metadata

- File Name
- Warehouse
- Brand
- Duration
- Resolution
- Upload Time
- Current Status

AI section

(No AI yet)

Show placeholder cards

Tracking Code

Barcode

SKU

OCR

Packaging

Product

Quality

Display

Waiting for AI Analysis

---

# Dataset

Create dataset management page.

Table

Columns

- Preview
- Image Name
- Source Video
- Status
- Created Date

Top actions

- Import
- Export

Statistics cards

- Total Images
- Training Images
- Validation Images

Use dummy data.

---

# AI Models

Simple page.

Display model cards.

YOLO OCR

Status

Not Trained

Buttons

- Train
- Deploy
- Download

Buttons disabled.

Placeholder only.

---

# Settings

Application Settings

Warehouse List

Brand List

User Profile

Theme

---

# UI Requirements

Modern SaaS UI

Dark mode

Responsive

Smooth animation

Rounded cards

Large spacing

Minimal style

---

# Folder Structure

src

components

pages

layouts

hooks

services

types

utils

assets

---

# Code Requirements

Use reusable components.

No inline styles.

Use TypeScript interfaces.

Use mock data.

Keep business logic separated.

Use clean architecture.

---

# Deliverables

Claude should build

✅ Dashboard

✅ Sidebar

✅ Top Navigation

✅ Routing

✅ Video Upload UI

✅ Video List

✅ Video Detail

✅ Dataset Page

✅ AI Models Page

✅ Settings Page

No backend integration required.

No authentication required.

No AI required.

Everything should be built using reusable React components with clean architecture.
