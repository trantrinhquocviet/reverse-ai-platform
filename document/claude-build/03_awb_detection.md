# Module 03 — AWB Detection & OCR

## Mục tiêu

Detect và đọc được **AWB / Shipping Label** trên parcel để extract tracking code.

---

## Pipeline

```
Key frame (event: AWB_VISIBLE)
    │
    ▼
Label Region Detection
    │  Detect rectangular high-contrast region
    │  (ZXing pre-scan for barcode structure)
    │
    ▼
Frame Quality Gate
    │  blur_score > threshold?
    │  label_area_pixels > MIN_AWB_SIZE?
    │  → Nếu không: log AWB_NOT_CLEAR
    │
    ▼
OCR (Tesseract full resolution)
    │  Extract all text regions
    │  Pattern match: tracking code regex
    │
    ▼
Barcode Decode (ZXing)
    │  Try Code128, QR, DataMatrix
    │
    ▼
Vision Model (nếu OCR fail)
    │  "Read the tracking/AWB code on this label"
    │
    ▼
Consolidate & validate
    └─ Match với expected order AWB (nếu có)
```

---

## Tracking code patterns (regex)

```typescript
const TRACKING_PATTERNS = [
  /\b[A-Z]{2}\d{9}[A-Z]{2}\b/,        // Standard postal
  /\b\d{12,14}\b/,                      // FedEx/UPS numeric
  /\b[A-Z0-9]{10,25}\b/,               // Generic alphanumeric
  /\b(VN|SP|GHN|GHTK)\d{8,12}\b/,     // Vietnam couriers
]
```

---

## Error codes

| Code | Mô tả | Source | Severity |
|------|-------|--------|----------|
| `AWB_NOT_SHOWN` | Không có label nào được show | WAREHOUSE | CRITICAL |
| `AWB_NOT_CLEAR` | Label visible nhưng không có frame đủ nét | WAREHOUSE | CRITICAL |
| `AWB_CODE_NOT_DETECTED` | Label detected nhưng không đọc được code | AI/WH | WARNING |
| `AWB_PARTIALLY_HIDDEN` | Label bị che một phần | WAREHOUSE | WARNING |
| `AWB_TOO_SMALL` | Label quá nhỏ để OCR | WAREHOUSE | WARNING |
| `AWB_TOO_FAST` | Label chỉ visible < 0.5s | WAREHOUSE | WARNING |
| `MULTIPLE_AWB` | > 1 label, không rõ cái nào active | WAREHOUSE | WARNING |
| `AWB_MISMATCH` | Code đọc được ≠ expected order | WAREHOUSE | CRITICAL |

---

## Phân biệt AWB_NOT_SHOWN vs AWB_SHOWN_BUT_AI_UNREADABLE

```
Nếu: không có bất kỳ rectangular high-contrast region nào
→ AWB_NOT_SHOWN (source: WAREHOUSE)

Nếu: region detected, OCR/barcode failed
→ AWB_CODE_NOT_DETECTED (source: AI nếu frame chất lượng tốt)
→ AWB_NOT_CLEAR (source: WAREHOUSE nếu frame blur/tối)
```

---

## Evidence quality threshold

```typescript
const AWB_CONFIG = {
  MIN_AWB_PIXELS: 5000,      // minimum label area in pixels
  MIN_VISIBLE_DURATION: 0.5, // seconds AWB must be visible
  OCR_CONFIDENCE_MIN: 0.7,   // Tesseract confidence
  BLUR_REJECT_THRESHOLD: 0.01,
}
```

---

## Output schema

```typescript
interface AWBResult {
  parcel_id: string
  detected: boolean
  best_frame_id: string
  best_frame_timestamp: number
  label_bbox: [number, number, number, number]
  tracking_code: string | null
  ocr_confidence: number
  barcode_decoded: boolean
  visible_duration: number  // seconds
  errors: AWBError[]
}
```

---

## Current implementation

- ZXing barcode decode: `Stage 3` trong ProcessingContext.tsx
- Tesseract OCR: `Stage 2` (quick) + `Stage 3` (full)
- Pattern matching: `extractTrackingCode()` function
- **Chưa có**: AWB region detection, quality gating, duration tracking
