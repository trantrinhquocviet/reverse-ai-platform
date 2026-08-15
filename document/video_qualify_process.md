==================================================
48. WAREHOUSE VIDEO QUALITY & PROCESS AUDIT
==================================================

Add a parallel WH_VIDEO_AUDIT pipeline.

The system must distinguish:

A. PRODUCT / PARCEL RESULT
from
B. QUALITY OF VIDEO EVIDENCE

CRITICAL RULE:

"AI cannot detect the product"
DOES NOT mean
"Product is missing."

Detection failure may be caused by poor warehouse video evidence.


==================================================
49. WH VIDEO ERROR TAXONOMY
==================================================

Detect the following warehouse video/process issues:

CAMERA QUALITY:
- VIDEO_BLUR
- FRAME_BLUR
- TOO_DARK
- OVEREXPOSED
- CAMERA_BLOCKED
- WORK_ZONE_NOT_VISIBLE

PARCEL EVIDENCE:
- ACTIVE_PARCEL_NOT_CLEAR
- AWB_NOT_VISIBLE
- AWB_UNREADABLE
- PARCEL_OUT_OF_FRAME

OPENING PROCESS:
- OPENING_NOT_CAPTURED
- OPENING_PARTIALLY_CAPTURED
- VIDEO_GAP_DURING_OPENING

PRODUCT EVIDENCE:
- PRODUCT_REMOVAL_NOT_CAPTURED
- PRODUCT_OUT_OF_FRAME
- PRODUCT_NOT_FULLY_VISIBLE
- PRODUCT_TOO_FAST
- PRODUCT_OCCLUDED
- PRODUCT_IDENTITY_UNVERIFIABLE

IDENTIFICATION EVIDENCE:
- BARCODE_NOT_SHOWN
- BARCODE_UNREADABLE
- PRODUCT_TEXT_NOT_SHOWN
- PRODUCT_TEXT_UNREADABLE
- SKU_UNVERIFIABLE

QUANTITY:
- PRODUCT_COUNT_UNVERIFIABLE
- MULTIPLE_PRODUCTS_OVERLAPPING

PROCESS INTEGRITY:
- MULTIPLE_ACTIVE_PARCELS
- PARCEL_SWITCH
- OBJECT_TRACK_LOST
- PRODUCT_SOURCE_UNVERIFIABLE
- VIDEO_DISCONTINUITY
- CRITICAL_EVENT_MISSING


==================================================
50. EVIDENCE COMPLETENESS
==================================================

For every parcel create an evidence checklist.

Example:

{
  "parcel_id": 27,

  "evidence": {
    "active_parcel": true,
    "awb": true,
    "opening": true,
    "product_emergence": true,
    "product_removed": true,
    "product_full_view": true,
    "barcode": false,
    "quantity_verifiable": true
  }
}

Do not only measure whether an object was detected.

Measure whether sufficient visual evidence exists.


==================================================
51. VIDEO QUALITY SCORE
==================================================

Calculate:

VideoEvidenceScore =
    CameraQuality
  + ParcelContinuity
  + AWBVisibility
  + OpeningVisibility
  + ProductRemovalVisibility
  + ProductVisibility
  + IdentificationEvidence
  + QuantityEvidence

Return a normalized score:

0–100.


==================================================
52. CRITICAL VS NON-CRITICAL ERRORS
==================================================

Not every video error should fail the case.

Example:

Minor blur for 0.5 seconds
→ warning

One frame blocked by hand
→ warning

But:

AWB never visible
→ potentially critical

Opening missing
→ critical

Product removal not captured
→ critical

Product leaves camera during inspection
→ potentially critical

Quantity cannot be verified
→ critical for quantity-related claims.

Create:

severity:
INFO
WARNING
CRITICAL


==================================================
53. RESULT CLASSIFICATION
==================================================

Final case status must support:

PASS

WH_PROCESS_FAIL

AI_UNCERTAIN

HUMAN_REVIEW_REQUIRED


Do NOT convert low AI confidence directly into WH_PROCESS_FAIL.


==================================================
54. FAILURE ATTRIBUTION
==================================================

For every failure return:

{
  "error_code": "PRODUCT_REMOVAL_NOT_CAPTURED",

  "source": "WAREHOUSE",

  "severity": "CRITICAL",

  "timestamp_start": "00:16.2",
  "timestamp_end": "00:18.8",

  "description":
    "Product becomes visible after parcel opening but
     the removal event is not visible in the video.",

  "evidence_frame_before": "...",
  "evidence_frame_after": "...",

  "confidence": 0.91
}


==================================================
55. AI FAILURE MUST BE SEPARATE
==================================================

Example:

Video:
- product clearly visible
- barcode clearly visible
- good lighting
- no occlusion

But model cannot identify SKU.

Result:

source = AI
status = AI_UNCERTAIN

NOT:

source = WAREHOUSE


==================================================
56. WH PROCESS FAILURE
==================================================

Example:

Product removed outside camera.

There is no frame proving which product came from parcel.

Result:

source = WAREHOUSE
error = PRODUCT_SOURCE_UNVERIFIABLE
severity = CRITICAL


==================================================
57. EVIDENCE TIMELINE
==================================================

Create a visual evidence timeline:

00:02  ACTIVE_PARCEL       PASS
00:05  AWB                 PASS
00:11  OPENING_START       PASS
00:14  PARCEL_OPENED       PASS
00:16  PRODUCT_EMERGENCE   PASS
00:17  PRODUCT_REMOVED     FAIL
00:20  PRODUCT_VISIBLE     PASS
00:25  BARCODE             FAIL
00:30  PROCESS_COMPLETED   PASS

This timeline should be available in the human review UI.


==================================================
58. TRAINING DATA FOR WH ERRORS
==================================================

WH errors must also become labeled training data.

Store:

video_id
parcel_id
error_type
severity
start_timestamp
end_timestamp
evidence_frames
AI_confidence
human_confirmed
reviewer_correction

Do not only train on good videos.

Negative / failed warehouse examples are extremely important.