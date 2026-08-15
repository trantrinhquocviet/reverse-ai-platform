I want you to extend the CURRENT video analysis pipeline.

IMPORTANT:
Do NOT redesign or rewrite the whole system.

First inspect the existing implementation and reuse:
- Current video/frame extraction
- Active Parcel detection
- Hand/object interaction
- AWB detection
- OCR
- Product emergence detection
- Product tracking
- Event-driven key frame selection
- Category-specific product analysis
- Human annotation/review
- Existing Supabase structures

The new requirement is:

WAREHOUSE VIDEO QUALITY & PROCESS ERROR DETECTION

The system must evaluate not only WHAT is inside the parcel,
but also whether the warehouse video provides SUFFICIENT,
VALID, and TRACEABLE evidence.


==================================================
1. CORE PRINCIPLE
==================================================

The pipeline should now produce TWO parallel outputs:

VIDEO
 │
 ├── CONTENT ANALYSIS
 │      │
 │      ├── Active Parcel
 │      ├── AWB
 │      ├── Opening
 │      ├── Product Emergence
 │      ├── Product Tracking
 │      ├── Product OCR
 │      ├── Barcode
 │      └── Product / QC Result
 │
 └── WH VIDEO AUDIT
        │
        ├── Video Quality
        ├── AWB Evidence
        ├── Parcel Evidence
        ├── Opening Evidence
        ├── Product Evidence
        ├── Identification Evidence
        ├── Quantity Evidence
        └── Process Integrity


CRITICAL RULE:

"AI cannot detect something"

IS NOT automatically equal to

"Warehouse made an error."

Always distinguish:

1. WAREHOUSE_ERROR
2. AI_UNCERTAIN
3. VALID_VIDEO


==================================================
2. VIDEO LEVEL ERRORS
==================================================

Implement detection for:

VIDEO_TOO_SHORT
Video duration is below configurable minimum threshold.

VIDEO_TOO_LONG
Video duration is above configurable expected threshold.

VIDEO_BLUR
Significant portions of important events are blurry.

VIDEO_TOO_DARK
Important evidence cannot be inspected due to insufficient lighting.

VIDEO_OVEREXPOSED
Important evidence is lost because of excessive exposure.

CAMERA_BLOCKED
Camera/work zone is blocked by hand, object, equipment, etc.

CAMERA_SHAKE
Excessive camera movement affects evidence quality.

WORK_ZONE_OUT_OF_FRAME
The expected working area is not sufficiently visible.

LOW_RESOLUTION
Video resolution is insufficient for required OCR/product inspection.

VIDEO_GAP
Temporal discontinuity or missing sequence exists.

VIDEO_DISCONTINUITY
Unexpected jump in scene/object state occurs.


==================================================
3. AWB / SHIPPING LABEL ERRORS
==================================================

Detect:

AWB_NOT_SHOWN
No valid AWB/shipping label is presented.

AWB_NOT_CLEAR
AWB exists but there is no sufficiently clear frame.

AWB_CODE_NOT_DETECTED
AWB label is detected but tracking code cannot be extracted.

AWB_PARTIALLY_HIDDEN
Important AWB region is occluded.

AWB_TOO_SMALL
AWB occupies insufficient pixels for reliable OCR.

AWB_TOO_FAST
AWB appears but no usable key frame exists.

MULTIPLE_AWB
Multiple labels create ambiguity about the active parcel.

AWB_MISMATCH
Detected tracking/AWB code does not match expected order information.

Important:

Separate:

AWB_NOT_SHOWN

from

AWB_SHOWN_BUT_AI_UNREADABLE.

The second may be an AI/OCR limitation rather than a WH failure.


==================================================
4. ACTIVE PARCEL ERRORS
==================================================

Detect:

ACTIVE_PARCEL_UNCLEAR
System cannot reliably determine which parcel is being processed.

MULTIPLE_ACTIVE_PARCELS
Multiple parcels are simultaneously handled, creating ambiguity.

PARCEL_OUT_OF_FRAME
Active parcel leaves the required camera/work zone.

PARCEL_SWITCH
Operator switches parcel during the same processing sequence.

PARCEL_TRACK_LOST
Parcel identity cannot be maintained across the video.


==================================================
5. OPENING PROCESS ERRORS
==================================================

Detect:

OPENING_NOT_CAPTURED
No visual evidence showing the parcel being opened.

OPENING_PARTIALLY_CAPTURED
Opening process is only partially visible.

VIDEO_GAP_DURING_OPENING
Temporal discontinuity occurs during opening.

PARCEL_ALREADY_OPENED
Video begins after the parcel has already been opened,
when sealed-to-open evidence is required.

OPENING_OUT_OF_FRAME
Parcel is opened outside the visible work zone.


==================================================
6. PRODUCT EVIDENCE ERRORS
==================================================

Detect:

PRODUCT_NOT_DETECTED
No product can be detected after opening.

PRODUCT_NOT_CLEAR
Product exists but there is no sufficiently clear view.

PRODUCT_TOO_FAR
Product ROI is too small for reliable identification.

PRODUCT_TOO_FAST
Operator moves/shows product too quickly and no good key frame exists.

PRODUCT_OCCLUDED
Product is significantly hidden by hands, parcel, packaging, etc.

PRODUCT_OUT_OF_FRAME
Product leaves camera/work zone during required inspection.

PRODUCT_NOT_FULLY_SHOWN
No frame provides sufficient product visibility.

PRODUCT_REMOVAL_NOT_CAPTURED
Product appears but removal from active parcel was not captured.

PRODUCT_SOURCE_UNVERIFIABLE
Cannot establish that the observed product came from the active parcel.

PRODUCT_OVERLAP
Multiple products overlap, preventing reliable identification/counting.

PRODUCT_COUNT_UNVERIFIABLE
Evidence is insufficient to determine unique product quantity.

PRODUCT_IDENTITY_UNVERIFIABLE
Product exists but SKU/product identity cannot be verified.


==================================================
7. PRODUCT IDENTIFICATION ERRORS
==================================================

Detect:

BARCODE_NOT_SHOWN
No product barcode is shown.

BARCODE_UNREADABLE
Barcode is visible but cannot be reliably decoded.

PRODUCT_TEXT_NOT_SHOWN
Required product text is not visible.

PRODUCT_TEXT_UNREADABLE
Text exists but no sufficiently reliable OCR result is available.

SKU_UNVERIFIABLE
SKU cannot be confirmed using barcode/OCR/product/order data.

VARIANT_UNVERIFIABLE
Required variant/size/color/etc. cannot be confirmed.

LOT_UNVERIFIABLE
Required LOT/batch cannot be confirmed.

EXPIRY_UNVERIFIABLE
Required expiry information cannot be confirmed.

Only activate category-specific fields when applicable.

Example:

F&B:
LOT / MFG / EXP

Beauty:
Batch / Shade / EXP / Seal

Electronics:
Model / Serial / IMEI / Accessories


==================================================
8. PROCESS INTEGRITY ERRORS
==================================================

Detect:

WRONG_SEQUENCE
Expected warehouse processing sequence is violated.

OBJECT_TRACK_LOST
System loses temporal association between critical objects.

CRITICAL_EVENT_MISSING
One or more mandatory workflow events are missing.

PROCESS_INCOMPLETE
Video ends before required workflow completion.

MULTIPLE_PARCEL_CONFUSION
Product-to-parcel relationship becomes ambiguous.

PRODUCT_SOURCE_BROKEN
Temporal evidence linking parcel → product is broken.

EVIDENCE_TOO_WEAK
No single critical error may exist, but total evidence is insufficient
to support a reliable conclusion.


==================================================
9. EVENT-BASED ERROR DETECTION
==================================================

Do NOT evaluate only the final video.

Use the existing workflow state machine:

ACTIVE_PARCEL
      ↓
AWB
      ↓
OPENING_START
      ↓
PARCEL_OPENED
      ↓
PRODUCT_FIRST_VISIBLE
      ↓
PRODUCT_REMOVED
      ↓
PRODUCT_PLACED
      ↓
PRODUCT_INSPECTION
      ↓
BARCODE / TEXT
      ↓
PROCESS_COMPLETED

For every expected event determine:

PASS
FAIL
UNCERTAIN
NOT_REQUIRED


Example:

{
  "event": "PRODUCT_REMOVED",
  "status": "FAIL",
  "error_code": "PRODUCT_REMOVAL_NOT_CAPTURED"
}


==================================================
10. EVIDENCE CHECKLIST
==================================================

For each parcel generate:

{
  "parcel_id": 27,

  "evidence": {
    "active_parcel": "PASS",
    "awb_visible": "PASS",
    "awb_readable": "PASS",
    "opening": "PASS",
    "product_emergence": "PASS",
    "product_removed": "PASS",
    "product_full_view": "FAIL",
    "barcode": "WARNING",
    "product_text": "PASS",
    "quantity": "PASS",
    "process_completed": "PASS"
  }
}


==================================================
11. ERROR SEVERITY
==================================================

Every error must have:

INFO
WARNING
CRITICAL

Do NOT hardcode all severity rules inside model prompts.

Create configurable business rules.

Example:

VIDEO_TOO_LONG
→ WARNING

temporary FRAME_BLUR
→ INFO/WARNING

AWB_NOT_SHOWN
→ CRITICAL if AWB evidence is mandatory

PRODUCT_REMOVAL_NOT_CAPTURED
→ CRITICAL

PRODUCT_SOURCE_UNVERIFIABLE
→ CRITICAL

BARCODE_NOT_SHOWN
→ WARNING or CRITICAL depending on category/process.


==================================================
12. ERROR SOURCE ATTRIBUTION
==================================================

Every issue must have:

source:
WAREHOUSE
AI
SYSTEM
UNKNOWN

Example:

Clear barcode exists but AI cannot decode:

source = AI
status = AI_UNCERTAIN

Barcode was never shown:

source = WAREHOUSE
error = BARCODE_NOT_SHOWN

Video corrupted during processing:

source = SYSTEM

Evidence is insufficient to determine cause:

source = UNKNOWN


==================================================
13. DO NOT CONFUSE ABSENCE WITH DETECTION FAILURE
==================================================

This is extremely important.

NO_PRODUCT_DETECTED

must NOT automatically mean:

PRODUCT_MISSING.

Possible causes:

- product truly missing
- product outside frame
- product hidden
- video gap
- product shown too fast
- AI detection failure

Therefore use:

OBSERVATION
+
VIDEO EVIDENCE
+
MODEL CONFIDENCE
+
TEMPORAL CONTEXT

before assigning the final reason.


==================================================
14. VIDEO EVIDENCE SCORE
==================================================

Create an overall VideoEvidenceScore from 0–100.

Suggested components:

Camera Quality
AWB Evidence
Parcel Continuity
Opening Evidence
Product Emergence Evidence
Product Visibility
Product Identification
Quantity Evidence
Process Completeness

Do NOT simply average everything.

Critical evidence should have higher business weight.

Make weights configurable.


==================================================
15. FINAL VIDEO STATUS
==================================================

Support:

PASS
PASS_WITH_WARNING
WH_PROCESS_FAIL
AI_UNCERTAIN
SYSTEM_ERROR
HUMAN_REVIEW_REQUIRED

Example:

{
  "video_status": "WH_PROCESS_FAIL",
  "video_evidence_score": 54,

  "errors": [
    {
      "code": "VIDEO_TOO_LONG",
      "source": "WAREHOUSE",
      "severity": "WARNING",
      "confidence": 0.99
    },

    {
      "code": "AWB_CODE_NOT_DETECTED",
      "source": "WAREHOUSE",
      "severity": "CRITICAL",
      "confidence": 0.91
    },

    {
      "code": "PRODUCT_NOT_CLEAR",
      "source": "WAREHOUSE",
      "severity": "CRITICAL",
      "confidence": 0.94
    }
  ]
}


==================================================
16. ERROR TIMESTAMP + EVIDENCE
==================================================

Every detected error should reference evidence.

Store:

error_code
start_timestamp
end_timestamp
frame_id
best_evidence_frame
related_parcel_id
related_product_id
confidence

Example:

{
  "error_code": "PRODUCT_NOT_CLEAR",

  "start_timestamp": 18.2,
  "end_timestamp": 24.6,

  "parcel_id": 27,
  "product_id": "27-01",

  "evidence_frames": [
    "frame_0451",
    "frame_0478"
  ]
}


==================================================
17. HUMAN REVIEW
==================================================

Human reviewer must be able to:

- Confirm error
- Reject false error
- Change error type
- Change severity
- Change error source
- Adjust timestamp
- Select better evidence frame
- Add missing error

Keep:

AI prediction
vs
Human ground truth

separately.


==================================================
18. TRAINING DATA
==================================================

Warehouse errors should become their own labeled dataset.

Do NOT only collect successful/good videos.

Store both:

GOOD EXAMPLES
and
FAILED EXAMPLES.

Suggested structure:

video_id
warehouse_id
parcel_id
product_id
category
error_code
error_source
severity
start_timestamp
end_timestamp
evidence_frame_ids
ai_confidence
human_confirmed
human_corrected_error
model_name
model_version


==================================================
19. WH ERROR TAXONOMY MUST BE CONFIGURABLE
==================================================

Do not bury error definitions inside Vision prompts.

Create a configuration structure such as:

WH_VIDEO_RULES

Each rule should contain:

error_code
name
description
category
severity
enabled
threshold
required_for_categories
required_event
business_weight

This allows us to change SOP without rewriting the AI pipeline.


==================================================
20. DASHBOARD-READY OUTPUT
==================================================

Design the result so it can later support:

WH Video Pass Rate
WH Process Fail Rate
Video Evidence Score
AWB Detect Rate
AWB OCR Success Rate
Product Detect Rate
Product Identification Rate
Barcode Detect Rate
Product Count Verification Rate

Top WH Errors

Error by:
- Warehouse
- Category
- Brand
- PIC
- Week
- Error Type
- Severity


==================================================
21. IMPLEMENTATION REQUIREMENT
==================================================

Before coding:

STEP 1
Inspect my current project.

STEP 2
Identify existing functions/modules that already handle:
- video sampling
- event detection
- active parcel
- AWB
- OCR
- product detection
- tracking
- annotations
- Supabase
- review UI

STEP 3
Tell me what can be reused.

STEP 4
Propose the SMALLEST architecture change.

STEP 5
List exactly which files/functions/tables need modification.

STEP 6
Implement the changes.

DO NOT rewrite working modules unnecessarily.


==================================================
22. TARGET ARCHITECTURE
==================================================

The final architecture should look like:

                    VIDEO
                      │
              Lightweight Scan
                      │
              Event Detection
                      │
           ┌──────────┴──────────┐
           │                     │
     CONTENT PIPELINE       WH AUDIT PIPELINE
           │                     │
     Active Parcel          Video Quality
           │                     │
          AWB                AWB Evidence
           │                     │
        Opening            Opening Evidence
           │                     │
       Products            Product Evidence
           │                     │
     OCR/Barcode         Process Integrity
           │                     │
           └──────────┬──────────┘
                      │
               Evidence Engine
                      │
              Confidence / Rules
                      │
        ┌─────────────┼─────────────┐
        │             │             │
       PASS       WH PROCESS     AI UNCERTAIN
                      │
                      ▼
                Human Review
                      │
                      ▼
                Ground Truth
                      │
                      ▼
               Training Dataset


FINAL GOAL:

The system should not only say:

"I detected a parcel and product."

It should be able to say:

"The warehouse video is valid / invalid,
WHY it is invalid,
WHEN the problem occurred,
WHICH evidence is missing,
and whether the issue comes from
WAREHOUSE, AI, SYSTEM, or remains UNKNOWN."