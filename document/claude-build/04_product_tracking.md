# Module 04 — Product Detection & Tracking

## Mục tiêu

Detect sản phẩm xuất hiện từ parcel, track qua các frames, verify identity (SKU/barcode/OCR).

---

## Event sequence

```
PARCEL_OPENED
    │
    ▼
PRODUCT_FIRST_VISIBLE   ← first key frame với product mới
    │
    ▼
PRODUCT_REMOVED         ← product rời khỏi parcel
    │
    ├── PRODUCT_INSPECTION (held steady > 1s)
    │       ├── BARCODE_VISIBLE → ZXing decode
    │       └── TEXT_VISIBLE → OCR
    │
    ▼
PRODUCT_PLACED          ← product được đặt vào vị trí mới
    │
    ▼
PROCESS_COMPLETED
```

---

## Product Detection

### Vision model prompt template

```
In this warehouse video frame:
1. List all products visible (that came out of the parcel)
2. For each product:
   - Bounding box
   - Product type (general description)
   - Confidence it came from the active parcel
   - Is barcode/label visible?
   - Is product clearly identifiable?
3. Count of distinct products
```

### Category-specific fields

```typescript
const CATEGORY_FIELDS = {
  'food_beverage': ['lot_number', 'mfg_date', 'exp_date'],
  'beauty': ['batch_code', 'shade', 'exp_date', 'seal_intact'],
  'electronics': ['model_number', 'serial_number', 'imei', 'accessories'],
  'fashion': ['size', 'color', 'style_code'],
  'default': ['sku', 'quantity'],
}
```

---

## Product Tracking

### Track maintenance

```
Frame N: product detected at bbox_N
Frame N+1: find bbox with IOU > 0.5 → same product
IOU < 0.3 → OBJECT_TRACK_LOST
```

Assign `product_id`: `{video_id}_{parcel_id}_p{n}` (e.g., `v001_par01_p01`)

### Source verification

```
Evidence chain: parcel_opened → product_first_visible → product_removed
Nếu chain bị đứt → PRODUCT_SOURCE_UNVERIFIABLE
```

---

## Error codes

| Code | Mô tả | Source | Severity |
|------|-------|--------|----------|
| `PRODUCT_NOT_DETECTED` | Không detect được product sau khi mở | AI/WH | CRITICAL |
| `PRODUCT_NOT_CLEAR` | Product visible nhưng không đủ rõ | WAREHOUSE | CRITICAL |
| `PRODUCT_TOO_FAR` | Product ROI quá nhỏ | WAREHOUSE | WARNING |
| `PRODUCT_TOO_FAST` | Product show < 0.5s | WAREHOUSE | WARNING |
| `PRODUCT_OCCLUDED` | Product bị che bởi tay/vật khác | WAREHOUSE | WARNING |
| `PRODUCT_OUT_OF_FRAME` | Product rời khỏi camera zone | WAREHOUSE | WARNING |
| `PRODUCT_NOT_FULLY_SHOWN` | Không có frame nào show đủ product | WAREHOUSE | CRITICAL |
| `PRODUCT_REMOVAL_NOT_CAPTURED` | Không capture được product rời parcel | WAREHOUSE | CRITICAL |
| `PRODUCT_SOURCE_UNVERIFIABLE` | Không verify được product từ parcel | AI/WH | CRITICAL |
| `PRODUCT_OVERLAP` | Multiple products overlap | WAREHOUSE | WARNING |
| `PRODUCT_COUNT_UNVERIFIABLE` | Không count được unique products | AI/WH | WARNING |
| `PRODUCT_IDENTITY_UNVERIFIABLE` | Không verify được SKU/identity | AI/WH | CRITICAL |
| `BARCODE_NOT_SHOWN` | Không show barcode | WAREHOUSE | WARNING/CRITICAL |
| `BARCODE_UNREADABLE` | Barcode visible nhưng không decode được | AI | WARNING |
| `SKU_UNVERIFIABLE` | SKU không confirm được | AI/WH | CRITICAL |

---

## Output schema

```typescript
interface ProductResult {
  product_id: string
  parcel_id: string
  first_seen_timestamp: number
  first_seen_frame_id: string
  track_frames: string[]
  sku_detected: string | null
  barcode_decoded: string | null
  ocr_text: string | null
  category_fields: Record<string, string | null>
  source_verified: boolean
  count: number
  errors: ProductError[]
}
```

---

## Key challenge: PRODUCT_NOT_DETECTED phân tích nguyên nhân

```
NO_PRODUCT_DETECTED
    │
    ├── Frame quality good + parcel opened → PRODUCT_MISSING (WH?)
    ├── Frame quality poor → PRODUCT_NOT_CLEAR (WH error)
    ├── Product visible but outside frame → PRODUCT_OUT_OF_FRAME (WH)
    ├── Video gap during opening → VIDEO_GAP (WH/SYSTEM)
    └── Model confidence low → AI_UNCERTAIN
```

**Không bao giờ assign PRODUCT_MISSING trực tiếp từ detection failure.**
