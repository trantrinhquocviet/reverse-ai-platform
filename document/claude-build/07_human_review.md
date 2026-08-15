# Module 07 — Human Review & Ground Truth

## Mục tiêu

Cho phép reviewer xem xét, sửa, confirm kết quả AI → tạo **ground truth dataset**.

---

## Review UI requirements

Reviewer phải có thể:

| Action | Mô tả |
|--------|-------|
| Confirm error | Accept AI prediction |
| Reject false error | Đánh dấu AI false positive |
| Change error type | Sửa error_code |
| Change severity | INFO/WARNING/CRITICAL |
| Change source | WAREHOUSE/AI/SYSTEM/UNKNOWN |
| Adjust timestamp | Sửa start/end time |
| Select better frame | Chọn evidence frame tốt hơn |
| Add missing error | AI bỏ sót, human thêm vào |

---

## Data structure: AI prediction vs Human truth

```typescript
interface ReviewRecord {
  review_id: string
  video_id: string
  parcel_id: string

  ai_prediction: {
    video_status: VideoStatus
    evidence_score: number
    errors: DetectedError[]
    checklist: EvidenceChecklist
  }

  human_review: {
    reviewed_by: string
    reviewed_at: string
    final_status: VideoStatus
    final_score?: number
    confirmed_errors: DetectedError[]
    rejected_errors: string[]      // error_codes rejected
    added_errors: DetectedError[]  // errors AI missed
    notes: string
  }

  ground_truth: {
    // Merged: AI errors confirmed + human added - human rejected
    errors: DetectedError[]
    video_status: VideoStatus
    evidence_score: number
  }
}
```

**Quan trọng**: Lưu riêng AI prediction và human ground truth — không overwrite.

---

## Training dataset structure

```typescript
interface TrainingRecord {
  // Video metadata
  video_id: string
  warehouse_id: string
  parcel_id: string
  product_id: string
  category: string

  // Ground truth
  error_code: string
  error_source: 'WAREHOUSE' | 'AI' | 'SYSTEM' | 'UNKNOWN'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  start_timestamp: number
  end_timestamp: number
  evidence_frame_ids: string[]

  // AI metadata
  ai_confidence: number
  human_confirmed: boolean
  human_corrected_error?: string  // nếu reviewer đổi error_code

  // Model info
  model_name: string
  model_version: string
}
```

**Collect cả GOOD và FAILED videos** — không chỉ lưu error cases.

---

## Review workflow

```
Video processed by AI
    │
    ▼
Status = AI_UNCERTAIN or WH_PROCESS_FAIL
    │
    ▼
Assigned to reviewer queue
    │
    ▼
Reviewer opens Review UI:
  - Watch video với AI annotations overlay
  - See evidence checklist
  - See error list với timestamps
  - Navigate to evidence frames
    │
    ▼
Reviewer confirms/edits/rejects
    │
    ▼
Ground truth saved
    │
    ▼
Added to training dataset
```

---

## Supabase tables needed

```sql
-- Reviews
CREATE TABLE video_reviews (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  parcel_id UUID,
  ai_prediction JSONB,
  human_review JSONB,
  ground_truth JSONB,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training dataset
CREATE TABLE wh_error_training_data (
  id UUID PRIMARY KEY,
  video_id UUID,
  warehouse_id UUID,
  parcel_id UUID,
  product_id TEXT,
  category TEXT,
  error_code TEXT,
  error_source TEXT,
  severity TEXT,
  start_timestamp FLOAT,
  end_timestamp FLOAT,
  evidence_frame_ids TEXT[],
  ai_confidence FLOAT,
  human_confirmed BOOLEAN,
  human_corrected_error TEXT,
  model_name TEXT,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
