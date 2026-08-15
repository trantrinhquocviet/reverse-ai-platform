# Module 01 — Frame Extraction (Event-Driven)

## Vấn đề với fixed-interval sampling

Fixed 2s interval gửi ~150 frames/video 5 phút → tốn kém + nhiều frame vô nghĩa.

**Giải pháp**: 2-level approach.

---

## Level 1 — Lightweight Monitoring

**Mục tiêu**: Detect EVENTS, không detect objects.

```
Input: Video stream
Rate: 2–5 FPS (configurable, default 3 FPS)
Method: Client-side Canvas pixel diff
```

### Triggers tạo Key Frame

| Event | Điều kiện trigger |
|-------|------------------|
| `PARCEL_ENTER` | Object mới xuất hiện trong work zone |
| `ACTIVE_PARCEL_LOCKED` | Parcel ổn định > 1.5s |
| `AWB_VISIBLE` | Rectangular label region detected |
| `HAND_INTERACTION` | Skin-tone pixels tăng > threshold |
| `OPENING_START` | Motion burst + parcel state change |
| `PARCEL_OPENED` | Parcel structure change |
| `PRODUCT_FIRST_VISIBLE` | New object xuất hiện bên trong parcel |
| `PRODUCT_REMOVED` | Product rời khỏi parcel |
| `PRODUCT_INSPECTION` | Product held steady > 1s |
| `BARCODE_VISIBLE` | High-contrast rectangular region |
| `PROCESS_COMPLETED` | Low motion + workspace cleared |
| `SCENE_CHANGE` | Sudden full-frame change |
| `VIDEO_GAP` | Timestamp discontinuity |

### Motion Detection (hiện tại đang dùng)

```javascript
// Hiện có trong ProcessingContext.tsx
const MOTION_THRESHOLD = 0.04  // 4% pixel change
// Resize to 64×36px thumbnail → pixel diff
// diff < 4% → SKIP (static frame)
```

### Cần thêm

- **Object appearance detector**: bounding box change detection
- **Skin-tone detector**: hand presence indicator
- **Structural change detector**: parcel shape change

---

## Level 2 — AI Key Frame Analysis

**Chỉ gửi frames từ Level 1 events lên AI.**

### Current flow (ProcessingContext.tsx)

```
Stage 1: Motion detection (64×36px thumbnail)
Stage 2: Quick OCR (Tesseract 320px, text < 8 chars → skip)
Stage 3: Full OCR + ZXing barcode
Stage 4: POST /api/analyze_frame → OpenRouter Vision
```

### Proposed upgrade

```
Event trigger → Capture key frame
    │
    ├── Frame Quality Check (blur, dark, exposure)
    │       → Nếu poor quality → log VIDEO_BLUR / TOO_DARK
    │
    ├── Content Analysis
    │       → Vision model: detect parcel/AWB/product/barcode
    │
    └── Audit Check
            → Compare với expected event sequence
            → Log missing events
```

---

## Thresholds (configurable)

```typescript
const FRAME_EXTRACTION_CONFIG = {
  SAMPLE_INTERVAL: 2,           // seconds between candidates
  MONITORING_FPS: 3,            // Level 1 rate
  MOTION_THRESHOLD: 0.04,       // 4% pixel change
  TEXT_MIN_LENGTH: 8,           // minimum OCR chars
  BLUR_THRESHOLD: 0.015,        // Laplacian variance
  DARK_THRESHOLD: 30,           // avg pixel brightness
  EXPOSURE_THRESHOLD: 240,      // overexposed pixel avg
  STEADY_DURATION: 1.5,         // seconds object must be stable
}
```

---

## Implementation notes

- **Browser-side**: HTMLVideoElement + Canvas API (không cần ffmpeg)
- **Queue**: localStorage `processing_queue_v1` (survive page reload)
- **Background processing**: Hidden `<video>` trong ProcessingProvider
- **Key file**: `src/contexts/ProcessingContext.tsx`

---

## Output

```typescript
interface KeyFrame {
  frame_id: string
  timestamp: number
  event_type: KeyFrameEvent
  image_base64: string
  frame_quality: {
    blur_score: number
    brightness: number
    is_usable: boolean
  }
  motion_score: number
}
```
