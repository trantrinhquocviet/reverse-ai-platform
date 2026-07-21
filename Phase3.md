# Reverse AI Studio

# Phase 3 - AI Annotation Engine

## Objective

Build an AI-assisted annotation platform.

The system should dramatically reduce manual labeling effort by allowing AI to generate annotation suggestions while humans validate, edit, and approve them.

The goal is to create a Human-in-the-Loop annotation workflow.

This phase still does NOT train any model.

Instead, it creates high-quality datasets for future AI training.

---

# Core Workflow

Video

↓

Frames

↓

AI Detection

↓

Auto Annotation

↓

Human Review

↓

Dataset

↓

Training Ready

---

# New Navigation

Auto Annotation

Review Center

Annotation Analytics

Knowledge Rules

Dataset Explorer

---

# Auto Annotation

Display every frame with AI suggestions.

AI should generate

Tracking Label

Barcode

QR Code

Product Region

Packaging

Possible Damage

Possible OCR Region

Each suggestion contains

Bounding Box

Confidence

Reason

Example

Tracking Label

Confidence

98%

Reason

Rectangle shape with high OCR confidence.

---

# Human Review

Each annotation has three actions

Approve

Reject

Edit

Keyboard shortcuts

A

Approve

R

Reject

E

Edit

N

Next

P

Previous

Support ultra-fast reviewing.

---

# Smart Review Mode

Display only low-confidence frames.

Example

Confidence

98%

Auto Approved

Confidence

94%

Auto Approved

Confidence

81%

Need Review

Confidence

63%

Need Review

Confidence

32%

Need Review

This significantly reduces annotation workload.

---

# Annotation Editor

Professional annotation tool.

Support

Bounding Box

Polygon

Zoom

Pan

Rotate

Brightness

Contrast

Grid

Undo

Redo

Keyboard shortcuts

Auto Save

---

# OCR Editor

Display

Original OCR

Editable OCR

Confidence

Highlight uncertain characters.

Example

Detected

SPXVN12345B89

Confidence

87%

User edits

SPXVN12345889

Save

---

# AI Explainability

Every AI prediction should explain itself.

Example

Tracking Label

Confidence

96%

Reason

High contrast rectangle.

Contains readable OCR.

Aspect ratio matches shipping labels.

---

# Annotation History

Store every modification.

Display

Original AI

Reviewer

Changes

Timestamp

Support rollback.

---

# Knowledge Rules

Create a rule engine.

Example

Tracking Code

Must match regex

SPX.*

Barcode

Minimum confidence

80%

Packaging

Bottle

Must contain cap.

Box

Should have four visible edges.

These rules will evolve over time.

---

# Active Learning

Display difficult frames.

Frames

High Blur

Low OCR

Unknown Packaging

Unknown Product

Unknown Damage

These become priority annotation tasks.

---

# Duplicate Detection

Find nearly identical frames.

Display

Duplicate Score

Similarity

Keep Best Frame

Discard Others

Reduce dataset size automatically.

---

# Annotation Analytics

Dashboard

Frames Reviewed

Approval Rate

Average Review Time

AI Accuracy

OCR Accuracy

Duplicate Reduction

Reviewer Performance

Daily Progress

---

# Dataset Quality Score

Every dataset receives a quality score.

Example

Images

25,432

Blur

1.3%

Duplicates

0.8%

OCR Quality

97%

Annotation Consistency

99%

Overall Score

96.4%

---

# Dataset Explorer

Search

Tracking Code

Warehouse

Brand

Packaging

OCR

Confidence

Reviewer

Date

Support image preview.

---

# Feature Extraction

Generate structured AI Features.

Tracking

Barcode

OCR Length

Packaging Type

Bounding Box Size

Blur Score

Brightness

Contrast

Rotation

Duplicate Score

Frame Sharpness

Store every feature.

Future AI models will train using these features.

---

# Backend

annotation_jobs

annotation_results

annotation_history

annotation_rules

annotation_features

duplicate_groups

review_sessions

review_statistics

---

# Future Ready

Prepare APIs for

YOLO

SAM2

Grounding DINO

CLIP

PaddleOCR

Florence-2

Do not implement them yet.

Create scalable architecture only.

---

# UI Style

Professional AI Annotation Studio.

Dark Theme.

Inspired by

CVAT

Label Studio

Roboflow

Cursor

Linear

OpenAI

Focus on speed.

One-click approval.

Keyboard-first workflow.

Large preview.

AI explanation panel.

Minimal distractions.

---

# Deliverables

Claude should build

✅ Auto Annotation Dashboard

✅ AI Suggestion Cards

✅ Human Review Screen

✅ Annotation Editor

✅ OCR Editor

✅ Smart Review Mode

✅ Active Learning Queue

✅ Duplicate Detection UI

✅ Dataset Quality Dashboard

✅ Annotation Analytics

Use mock AI results.

No real AI implementation.

Architecture must support plugging in multiple AI models in future phases.