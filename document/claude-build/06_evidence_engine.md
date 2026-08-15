# Module 06 — Evidence Engine & Final Scoring

## Mục tiêu

Tổng hợp kết quả từ Content Pipeline + WH Audit → **Video Evidence Score** + **Final Status**.

---

## Video Evidence Score (0–100)

### Components và weights (configurable)

| Component | Default Weight | Notes |
|-----------|---------------|-------|
| Camera Quality | 10 | blur, dark, exposure |
| AWB Evidence | 20 | visible + readable |
| Parcel Continuity | 10 | track maintained |
| Opening Evidence | 10 | sealed→opened captured |
| Product Emergence | 15 | product from parcel |
| Product Visibility | 15 | clear view exists |
| Product Identification | 10 | SKU/barcode verified |
| Quantity Evidence | 5 | count verifiable |
| Process Completeness | 5 | full sequence |

**Không simple average** — Critical evidence có weight cao hơn.

### Score calculation

```typescript
function calculateEvidenceScore(checklist: EvidenceChecklist, weights: Weights): number {
  let totalWeight = 0
  let earnedWeight = 0

  for (const [key, status] of Object.entries(checklist.evidence)) {
    if (status === 'NOT_REQUIRED') continue
    const w = weights[key]
    totalWeight += w
    if (status === 'PASS') earnedWeight += w
    else if (status === 'UNCERTAIN') earnedWeight += w * 0.5
    // FAIL = 0
  }

  return Math.round((earnedWeight / totalWeight) * 100)
}
```

---

## Error Attribution

Mỗi error phải có:

```typescript
interface DetectedError {
  error_code: string
  source: 'WAREHOUSE' | 'AI' | 'SYSTEM' | 'UNKNOWN'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  confidence: number
  start_timestamp: number
  end_timestamp: number
  frame_id: string
  best_evidence_frame: string
  related_parcel_id?: string
  related_product_id?: string
}
```

### Attribution logic

```
Nếu frame quality GOOD + AI detect failed:
  → source = AI

Nếu frame quality POOR:
  → Investigate WHY quality poor
  → Nếu object blocked by hand → source = WAREHOUSE
  → Nếu camera issue → source = WAREHOUSE or SYSTEM
  → Nếu unclear → source = UNKNOWN

Nếu object simply not present:
  → source = WAREHOUSE (nếu should have been shown)
  → source = UNKNOWN (nếu không rõ expected behavior)
```

---

## Final Video Status

```typescript
type VideoStatus =
  | 'PASS'
  | 'PASS_WITH_WARNING'
  | 'WH_PROCESS_FAIL'
  | 'AI_UNCERTAIN'
  | 'SYSTEM_ERROR'
  | 'HUMAN_REVIEW_REQUIRED'

function determineVideoStatus(errors: DetectedError[], score: number): VideoStatus {
  const hasCritical = errors.some(e => e.severity === 'CRITICAL' && e.source === 'WAREHOUSE')
  const hasAIUncertain = errors.some(e => e.source === 'AI' && e.severity === 'CRITICAL')
  const hasSystemError = errors.some(e => e.source === 'SYSTEM')
  const hasWarnings = errors.some(e => e.severity === 'WARNING')

  if (hasSystemError) return 'SYSTEM_ERROR'
  if (hasCritical) return 'WH_PROCESS_FAIL'
  if (hasAIUncertain || score < 60) return 'AI_UNCERTAIN'  // → human review
  if (hasWarnings) return 'PASS_WITH_WARNING'
  return 'PASS'
}
```

---

## Final Output Schema

```typescript
interface VideoAnalysisResult {
  video_id: string
  parcel_id: string
  video_status: VideoStatus
  video_evidence_score: number

  content_result: {
    awb: AWBResult
    products: ProductResult[]
    events: ProcessEvent[]
  }

  audit_result: {
    checklist: EvidenceChecklist
    errors: DetectedError[]
  }

  metadata: {
    processing_time_ms: number
    frames_analyzed: number
    ai_calls_made: number
    model_used: string
  }
}
```

---

## Dashboard metrics (future)

Designed để support analytics:

```
WH Video Pass Rate = PASS + PASS_WITH_WARNING / total
WH Process Fail Rate = WH_PROCESS_FAIL / total
Avg Evidence Score
AWB Detect Rate
AWB OCR Success Rate
Product Detect Rate
Product ID Rate
Barcode Detect Rate

Breakdowns by:
  - warehouse_id
  - category
  - brand
  - PIC (operator)
  - week
  - error_type
  - severity
```
