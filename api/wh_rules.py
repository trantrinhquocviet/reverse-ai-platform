"""
WH_VIDEO_RULES — configurable warehouse video error taxonomy.
Decoupled from AI prompts so SOP changes don't require rewriting the pipeline.
"""

from __future__ import annotations
from typing import Literal

# ── Types ──────────────────────────────────────────────────────────────────────
Severity = Literal["INFO", "WARNING", "CRITICAL"]
ErrorSource = Literal["WAREHOUSE", "AI", "SYSTEM", "UNKNOWN"]
Category = Literal[
    "VIDEO_QUALITY", "AWB_EVIDENCE", "PARCEL_EVIDENCE",
    "OPENING_EVIDENCE", "PRODUCT_EVIDENCE", "IDENTIFICATION_EVIDENCE",
    "QUANTITY_EVIDENCE", "PROCESS_INTEGRITY",
]


class WHRule:
    def __init__(
        self,
        error_code: str,
        name: str,
        description: str,
        category: Category,
        default_severity: Severity,
        default_source: ErrorSource,
        enabled: bool = True,
        business_weight: float = 1.0,          # contribution to VideoEvidenceScore penalty
        required_for_categories: list[str] | None = None,
        required_event: str | None = None,
    ):
        self.error_code = error_code
        self.name = name
        self.description = description
        self.category = category
        self.default_severity = default_severity
        self.default_source = default_source
        self.enabled = enabled
        self.business_weight = business_weight
        self.required_for_categories = required_for_categories or []
        self.required_event = required_event

    def to_dict(self) -> dict:
        return {
            "error_code": self.error_code,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "default_severity": self.default_severity,
            "default_source": self.default_source,
            "enabled": self.enabled,
            "business_weight": self.business_weight,
        }


# ── Rule Definitions ───────────────────────────────────────────────────────────
WH_VIDEO_RULES: list[WHRule] = [

    # ── Video Quality ──────────────────────────────────────────────────────────
    WHRule("VIDEO_TOO_SHORT",       "Video too short",        "Duration below minimum threshold",                          "VIDEO_QUALITY",         "WARNING",  "WAREHOUSE", business_weight=0.5),
    WHRule("VIDEO_TOO_LONG",        "Video too long",         "Duration above expected threshold",                         "VIDEO_QUALITY",         "WARNING",  "WAREHOUSE", business_weight=0.3),
    WHRule("VIDEO_BLUR",            "Video blur",             "Significant portions of important events are blurry",       "VIDEO_QUALITY",         "WARNING",  "WAREHOUSE", business_weight=1.0),
    WHRule("FRAME_BLUR",            "Frame blur",             "Individual frame is blurry/out-of-focus",                   "VIDEO_QUALITY",         "INFO",     "WAREHOUSE", business_weight=0.4),
    WHRule("VIDEO_TOO_DARK",        "Too dark",               "Insufficient lighting, evidence cannot be inspected",       "VIDEO_QUALITY",         "CRITICAL", "WAREHOUSE", business_weight=1.5),
    WHRule("VIDEO_OVEREXPOSED",     "Overexposed",            "Excessive exposure loses evidence detail",                  "VIDEO_QUALITY",         "WARNING",  "WAREHOUSE", business_weight=1.0),
    WHRule("CAMERA_BLOCKED",        "Camera blocked",         "Camera or work zone blocked by hand/object",                "VIDEO_QUALITY",         "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("CAMERA_SHAKE",          "Camera shake",           "Excessive camera movement affects evidence quality",        "VIDEO_QUALITY",         "WARNING",  "WAREHOUSE", business_weight=0.8),
    WHRule("WORK_ZONE_OUT_OF_FRAME","Work zone out of frame", "Expected work area is not sufficiently visible",            "VIDEO_QUALITY",         "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("LOW_RESOLUTION",        "Low resolution",         "Resolution insufficient for OCR/product inspection",        "VIDEO_QUALITY",         "WARNING",  "SYSTEM",    business_weight=1.0),
    WHRule("VIDEO_GAP",             "Video gap",              "Temporal discontinuity or missing sequence",                "VIDEO_QUALITY",         "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("VIDEO_DISCONTINUITY",   "Video discontinuity",    "Unexpected jump in scene/object state",                     "VIDEO_QUALITY",         "WARNING",  "WAREHOUSE", business_weight=1.0),

    # ── AWB / Shipping Label Evidence ─────────────────────────────────────────
    WHRule("AWB_NOT_SHOWN",         "AWB not shown",          "No valid AWB/shipping label is presented",                  "AWB_EVIDENCE",          "CRITICAL", "WAREHOUSE", business_weight=3.0),
    WHRule("AWB_NOT_CLEAR",         "AWB not clear",          "AWB exists but no sufficiently clear frame",                "AWB_EVIDENCE",          "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("AWB_CODE_NOT_DETECTED", "AWB code undetected",    "Label detected but tracking code cannot be extracted",      "AWB_EVIDENCE",          "CRITICAL", "WAREHOUSE", business_weight=2.5),
    WHRule("AWB_SHOWN_BUT_AI_UNREADABLE", "AWB AI unreadable","AWB is clear but AI/OCR cannot decode — AI limitation",    "AWB_EVIDENCE",          "WARNING",  "AI",        business_weight=1.0),
    WHRule("AWB_PARTIALLY_HIDDEN",  "AWB partially hidden",   "Important AWB region is occluded",                          "AWB_EVIDENCE",          "WARNING",  "WAREHOUSE", business_weight=1.5),
    WHRule("AWB_TOO_SMALL",         "AWB too small",          "AWB occupies insufficient pixels for reliable OCR",         "AWB_EVIDENCE",          "WARNING",  "WAREHOUSE", business_weight=1.0),
    WHRule("AWB_TOO_FAST",          "AWB too fast",           "AWB visible but no usable key frame captured",              "AWB_EVIDENCE",          "WARNING",  "WAREHOUSE", business_weight=1.5),
    WHRule("MULTIPLE_AWB",          "Multiple AWB",           "Multiple labels create ambiguity about active parcel",      "AWB_EVIDENCE",          "WARNING",  "WAREHOUSE", business_weight=1.0),
    WHRule("AWB_MISMATCH",          "AWB mismatch",           "Detected tracking code does not match expected order",      "AWB_EVIDENCE",          "CRITICAL", "WAREHOUSE", business_weight=3.0),

    # ── Parcel Evidence ───────────────────────────────────────────────────────
    WHRule("ACTIVE_PARCEL_UNCLEAR", "Active parcel unclear",  "Cannot determine which parcel is being processed",          "PARCEL_EVIDENCE",       "CRITICAL", "UNKNOWN",   business_weight=2.5),
    WHRule("MULTIPLE_ACTIVE_PARCELS","Multiple active parcels","Multiple parcels simultaneously handled — ambiguous",      "PARCEL_EVIDENCE",       "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("PARCEL_OUT_OF_FRAME",   "Parcel out of frame",    "Active parcel leaves the required camera/work zone",        "PARCEL_EVIDENCE",       "WARNING",  "WAREHOUSE", business_weight=1.5),
    WHRule("PARCEL_SWITCH",         "Parcel switch",          "Operator switches parcel during processing sequence",       "PARCEL_EVIDENCE",       "CRITICAL", "WAREHOUSE", business_weight=3.0),
    WHRule("PARCEL_TRACK_LOST",     "Parcel track lost",      "Parcel identity cannot be maintained across video",         "PARCEL_EVIDENCE",       "CRITICAL", "UNKNOWN",   business_weight=2.0),

    # ── Opening Evidence ──────────────────────────────────────────────────────
    WHRule("OPENING_NOT_CAPTURED",      "Opening not captured",     "No visual evidence of parcel being opened",           "OPENING_EVIDENCE",      "CRITICAL", "WAREHOUSE", business_weight=3.0, required_event="PARCEL_OPENED"),
    WHRule("OPENING_PARTIALLY_CAPTURED","Opening partial",          "Opening process only partially visible",              "OPENING_EVIDENCE",      "WARNING",  "WAREHOUSE", business_weight=1.5),
    WHRule("VIDEO_GAP_DURING_OPENING",  "Gap during opening",       "Temporal discontinuity occurs during opening",        "OPENING_EVIDENCE",      "CRITICAL", "WAREHOUSE", business_weight=2.5),
    WHRule("PARCEL_ALREADY_OPENED",     "Parcel already opened",    "Video begins after parcel already opened",            "OPENING_EVIDENCE",      "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("OPENING_OUT_OF_FRAME",      "Opening out of frame",     "Parcel opened outside visible work zone",             "OPENING_EVIDENCE",      "CRITICAL", "WAREHOUSE", business_weight=2.0),

    # ── Product Evidence ──────────────────────────────────────────────────────
    WHRule("PRODUCT_NOT_DETECTED",      "Product not detected",     "No product detected after opening (may be AI or WH)", "PRODUCT_EVIDENCE",      "WARNING",  "UNKNOWN",   business_weight=2.0),
    WHRule("PRODUCT_NOT_CLEAR",         "Product not clear",        "Product exists but no sufficiently clear view",       "PRODUCT_EVIDENCE",      "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("PRODUCT_TOO_FAR",           "Product too far",          "Product ROI too small for reliable identification",   "PRODUCT_EVIDENCE",      "WARNING",  "WAREHOUSE", business_weight=1.0),
    WHRule("PRODUCT_TOO_FAST",          "Product too fast",         "Product shown too quickly, no good key frame",        "PRODUCT_EVIDENCE",      "WARNING",  "WAREHOUSE", business_weight=1.5),
    WHRule("PRODUCT_OCCLUDED",          "Product occluded",         "Product hidden by hands, parcel, or packaging",       "PRODUCT_EVIDENCE",      "WARNING",  "WAREHOUSE", business_weight=1.5),
    WHRule("PRODUCT_OUT_OF_FRAME",      "Product out of frame",     "Product leaves camera during required inspection",    "PRODUCT_EVIDENCE",      "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("PRODUCT_NOT_FULLY_SHOWN",   "Product not fully shown",  "No frame provides sufficient product visibility",     "PRODUCT_EVIDENCE",      "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("PRODUCT_REMOVAL_NOT_CAPTURED","Removal not captured",   "Product appears but removal not captured",            "PRODUCT_EVIDENCE",      "CRITICAL", "WAREHOUSE", business_weight=3.0, required_event="PRODUCT_REMOVED"),
    WHRule("PRODUCT_SOURCE_UNVERIFIABLE","Product source unknown",  "Cannot establish product came from active parcel",    "PRODUCT_EVIDENCE",      "CRITICAL", "WAREHOUSE", business_weight=3.0),
    WHRule("PRODUCT_OVERLAP",           "Product overlap",          "Products overlap, preventing identification/count",   "PRODUCT_EVIDENCE",      "WARNING",  "WAREHOUSE", business_weight=1.5),
    WHRule("PRODUCT_COUNT_UNVERIFIABLE","Count unverifiable",       "Insufficient evidence to determine product quantity", "QUANTITY_EVIDENCE",     "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("PRODUCT_IDENTITY_UNVERIFIABLE","Identity unverifiable", "Product exists but SKU cannot be verified",           "PRODUCT_EVIDENCE",      "CRITICAL", "UNKNOWN",   business_weight=2.5),

    # ── Identification Evidence ───────────────────────────────────────────────
    WHRule("BARCODE_NOT_SHOWN",     "Barcode not shown",      "No product barcode is shown",                               "IDENTIFICATION_EVIDENCE","WARNING", "WAREHOUSE", business_weight=1.5),
    WHRule("BARCODE_UNREADABLE",    "Barcode unreadable",     "Barcode visible but cannot be reliably decoded",            "IDENTIFICATION_EVIDENCE","WARNING", "UNKNOWN",   business_weight=1.5),
    WHRule("PRODUCT_TEXT_NOT_SHOWN","Text not shown",         "Required product text is not visible",                      "IDENTIFICATION_EVIDENCE","WARNING", "WAREHOUSE", business_weight=1.0),
    WHRule("PRODUCT_TEXT_UNREADABLE","Text unreadable",       "Text visible but no reliable OCR result",                   "IDENTIFICATION_EVIDENCE","WARNING", "UNKNOWN",   business_weight=1.0),
    WHRule("SKU_UNVERIFIABLE",      "SKU unverifiable",       "SKU cannot be confirmed via barcode/OCR/order",             "IDENTIFICATION_EVIDENCE","CRITICAL","UNKNOWN",   business_weight=2.5),
    WHRule("VARIANT_UNVERIFIABLE",  "Variant unverifiable",   "Required variant/size/color cannot be confirmed",           "IDENTIFICATION_EVIDENCE","WARNING", "UNKNOWN",   business_weight=1.5),
    WHRule("LOT_UNVERIFIABLE",      "LOT unverifiable",       "Required LOT/batch cannot be confirmed",                    "IDENTIFICATION_EVIDENCE","WARNING", "UNKNOWN",   business_weight=1.5),
    WHRule("EXPIRY_UNVERIFIABLE",   "Expiry unverifiable",    "Required expiry information cannot be confirmed",           "IDENTIFICATION_EVIDENCE","CRITICAL","WAREHOUSE", business_weight=2.0),

    # ── Process Integrity ─────────────────────────────────────────────────────
    WHRule("WRONG_SEQUENCE",        "Wrong sequence",         "Expected warehouse processing sequence is violated",        "PROCESS_INTEGRITY",     "CRITICAL", "WAREHOUSE", business_weight=3.0),
    WHRule("OBJECT_TRACK_LOST",     "Object track lost",      "Temporal association between critical objects lost",        "PROCESS_INTEGRITY",     "WARNING",  "UNKNOWN",   business_weight=2.0),
    WHRule("CRITICAL_EVENT_MISSING","Critical event missing", "One or more mandatory workflow events are missing",         "PROCESS_INTEGRITY",     "CRITICAL", "WAREHOUSE", business_weight=3.0),
    WHRule("PROCESS_INCOMPLETE",    "Process incomplete",     "Video ends before required workflow completion",            "PROCESS_INTEGRITY",     "CRITICAL", "WAREHOUSE", business_weight=2.0),
    WHRule("MULTIPLE_PARCEL_CONFUSION","Multiple parcel confusion","Product-to-parcel relationship ambiguous",             "PROCESS_INTEGRITY",     "CRITICAL", "UNKNOWN",   business_weight=2.5),
    WHRule("PRODUCT_SOURCE_BROKEN", "Product source broken",  "Temporal evidence linking parcel→product is broken",       "PROCESS_INTEGRITY",     "CRITICAL", "WAREHOUSE", business_weight=3.0),
    WHRule("EVIDENCE_TOO_WEAK",     "Evidence too weak",      "No single critical error but total evidence insufficient", "PROCESS_INTEGRITY",     "WARNING",  "UNKNOWN",   business_weight=1.5),
]

# Fast lookup
RULES_BY_CODE: dict[str, WHRule] = {r.error_code: r for r in WH_VIDEO_RULES}

# ── Evidence Score Weights ─────────────────────────────────────────────────────
# These drive VideoEvidenceScore calculation — tune per business SOP
EVIDENCE_SCORE_WEIGHTS: dict[str, float] = {
    "camera_quality":         0.10,
    "awb_visibility":         0.20,  # high: AWB is critical for order verification
    "parcel_continuity":      0.10,
    "opening_evidence":       0.15,
    "product_emergence":      0.15,
    "product_visibility":     0.15,
    "identification_evidence":0.10,
    "quantity_evidence":      0.05,
}

# ── Video Duration Thresholds ─────────────────────────────────────────────────
VIDEO_MIN_DURATION_SECONDS = 10    # shorter → VIDEO_TOO_SHORT
VIDEO_MAX_DURATION_SECONDS = 600   # longer  → VIDEO_TOO_LONG

# ── Resolution Thresholds ─────────────────────────────────────────────────────
VIDEO_MIN_WIDTH_PIXELS = 640       # narrower → LOW_RESOLUTION

# ── Workflow Steps for event_audit ────────────────────────────────────────────
WORKFLOW_STEPS = [
    "active_parcel",
    "awb_visible",
    "awb_readable",
    "opening",
    "product_emergence",
    "product_removed",
    "product_full_view",
    "barcode",
    "product_text",
    "quantity",
    "process_completed",
]

WORKFLOW_STEP_WEIGHTS: dict[str, float] = {
    "active_parcel":      1.0,
    "awb_visible":        2.0,
    "awb_readable":       2.0,
    "opening":            2.0,
    "product_emergence":  2.0,
    "product_removed":    2.0,
    "product_full_view":  1.5,
    "barcode":            1.5,
    "product_text":       1.0,
    "quantity":           1.0,
    "process_completed":  1.0,
}


def compute_evidence_score(quality_components: dict, wh_errors: list[dict]) -> int:
    """
    Calculate VideoEvidenceScore 0–100 using component weights,
    then deduct penalty for each error proportional to business_weight.
    """
    base = sum(
        quality_components.get(k, 0.5) * w
        for k, w in EVIDENCE_SCORE_WEIGHTS.items()
    )
    base = base / sum(EVIDENCE_SCORE_WEIGHTS.values())  # normalize to 0-1

    penalty = 0.0
    for err in wh_errors:
        rule = RULES_BY_CODE.get(err.get("error_code", ""))
        if not rule:
            continue
        sev_mult = {"CRITICAL": 0.12, "WARNING": 0.05, "INFO": 0.01}[rule.default_severity]
        penalty += sev_mult * rule.business_weight * err.get("confidence", 0.8)

    score = max(0, min(100, int((base - penalty) * 100)))
    return score


def determine_case_status(
    wh_errors: list[dict],
    video_evidence_score: int,
    event_audit: dict,
) -> str:
    """
    PASS / PASS_WITH_WARNING / WH_PROCESS_FAIL / AI_UNCERTAIN / SYSTEM_ERROR / HUMAN_REVIEW_REQUIRED
    """
    critical_wh = [e for e in wh_errors if e.get("severity") == "CRITICAL" and e.get("source") == "WAREHOUSE"]
    critical_ai = [e for e in wh_errors if e.get("severity") == "CRITICAL" and e.get("source") == "AI"]
    system_errs = [e for e in wh_errors if e.get("source") == "SYSTEM"]
    warnings = [e for e in wh_errors if e.get("severity") == "WARNING"]

    if system_errs:
        return "SYSTEM_ERROR"
    if critical_wh and all(e.get("confidence", 0) >= 0.85 for e in critical_wh):
        return "WH_PROCESS_FAIL"
    if critical_ai:
        return "AI_UNCERTAIN"
    if critical_wh:
        return "HUMAN_REVIEW_REQUIRED"
    if warnings or video_evidence_score < 70:
        return "PASS_WITH_WARNING"
    # Check event_audit for any FAIL steps
    if any(v == "FAIL" for v in event_audit.values()):
        return "HUMAN_REVIEW_REQUIRED"
    return "PASS"
