Add a VIDEO TYPE CLASSIFICATION stage before the existing active-box
and product-detection pipeline.

The system must distinguish between:

1. PACKING_VIDEO
   - Product starts outside or partially outside the active box.
   - Product is inserted into the box.
   - Box transitions from OPEN → CLOSED.
   - Tape/seal may be applied.
   - Final state is normally a closed/sealed parcel.

2. UNBOXING_VIDEO
   - Active box starts closed or sealed.
   - Tape/seal is opened or removed.
   - Box transitions from CLOSED → OPEN.
   - Product becomes visible inside the box.
   - Product may be removed for inspection.
   - Final state normally exposes the product/content.

3. UNKNOWN_VIDEO
   - Insufficient frames.
   - Process starts too late or ends too early.
   - No clear temporal evidence.
   - Packing and unboxing evidence conflicts.

IMPORTANT:
Do not classify video type using a single frame.

Classification must use temporal evidence across multiple sampled frames.

Track:
- active_box_id
- box_state: CLOSED / OPEN / SEALED / UNKNOWN
- product_location: OUTSIDE_BOX / INSIDE_BOX / PARTIAL / UNKNOWN
- product_visibility
- seal_state: SEALED / OPENED / NOT_VISIBLE
- action:
  INSERT_PRODUCT
  REMOVE_PRODUCT
  OPEN_BOX
  CLOSE_BOX
  APPLY_SEAL
  REMOVE_SEAL
  INSPECT_PRODUCT

Infer video type from the ACTION SEQUENCE.

Example:

PACKING:
OPEN_BOX
→ INSERT_PRODUCT
→ CLOSE_BOX
→ APPLY_SEAL

UNBOXING:
SEALED_BOX
→ REMOVE_SEAL
→ OPEN_BOX
→ PRODUCT_VISIBLE
→ REMOVE_PRODUCT
→ INSPECT_PRODUCT

Return:

{
  "video_type": "PACKING_VIDEO | UNBOXING_VIDEO | UNKNOWN_VIDEO",
  "confidence": 0.0,
  "evidence": [
    {
      "timestamp": "...",
      "event": "...",
      "active_box_id": "...",
      "box_state": "...",
      "product_location": "..."
    }
  ]
}

Only continue to the specialized detection pipeline after video type
classification.

If PACKING_VIDEO:
run packing validation pipeline.

If UNBOXING_VIDEO:
run unboxing / returned-product inspection pipeline.

If UNKNOWN_VIDEO:
flag for human review.