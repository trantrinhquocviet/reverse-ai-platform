# Reverse AI Studio

# Phase 2 - AI Data Factory

## Objective

Build the AI Data Factory.

This phase introduces the first AI workflow.

The system should automatically process uploaded warehouse videos and transform them into structured datasets that can later be used for AI model training.

This phase does NOT include model training.

Instead, it builds the complete data preparation pipeline.

---

# Pipeline

Video

↓

Extract Frames

↓

Frame Filtering

↓

OCR Detection

↓

Tracking Code Detection

↓

AI Candidate Frames

↓

Human Review

↓

Dataset

---

# New Navigation

AI Processing

Annotation Queue

Review Queue

Feature Explorer

Dataset

---

# AI Processing

After a user uploads a video.

Automatically create an AI Job.

Each job contains

Video

↓

Frame Extraction

↓

OCR

↓

Tracking Detection

↓

Packaging Detection (Placeholder)

↓

Product Detection (Placeholder)

↓

Quality Detection (Placeholder)

↓

Completed

Display processing progress.

Example

Extracting Frames

█████████░░░░

OCR

████████████

Tracking

██████░░░░░

Overall

67%

---

# Frame Extraction

After uploading

Extract frames every configurable interval.

Default

1 FPS

Display

Total Frames

Selected Frames

Discarded Frames

Blur Frames

Duplicate Frames

---

# Frame Gallery

New screen

Grid View

Each frame displays

Thumbnail

Timestamp

Blur Score

OCR Status

Tracking Found

Frame Quality

Actions

Open

Review

Delete

---

# OCR Detection

Placeholder AI.

Create OCR Result panel.

Fields

Detected Text

Confidence

Language

Status

Example

Tracking Code

SPXVN123456789

Confidence

98%

Allow manual correction.

---

# Tracking Detection

New module.

Rule Engine

Detect tracking code using Regex.

Examples

SPX

JNT

GHN

GHTK

NJVN

Display

Matched

Not Matched

Unknown

Highlight detected text.

---

# Annotation Queue

Frames needing manual review.

Each card

Frame

OCR

Tracking

AI Confidence

Reviewer

Status

Buttons

Approve

Reject

Edit

---

# Annotation Screen

Large Image

Right Panel

Detected Objects

Tracking Label

Barcode

QR

Product

Packaging

Quality

Allow drawing Bounding Boxes.

Support keyboard shortcuts.

Save YOLO annotation.

---

# Review Queue

Review completed annotations.

Display

Reviewer

Review Time

Confidence

Approval Status

History

Support comments.

---

# Feature Explorer

One of the most important pages.

For every frame display extracted AI Features.

Example

Tracking Found

YES

Barcode Found

YES

Packaging Type

Bottle

OCR Confidence

97%

Blur Score

4%

Brightness

Normal

Frame Quality

Excellent

Rotation

2°

Duplicate

NO

Future Features

Damage

Leak

Dent

Scratch

Seal

---

# Dataset Manager

Dataset generated from approved frames.

Statistics

Training Images

Validation Images

Rejected Images

Pending Review

Export

YOLO

COCO

Pascal VOC

JSON

CSV

Support Dataset Version

v1

v2

v3

---

# AI Job Detail

Display complete pipeline.

Video

↓

Extract Frames

↓

OCR

↓

Regex

↓

Human Review

↓

Dataset

Timeline

Start Time

End Time

Duration

Logs

Errors

Warnings

---

# Notification Center

Show

Processing Complete

OCR Failed

Frame Needs Review

Dataset Exported

---

# Backend Structure

Jobs

Frames

OCR Results

Annotations

Features

Datasets

Dataset Versions

Review History

---

# Database

videos

frames

ocr_results

annotations

annotation_reviews

datasets

dataset_versions

processing_jobs

processing_logs

features

---

# UI Style

Dark Mode

AI Dashboard

Modern

Minimal

Large Cards

Smooth Animations

GitHub + Cursor + OpenAI

---

# Future Placeholder

Reserve architecture for

YOLO Training

OCR Training

Active Learning

Auto Annotation

SAM2

CLIP

PaddleOCR

Model Evaluation

AI Teacher

Synthetic Dataset

Do not implement these features now.

Only prepare scalable architecture.

---

# Deliverables

Claude should build

✅ AI Processing Dashboard

✅ Processing Queue

✅ Frame Gallery

✅ OCR Result Screen

✅ Tracking Detection Screen

✅ Annotation Queue

✅ Annotation Tool UI

✅ Review Queue

✅ Feature Explorer

✅ Dataset Manager

✅ Dataset Version UI

Use mock data.

No real AI implementation.

Design everything as if AI services will be connected in Phase 3.