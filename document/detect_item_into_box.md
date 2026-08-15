==================================================
24. ACTIVE PARCEL → OPENING → PRODUCT DETECTION
==================================================

Extend the existing pipeline beyond ACTIVE_PARCEL and AWB detection.

The warehouse workflow is:

PARCEL
   ↓
AWB / LABEL
   ↓
PARCEL OPENING
   ↓
PRODUCT REVEALED
   ↓
PRODUCT REMOVED
   ↓
PRODUCT INSPECTION
   ↓
PRODUCT COUNT / IDENTIFICATION / QC


The system must understand that after the parcel is opened,
the main object of interest may transition from the OUTER PARCEL
to the PRODUCT(S) inside it.


==================================================
25. PARCEL STATE
==================================================

Maintain parcel state across the video:

PARCEL_RECEIVED
→ PARCEL_HANDLED
→ PARCEL_OPENING
→ PARCEL_OPENED
→ PRODUCT_VISIBLE
→ PRODUCT_REMOVED
→ PRODUCT_INSPECTION
→ PROCESS_COMPLETED

Do NOT treat each frame independently.

Store:

{
  "active_parcel_id": 7,
  "parcel_state": "PRODUCT_REMOVED"
}


==================================================
26. DETECT PRODUCT EMERGENCE
==================================================

Once active parcel state becomes:

PARCEL_OPENING
or
PARCEL_OPENED

start looking for NEW OBJECTS associated with the parcel.

A PRODUCT candidate should receive a higher score when:

1. It was previously inside / occluded by the parcel.
2. It appears immediately after parcel opening.
3. Operator's hand removes it from the parcel.
4. It moves together with the operator's hand.
5. It is placed into the inspection/work zone.
6. It has retail packaging.
7. It contains product text / barcode / SKU information.

Temporal evidence is extremely important.

Example:

Frame 200:
closed parcel

Frame 210:
parcel opened

Frame 220:
hand reaches inside

Frame 225:
new object appears

Frame 230:
hand moves new object away from parcel

Frame 235:
object placed on table

Therefore:

new object = PRODUCT_FROM_PARCEL


==================================================
27. PRODUCT ASSOCIATION
==================================================

Do NOT simply detect every object on the table.

We need to answer:

"Did this object come from the current ACTIVE_PARCEL?"

Maintain relationship:

active_parcel_id
        ↓
product_id

Example:

{
  "active_parcel_id": 7,

  "products": [
    {
      "product_id": 1,
      "source_parcel_id": 7,
      "confidence": 0.96
    }
  ]
}

This relationship is critical.

There may already be unrelated objects on the workstation.


==================================================
28. PRODUCT CANDIDATE SCORE
==================================================

Calculate:

ProductFromParcelScore =
    0.30 * EmergenceFromParcel
  + 0.25 * HandTransfer
  + 0.20 * TemporalAssociation
  + 0.15 * WorkZonePlacement
  + 0.10 * ProductAppearance

The strongest signals are:

EMERGENCE FROM PARCEL
+
HAND TRANSFER
+
TEMPORAL CONTINUITY

Do NOT rely primarily on product appearance.


==================================================
29. PRODUCT TRACKING
==================================================

Assign persistent IDs:

product_id = 1
product_id = 2
product_id = 3
...

Track products after removal.

Do NOT create a new product_id every time the same product:
- rotates
- is picked up again
- is flipped
- is inspected
- temporarily disappears behind a hand


==================================================
30. MULTIPLE PRODUCTS
==================================================

A parcel may contain:

1 product
or
multiple products.

Example:

PARCEL #7
   ├── PRODUCT #1
   ├── PRODUCT #2
   └── PRODUCT #3

Count UNIQUE product tracks.

Do NOT count detections per frame.

Wrong:

Frame 1 → product
Frame 2 → product
Frame 3 → product

Product count = 3

Correct:

Same tracked object across frames:

product_id = 1

Product count = 1


==================================================
31. PRODUCT ROI
==================================================

Once a product is confirmed:

Create:

PRODUCT_ROI

Then analyze ONLY the product crop.

ACTIVE PARCEL
      ↓
PRODUCT REMOVED
      ↓
PRODUCT TRACK
      ↓
PRODUCT ROI
      ↓
┌─────────────────────┐
│ Product packaging   │
│ Product text        │
│ Barcode             │
│ SKU information     │
│ Quantity            │
│ Visible condition   │
└─────────────────────┘


==================================================
32. PRODUCT TEXT DETECTION
==================================================

Inside PRODUCT_ROI:

Detect ALL visible text regions.

Possible information:

- Brand
- Product name
- SKU
- Model
- Variant
- Size
- Color
- Quantity
- Batch / LOT
- Manufacturing date
- Expiry date
- Barcode text
- Serial number
- Other visible text

Again:

TEXT DETECTION
→ TEXT CROP
→ OCR

Do NOT OCR the full frame.


==================================================
33. PRODUCT BARCODE DETECTION
==================================================

Search for:

- EAN
- UPC
- Code128
- QR
- DataMatrix
- other supported barcodes

Decode barcode independently from OCR.

Store:

{
  "product_id": 1,

  "barcode": {
    "value": "...",
    "type": "...",
    "confidence": ...
  }
}

Barcode is a strong product identity signal.


==================================================
34. MULTI-VIEW PRODUCT RECOGNITION
==================================================

VERY IMPORTANT:

During inspection, the operator may rotate the product.

Do not treat rotation as a problem.

Use it to improve recognition.

Example:

Frame 250 → front
Frame 260 → side
Frame 270 → back
Frame 280 → barcode visible

Associate all views with:

product_id = 1

Combine information:

FRONT
→ Brand + Product Name

SIDE
→ Variant / Size

BACK
→ Barcode + SKU

Then create one consolidated product record.


==================================================
35. BEST FRAME PER ATTRIBUTE
==================================================

Do NOT select only one "best product frame".

Different frames may be best for different information.

Example:

product_id = 1

best_front_frame = 250
best_barcode_frame = 280
best_expiry_frame = 275
best_damage_frame = 265

Use the best evidence for each attribute.


==================================================
36. PRODUCT VS NON-PRODUCT FILTER
==================================================

Explicitly classify workstation objects.

Possible classes:

PRODUCT
PARCEL
AWB
HAND
SCANNER
PRINTER
PAPER
PACKAGING_MATERIAL
TOOL
BACKGROUND_OBJECT
UNKNOWN

Do NOT classify an object as PRODUCT simply because it moved.

Example:

Operator grabs scanner
→ NOT PRODUCT

Operator removes packing paper
→ NOT PRODUCT

Operator removes AWB
→ NOT PRODUCT

Operator removes retail packaged item from parcel
→ likely PRODUCT


==================================================
37. PRODUCT EVENT DETECTION
==================================================

Create events:

PARCEL_OPENED
PRODUCT_REMOVED
PRODUCT_PLACED
PRODUCT_PICKED_UP
PRODUCT_ROTATED
PRODUCT_SCANNED
PRODUCT_INSPECTED
PRODUCT_RETURNED
PROCESS_COMPLETED

Example:

{
  "timestamp": "14:30:30",
  "event": "PRODUCT_PLACED",
  "product_id": 1,
  "active_parcel_id": 7
}


==================================================
38. HUMAN REVIEW / TRAINING
==================================================

Human reviewer should be able to correct:

- product bounding box
- product/non-product classification
- product_id
- source parcel
- product count
- barcode
- SKU
- product name
- OCR
- event type

Store AI prediction separately from human ground truth.

Approved examples become future training data.


==================================================
39. FINAL PIPELINE
==================================================

The complete architecture should now become:

VIDEO
 │
 ▼
FRAME SAMPLING
 │
 ▼
HAND + MOTION
 │
 ▼
ACTIVE PARCEL
 │
 ├───────────────┐
 │               │
 ▼               ▼
AWB             PARCEL STATE
 │               │
 ▼               ▼
TEXT/OCR      OPENING DETECTION
                 │
                 ▼
          PRODUCT EMERGENCE
                 │
                 ▼
          PRODUCT TRACKING
                 │
        ┌────────┼─────────┐
        ▼        ▼         ▼
     PRODUCT1 PRODUCT2  PRODUCT3
        │
        ▼
    PRODUCT ROI
        │
   ┌────┼─────────────┐
   ▼    ▼             ▼
 TEXT BARCODE      VISUAL
   │    │             │
   └────┼─────────────┘
        ▼
 PRODUCT IDENTITY
        │
        ▼
 HUMAN REVIEW
        │
        ▼
 TRAINING DATA


==================================================
40. MOST IMPORTANT RULE
==================================================

Do NOT ask:

"What products exist in this frame?"

Ask:

"Which new object was physically removed from ACTIVE_PARCEL
and should therefore become a PRODUCT track?"

Temporal relationship is more important than single-frame
visual classification.