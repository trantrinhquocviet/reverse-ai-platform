# Module 05 — WH Video Audit Pipeline

## Mục tiêu

Đánh giá **chất lượng bằng chứng video** — độc lập với content analysis.

> Câu hỏi: "Video này có đủ bằng chứng để kết luận không?"

---

## Audit Components

### 5.1 Camera / Video Quality

Chạy trên **tất cả frames**, không chỉ key frames.

```
Mỗi frame → đo:
  - blur_score (Laplacian variance)
  - brightness_avg
  - exposure_max
  - motion_blur (fast motion check)

Nếu > 30% frames của 1 event bị poor quality
→ Log video-level quality error
```

| Error | Điều kiện | Severity |
|-------|-----------|----------|
| `VIDEO_BLUR` | > 30% important event frames blur | WARNING |
| `FRAME_BLUR` | Single frame blur (isolated) | INFO |
| `TOO_DARK` | brightness_avg < 30 | WARNING |
| `OVEREXPOSED` | > 20% pixels saturated | WARNING |
| `CAMERA_BLOCKED` | Work zone bị che > 2s | WARNING |
| `CAMERA_SHAKE` | Motion variance quá cao | WARNING |
| `WORK_ZONE_NOT_VISIBLE` | Work zone out of frame | CRITICAL |
| `LOW_RESOLUTION` | < 480p effective | WARNING |

---

### 5.2 AWB Evidence Audit

| Check | Pass condition |
|-------|---------------|
| AWB shown | At least 1 frame với label detected |
| AWB readable | OCR confidence > 0.7 OR barcode decoded |
| AWB not occluded | Label area > 70% visible |
| AWB visible duration | > 0.5 seconds |

---

### 5.3 Parcel Evidence Audit

| Check | Pass condition |
|-------|---------------|
| Single active parcel | Only 1 parcel in work zone |
| Parcel identity maintained | Track continuity > 80% |
| Parcel in frame | In work zone > 80% of processing time |
| No parcel switch | Same parcel from start to end |

---

### 5.4 Opening Evidence Audit

| Check | Pass condition |
|-------|---------------|
| Opening captured | `OPENING_START` + `PARCEL_OPENED` events exist |
| No gap during opening | No `VIDEO_GAP` event during opening window |
| Parcel was sealed | Evidence of sealed parcel before opening |
| Opening in frame | Opening event visible in work zone |

---

### 5.5 Product Evidence Audit

| Check | Pass condition |
|-------|---------------|
| Product detected | At least 1 product detected |
| Product clearly visible | At least 1 frame with product > MIN_AREA |
| Product removed from parcel | `PRODUCT_REMOVED` event captured |
| Source chain intact | parcel → product chain unbroken |
| Quantity verifiable | Can count distinct products |

---

### 5.6 Process Integrity Audit

Verify event sequence is correct:

```typescript
const EXPECTED_SEQUENCE = [
  'ACTIVE_PARCEL_LOCKED',
  'AWB_VISIBLE',
  'OPENING_START',
  'PARCEL_OPENED',
  'PRODUCT_FIRST_VISIBLE',
  'PRODUCT_REMOVED',
  'PRODUCT_INSPECTION',
  'PROCESS_COMPLETED',
]
```

Check:
- Không có event bị skip (configurable per workflow type)
- Order đúng
- Không có unexpected gap giữa events

---

## Video Error Taxonomy (configurable)

```typescript
interface WHVideoRule {
  error_code: string
  name: string
  category: 'VIDEO_QUALITY' | 'AWB_EVIDENCE' | 'PARCEL_EVIDENCE' |
            'OPENING_EVIDENCE' | 'PRODUCT_EVIDENCE' | 'PROCESS_INTEGRITY'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  enabled: boolean
  threshold?: number
  required_for_categories?: string[]  // ['food', 'electronics']
  required_event?: string
  business_weight: number  // for evidence score calculation
}
```

**Không hardcode severity trong AI prompt — dùng rules engine.**

---

## Output: Evidence Checklist

```typescript
interface EvidenceChecklist {
  parcel_id: string
  evidence: {
    active_parcel: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
    awb_visible: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
    awb_readable: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
    opening: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
    product_emergence: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
    product_removed: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
    product_full_view: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
    barcode: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
    product_text: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
    quantity: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
    process_completed: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'
  }
}
```
