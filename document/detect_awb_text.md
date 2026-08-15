CAMERA FRAME
      │
      ▼
┌──────────────────────┐
│  1. ACTIVE PARCEL    │ ← Tay + Motion + Tracking
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  2. AWB / LABEL      │ ← Detect shipping label
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  3. TEXT REGIONS     │ ← Detect tất cả text
│                      │
│ [Tracking Code]      │
│ [Barcode]            │
│ [Order Code]         │
│ [Route] [Qty] [...]  │
└──────────┬───────────┘
           ▼
       OCR + CLASSIFY