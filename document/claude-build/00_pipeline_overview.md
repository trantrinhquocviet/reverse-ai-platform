# Pipeline Overview — Reverse AI Studio

## Mục tiêu

Phân tích video kho hàng (warehouse packing/unboxing) để:
1. **CONTENT ANALYSIS** — phát hiện parcel, AWB, sản phẩm, barcode, OCR
2. **WH VIDEO AUDIT** — đánh giá chất lượng video và process của warehouse

---

## Kiến trúc tổng thể

```
VIDEO INPUT
    │
    ▼
[LEVEL 1] Lightweight Monitoring (2–5 FPS)
    │   Motion detection, scene change, hand movement
    │   → Trigger key frame events
    │
    ▼
[LEVEL 2] AI Key Frame Selection
    │   Chỉ gửi high-value frames lên AI
    │
    ├──────────────────────────────────────┐
    ▼                                      ▼
CONTENT PIPELINE                    WH AUDIT PIPELINE
  ├─ Active Parcel Detection           ├─ Video Quality Check
  ├─ AWB Detection + OCR               ├─ AWB Evidence
  ├─ Opening Detection                 ├─ Parcel Evidence
  ├─ Product Emergence                 ├─ Opening Evidence
  ├─ Product Tracking                  ├─ Product Evidence
  ├─ Barcode Decode                    ├─ Process Integrity
  └─ Product OCR / Identity            └─ Evidence Score 0–100
    │                                      │
    └──────────────┬───────────────────────┘
                   ▼
            Evidence Engine
            (Rules Engine + Confidence)
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
     PASS    WH_PROCESS_FAIL  AI_UNCERTAIN
                               │
                               ▼
                        Human Review
                               │
                               ▼
                        Ground Truth Dataset
```

---

## Modules

| # | Module | File | Status |
|---|--------|------|--------|
| 1 | Frame Extraction | `01_frame_extraction.md` | Design |
| 2 | Active Parcel Detection | `02_active_parcel.md` | Design |
| 3 | AWB Detection + OCR | `03_awb_detection.md` | Design |
| 4 | Product Detection & Tracking | `04_product_tracking.md` | Design |
| 5 | WH Video Audit | `05_wh_video_audit.md` | Design |
| 6 | Evidence Engine | `06_evidence_engine.md` | Design |
| 7 | Human Review & Ground Truth | `07_human_review.md` | Design |

---

## Nguyên tắc cốt lõi

> **"AI không detect được" ≠ "Warehouse làm sai"**

Mỗi issue phải có:
- `source`: `WAREHOUSE` | `AI` | `SYSTEM` | `UNKNOWN`
- `severity`: `INFO` | `WARNING` | `CRITICAL`
- `confidence`: 0.0 – 1.0

Final status của video:
- `PASS`
- `PASS_WITH_WARNING`
- `WH_PROCESS_FAIL`
- `AI_UNCERTAIN`
- `SYSTEM_ERROR`
- `HUMAN_REVIEW_REQUIRED`
