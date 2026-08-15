# Module 02 — Active Parcel Detection

## Mục tiêu

Xác định **đúng parcel nào đang được xử lý** trong frame, và duy trì track qua toàn video.

---

## State Machine

```
WAITING
    │ parcel enters work zone
    ▼
PARCEL_DETECTED
    │ parcel stable > 1.5s + AWB confirmed
    ▼
ACTIVE_PARCEL_LOCKED  ← anchor point cho toàn bộ pipeline
    │
    ├── OPENING_START
    │       ↓
    │   PARCEL_OPENED
    │
    └── PROCESS_COMPLETED
            │
            ▼
        NEXT_PARCEL / END
```

---

## Detection logic

### Input
- Key frames từ Module 01 (Level 2)
- Event type: `PARCEL_ENTER`, `ACTIVE_PARCEL_LOCKED`

### Vision model prompt (tại key frame)

```
Identify the active parcel being processed:
- Location in frame (bounding box)
- Parcel type (box/bag/envelope)
- Size estimate
- Is there exactly ONE active parcel?
- Confidence that this is the correct active parcel
```

### Track maintenance

- Assign `parcel_id` khi lock (e.g., `video_001_parcel_01`)
- Dùng bounding box IOU giữa frames để maintain track
- Nếu IOU < 0.3 → trigger `PARCEL_TRACK_LOST`

---

## Error codes

| Code | Mô tả | Source | Severity |
|------|-------|--------|----------|
| `ACTIVE_PARCEL_UNCLEAR` | Không xác định được parcel nào đang active | AI/WH | CRITICAL |
| `MULTIPLE_ACTIVE_PARCELS` | > 1 parcel đang được xử lý cùng lúc | WAREHOUSE | CRITICAL |
| `PARCEL_OUT_OF_FRAME` | Parcel rời khỏi work zone | WAREHOUSE | WARNING |
| `PARCEL_SWITCH` | Operator đổi parcel giữa chừng | WAREHOUSE | CRITICAL |
| `PARCEL_TRACK_LOST` | Không maintain được track | AI | WARNING |

---

## Output schema

```typescript
interface ActiveParcel {
  parcel_id: string
  lock_timestamp: number
  lock_frame_id: string
  bbox: [number, number, number, number]  // x, y, w, h
  parcel_type: 'box' | 'bag' | 'envelope' | 'other'
  track_confidence: number
  status: 'LOCKED' | 'LOST' | 'SWITCHED'
  errors: ParcelError[]
}
```

---

## Key challenge

**Phân biệt WAREHOUSE error vs AI limitation:**

- Parcel bị tay che → `CAMERA_BLOCKED` (source: WAREHOUSE or unknown)
- Parcel ngoài frame → `PARCEL_OUT_OF_FRAME` (source: WAREHOUSE)
- Model không detect được dù parcel visible → `ACTIVE_PARCEL_UNCLEAR` (source: AI)

→ Cần **frame quality check trước** để biết frame có usable không.
