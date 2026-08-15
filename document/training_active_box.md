I need you to improve my current video annotation / object detection pipeline.

CONTEXT
The camera is mounted above a warehouse packing/unpacking workstation.

A frame may contain:
- Many cardboard boxes
- Boxes stacked in storage areas
- Boxes waiting to be processed
- One parcel currently being handled by the operator
- Operator hands/arms
- Shipping labels / tracking labels
- Barcode scanner
- Printer and other workstation objects

PROBLEM
Generic "box detection" is NOT useful because there may be 10–30 boxes visible in one frame.

The system must identify ONLY the parcel that the operator is CURRENTLY handling.

Define this object as:

ACTIVE_PARCEL

The goal is NOT:
"Find all cardboard boxes."

The goal is:
"Find the parcel currently being packed, unpacked, opened, inspected, scanned, or physically handled by the operator."


==================================================
1. ACTIVE PARCEL DETECTION
==================================================

For each frame:

Step 1 — Detect parcel candidates
Detect possible parcels/cartons in the workstation.

Do NOT immediately classify every detected carton as ACTIVE_PARCEL.

Step 2 — Detect operator hands/arms
Locate visible hands and arms.

Step 3 — Evaluate interaction
For every parcel candidate calculate how strongly it interacts with the operator.

Important signals:

A. HAND INTERACTION — strongest signal
- Hand touching parcel
- Hand overlapping parcel bounding box
- Two hands surrounding parcel
- Parcel located directly between hands
- Hand following parcel movement

B. MOTION
Compare consecutive frames.

A parcel being:
- lifted
- rotated
- moved
- opened
- repositioned
- scanned

should receive a higher activity score.

Static boxes should receive a very low motion score.

C. WORK ZONE
Define the central workstation/table as the primary processing zone.

Objects inside the active work zone should receive higher priority.

Boxes stacked at the side/top/storage area should receive lower priority.

D. LABEL / PARCEL FEATURES
Shipping label, barcode, tape, parcel shape, etc. may increase confidence that the object is a parcel.

However:

LABEL PRESENCE MUST NOT BE THE PRIMARY SIGNAL.

There may be many visible labels in the background.


==================================================
2. ACTIVE PARCEL SCORE
==================================================

Calculate a score for each parcel candidate.

Starting weights:

ActiveParcelScore =
    0.40 * HandInteractionScore
  + 0.30 * MotionScore
  + 0.20 * WorkZoneScore
  + 0.10 * ParcelLabelScore

Weights may be tuned based on testing.

The highest scoring candidate becomes ACTIVE_PARCEL only when confidence is above a threshold.

Example:

Candidate A:
hand = 0.95
motion = 0.90
work_zone = 0.95
label = 0.80

=> likely ACTIVE_PARCEL

Candidate B:
hand = 0.05
motion = 0.00
work_zone = 0.20
label = 0.90

=> background parcel, IGNORE.


==================================================
3. TEMPORAL TRACKING — VERY IMPORTANT
==================================================

Do NOT make the final decision using only one frame.

Track parcel candidates across consecutive video frames.

Maintain an:

active_parcel_id

Example:

Frame 100 → parcel #7 near hands
Frame 101 → parcel #7 moves with hands
Frame 102 → parcel #7 rotates
Frame 103 → operator opens parcel #7

Therefore:

active_parcel_id = 7

Keep the same ACTIVE_PARCEL ID until there is strong evidence that the operator has finished processing it.

Do not switch active parcel because of temporary hand occlusion.


==================================================
4. STATE MACHINE
==================================================

Implement a simple state machine if useful:

NO_ACTIVE_PARCEL
        ↓
PARCEL_APPROACH
        ↓
PARCEL_HANDLED
        ↓
ACTIVE_PARCEL_LOCKED
        ↓
PACKING / UNPACKING / SCANNING / INSPECTION
        ↓
PARCEL_RELEASED
        ↓
NO_ACTIVE_PARCEL

Use temporal persistence to avoid flickering between objects.


==================================================
5. BACKGROUND BOX SUPPRESSION
==================================================

Explicitly suppress boxes that:

- remain static for many frames
- are stacked with other cartons
- are outside the active workstation
- have no hand interaction
- are only partially visible at frame edges
- remain in approximately the same coordinates over time

Create a concept such as:

STATIC_BACKGROUND_OBJECT

Once an object remains static long enough, reduce its probability of becoming ACTIVE_PARCEL unless new hand interaction occurs.


==================================================
6. BOUNDING BOX OUTPUT
==================================================

Once ACTIVE_PARCEL is confirmed, return ONLY its bounding box.

Required output:

{
  "active_parcel": true,
  "track_id": 7,
  "bbox": {
    "x1": ...,
    "y1": ...,
    "x2": ...,
    "y2": ...
  },
  "confidence": 0.94,
  "signals": {
    "hand_interaction": 0.96,
    "motion": 0.91,
    "work_zone": 0.93,
    "parcel_label": 0.75
  }
}

If no parcel is actively being handled:

{
  "active_parcel": false
}

Do NOT force a bounding box when confidence is low.


==================================================
7. OCR PIPELINE
==================================================

CRITICAL:

DO NOT perform OCR on the entire camera frame.

Pipeline must be:

VIDEO FRAME
    ↓
ACTIVE PARCEL DETECTION
    ↓
ACTIVE PARCEL TRACKING
    ↓
CROP ACTIVE PARCEL
    ↓
LABEL / BARCODE DETECTION
    ↓
CROP LABEL
    ↓
OCR
    ↓
TRACKING CODE VALIDATION

This prevents OCR from reading labels from background boxes.


==================================================
8. MULTI-FRAME OCR
==================================================

Do not OCR every frame.

For each active_parcel_id:

Collect multiple candidate frames.

Score image quality using:
- blur
- label visibility
- label size
- viewing angle
- obstruction
- OCR confidence

Select the BEST FRAME for OCR.

Example:

parcel #7

frame 101 → blurred
frame 105 → hand covering label
frame 109 → clear label
frame 112 → rotated

Use frame 109 for OCR.


==================================================
9. IMPORTANT EDGE CASES
==================================================

Handle:

1. Operator temporarily removes one hand.
2. Both hands temporarily leave the parcel.
3. Parcel rotates and bounding box changes.
4. Parcel is partially occluded.
5. Operator grabs tape/scanner while parcel remains active.
6. Another box enters the work zone.
7. Several boxes are close together.
8. Operator finishes one parcel and immediately grabs another.
9. Active parcel is opened and its appearance changes.
10. Product is removed from inside the parcel.

Do not change active_parcel_id too aggressively.


==================================================
10. IMPLEMENTATION GOAL
==================================================

Please inspect my CURRENT implementation first.

Do not rewrite the whole application unnecessarily.

Identify:

1. Current frame extraction logic
2. Current object detection logic
3. Current AI/Vision prompts
4. Current annotation structure
5. Current Supabase schema
6. Current review UI
7. Where ACTIVE_PARCEL detection should be inserted

Then propose the smallest practical architecture change.

Preferred architecture:

Browser / Video
      ↓
Frame Sampling
      ↓
Hand Detection
      ↓
Parcel Candidate Detection
      ↓
Object Tracking
      ↓
Active Parcel Scoring
      ↓
ACTIVE PARCEL LOCK
      ↓
Best Frame Selection
      ↓
Crop Parcel
      ↓
AI Vision
      ↓
Label / Barcode / Product / QC Analysis
      ↓
Supabase Annotation
      ↓
Human Review

IMPORTANT:
Use deterministic CV/tracking where possible.

Do NOT depend entirely on an LLM/Vision model to determine ACTIVE_PARCEL independently on every frame.

The LLM/Vision model should mainly analyze the selected/cropped active parcel after tracking has identified it.

Start by reviewing my existing code and tell me:
- what can be reused
- what needs modification
- which files/functions need modification
- proposed data structures
- proposed algorithm
- then implement the changes.