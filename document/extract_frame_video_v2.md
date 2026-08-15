==================================================
41. EVENT-DRIVEN FRAME EXTRACTION
==================================================

Replace simple fixed-interval frame extraction with
EVENT-DRIVEN KEY FRAME SELECTION.

IMPORTANT:

Do NOT send every sampled frame to AI Vision.

Use two levels:

LEVEL 1 — VIDEO MONITORING
Use relatively frequent lightweight frame sampling / CV
to detect:
- motion
- hand movement
- object appearance/disappearance
- scene changes
- active parcel movement

Example monitoring rate:
2–5 FPS initially, configurable.

LEVEL 2 — AI KEY FRAME ANALYSIS
Only send selected high-value frames to expensive
Vision/OCR models.


==================================================
42. KEY FRAME EVENTS
==================================================

Create key frames when these events occur:

PARCEL_ENTER
ACTIVE_PARCEL_LOCKED

AWB_VISIBLE
AWB_BEST_VIEW

OPENING_START
PARCEL_OPENED

PRODUCT_FIRST_VISIBLE
PRODUCT_REMOVED
PRODUCT_PLACED

PRODUCT_FRONT_VISIBLE
PRODUCT_BACK_VISIBLE
PRODUCT_ROTATED

BARCODE_VISIBLE
BARCODE_BEST_VIEW

PRODUCT_TEXT_VISIBLE
PRODUCT_TEXT_BEST_VIEW

QC_INSPECTION

PROCESS_COMPLETED


==================================================
43. PRE-EVENT / POST-EVENT BUFFER
==================================================

When an important event is detected, do not save only
the exact detection frame.

Maintain a small rolling frame buffer.

For example:

EVENT detected at T

Consider frames:

T - 2 sec
T - 1 sec
T
T + 1 sec
T + 2 sec

Then select the best frame(s).

This is especially important for:

PRODUCT_REMOVED

because the exact detection frame may contain:
- hand occlusion
- motion blur
- partial product visibility.


==================================================
44. KEY FRAME QUALITY SCORE
==================================================

For every candidate key frame calculate:

KeyFrameScore =
    Sharpness
  + ObjectVisibility
  + ObjectSize
  + LowOcclusion
  + LowMotionBlur
  + GoodPerspective
  + TextVisibility

Different events should use different scoring weights.

For AWB_BEST_VIEW:

prioritize:
TEXT SHARPNESS
+ LABEL SIZE
+ LOW PERSPECTIVE DISTORTION

For PRODUCT_EMERGENCE:

prioritize:
PARCEL ↔ HAND ↔ PRODUCT relationship

For BARCODE_BEST_VIEW:

prioritize:
BARCODE SIZE
+ SHARPNESS
+ LOW BLUR
+ LOW OCCLUSION


==================================================
45. KEEP EVENT TIMELINE
==================================================

Create an event timeline for every parcel:

parcel_id = 27

00:03 ACTIVE_PARCEL_LOCKED
00:05 AWB_VISIBLE
00:06 AWB_BEST_VIEW
00:11 OPENING_START
00:14 PARCEL_OPENED
00:16 PRODUCT_FIRST_VISIBLE
00:17 PRODUCT_REMOVED
00:19 PRODUCT_PLACED
00:22 PRODUCT_FRONT_VISIBLE
00:26 PRODUCT_ROTATED
00:28 BARCODE_BEST_VIEW
00:34 PROCESS_COMPLETED


Each event should reference:

{
  "event_type": "...",
  "timestamp": ...,
  "frame_id": ...,
  "parcel_id": ...,
  "product_id": ...,
  "confidence": ...,
  "quality_score": ...
}


==================================================
46. FRAME DEDUPLICATION
==================================================

Do NOT store many visually identical frames.

If consecutive frames contain:

same parcel
same product
same orientation
same information

keep only the highest-quality frame.

The objective is:

MINIMUM NUMBER OF FRAMES
+
MAXIMUM INFORMATION COVERAGE.


==================================================
47. FINAL VIDEO ANALYSIS STRATEGY
==================================================

Do NOT use:

VIDEO
→ extract every 10 seconds
→ Vision
→ hope important events are captured.

Use:

VIDEO
→ lightweight continuous sampling
→ motion / hands / object tracking
→ workflow state machine
→ event detection
→ rolling frame buffer
→ key frame selection
→ ROI crop
→ Vision / OCR
→ multi-frame validation
→ event timeline.