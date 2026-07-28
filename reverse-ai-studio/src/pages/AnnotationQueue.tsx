import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, CheckCircle, XCircle, Edit3, Filter } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Annotation } from '@/types'

const mockAnnotations: Annotation[] = []
const mockFrames: { id: string; thumbnailUrl: string }[] = []
const mockOCRResults: { frameId: string; detectedText: string; trackingCode: string; carrier: string }[] = []

function StatusBadge({ status }: { status: Annotation['status'] }) {
  const cfg = {
    pending: 'bg-[#f59e0b20] text-[#fbbf24]',
    approved: 'bg-[#16a34a20] text-[#4ade80]',
    rejected: 'bg-[#dc262620] text-[#f87171]',
  }
  return <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', cfg[status])}>{status}</span>
}

export function AnnotationQueue() {
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterReviewer, setFilterReviewer] = useState<string>('all')

  const filtered = mockAnnotations.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (filterReviewer !== 'all' && a.reviewer !== filterReviewer) return false
    return true
  })

  const reviewers = [...new Set(mockAnnotations.map(a => a.reviewer))]

  const handleBulkApprove = () => alert('Bulk approve action triggered (demo)')
  const handleBulkReject = () => alert('Bulk reject action triggered (demo)')

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[#7c6af720] flex items-center justify-center">
            <Tag className="w-5 h-5 text-[#a89bff]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#f0f0f5]">Annotation Queue</h1>
            <p className="text-xs text-[#8888a8]">{filtered.length} annotations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkApprove}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#16a34a20] hover:bg-[#16a34a40] text-[#4ade80] text-xs font-medium rounded-[8px] transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Approve All
          </button>
          <button
            onClick={handleBulkReject}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#dc262620] hover:bg-[#dc262640] text-[#f87171] text-xs font-medium rounded-[8px] transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-3.5 h-3.5 text-[#8888a8]" />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#1a1a24] border border-[#2a2a3a] text-[#f0f0f5] text-xs rounded-[6px] px-2.5 py-1.5 outline-none"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={filterReviewer}
          onChange={e => setFilterReviewer(e.target.value)}
          className="bg-[#1a1a24] border border-[#2a2a3a] text-[#f0f0f5] text-xs rounded-[6px] px-2.5 py-1.5 outline-none"
        >
          <option value="all">All Reviewers</option>
          {reviewers.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(annotation => {
          const frame = mockFrames.find(f => f.id === annotation.frameId)
          const ocr = mockOCRResults.find(o => o.frameId === annotation.frameId)
          return (
            <AnnotationCard
              key={annotation.id}
              annotation={annotation}
              thumbUrl={frame?.thumbnailUrl}
              detectedText={ocr?.detectedText}
              trackingCode={ocr?.trackingCode}
              carrier={ocr?.carrier}
              onEdit={() => navigate(`/annotation/${annotation.frameId}`)}
            />
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-[#55556a]">No annotations match filters.</div>
        )}
      </div>
    </div>
  )
}

function AnnotationCard({
  annotation,
  thumbUrl,
  detectedText,
  trackingCode,
  carrier,
  onEdit,
}: {
  annotation: Annotation
  thumbUrl?: string
  detectedText?: string
  trackingCode?: string
  carrier?: string
  onEdit: () => void
}) {
  const [approved, setApproved] = useState(annotation.status === 'approved')
  const [rejected, setRejected] = useState(annotation.status === 'rejected')

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] overflow-hidden hover:border-[#2a2a3a] transition-colors">
      {/* Thumbnail */}
      <div className="aspect-video bg-[#1a1a24] overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt="frame" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#55556a] text-xs">No preview</div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <StatusBadge status={annotation.status} />
          <span className="text-xs text-[#8888a8]">AI: {annotation.confidence}%</span>
        </div>

        {detectedText && (
          <div className="bg-[#1a1a24] rounded-[6px] p-2">
            <p className="text-[10px] text-[#55556a] mb-0.5">Detected Text</p>
            <p className="text-[11px] text-[#c0c0d0] font-mono line-clamp-2">{detectedText.split('\n')[0]}</p>
          </div>
        )}

        {trackingCode && (
          <div className="flex items-center gap-2">
            {carrier && (
              <span className="px-2 py-0.5 rounded bg-[#7c6af720] text-[#a89bff] text-[10px] font-bold">{carrier}</span>
            )}
            <span className="text-[11px] text-[#f0f0f5] font-mono truncate">{trackingCode}</span>
          </div>
        )}

        <p className="text-[10px] text-[#55556a]">Reviewer: {annotation.reviewer}</p>

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={() => { setApproved(true); setRejected(false) }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-[6px] text-xs transition-colors',
              approved
                ? 'bg-[#16a34a] text-white'
                : 'bg-[#16a34a20] text-[#4ade80] hover:bg-[#16a34a40]'
            )}
          >
            <CheckCircle className="w-3 h-3" />
            Approve
          </button>
          <button
            onClick={() => { setRejected(true); setApproved(false) }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-[6px] text-xs transition-colors',
              rejected
                ? 'bg-[#dc2626] text-white'
                : 'bg-[#dc262620] text-[#f87171] hover:bg-[#dc262640]'
            )}
          >
            <XCircle className="w-3 h-3" />
            Reject
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 bg-[#2a2a3a] hover:bg-[#3a3a4a] text-[#8888a8] rounded-[6px] text-xs transition-colors"
          >
            <Edit3 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
