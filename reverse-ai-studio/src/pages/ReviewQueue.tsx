import { useState } from 'react'
import { CheckCircle2, RotateCcw, MessageSquare } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockAnnotationReviews, mockAnnotations, mockFrames } from '@/services/mockData'
import type { AnnotationReview } from '@/types'

function ApprovalBadge({ status }: { status: AnnotationReview['approvalStatus'] }) {
  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-medium capitalize',
      status === 'approved' ? 'bg-[#16a34a20] text-[#4ade80]' : 'bg-[#dc262620] text-[#f87171]'
    )}>
      {status}
    </span>
  )
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

export function ReviewQueue() {
  const [comments, setComments] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [finalStatus, setFinalStatus] = useState<Record<string, 'approved' | 'sent_back'>>({})

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[#7c6af720] flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-[#a89bff]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#f0f0f5]">Review Queue</h1>
          <p className="text-xs text-[#8888a8]">{mockAnnotationReviews.length} completed annotations awaiting final review</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e1e2a]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#55556a]">Frame</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#55556a]">Reviewer</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#55556a]">Review Time</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#55556a]">Confidence</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#55556a]">AI Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#55556a]">Comments</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#55556a]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2a]">
            {mockAnnotationReviews.map(review => {
              const annotation = mockAnnotations.find(a => a.id === review.annotationId)
              const frame = mockFrames.find(f => f.id === annotation?.frameId)
              const fs = finalStatus[review.id]

              return (
                <>
                  <tr key={review.id} className="hover:bg-[#ffffff04]">
                    {/* Frame thumb */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {frame?.thumbnailUrl ? (
                          <img
                            src={frame.thumbnailUrl}
                            alt="frame"
                            className="w-12 h-8 object-cover rounded-[4px]"
                          />
                        ) : (
                          <div className="w-12 h-8 bg-[#1a1a24] rounded-[4px]" />
                        )}
                        <span className="text-xs text-[#8888a8] font-mono">{annotation?.frameId ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#f0f0f5]">{review.reviewer}</td>
                    <td className="px-4 py-3 text-xs text-[#8888a8]">{formatDateTime(review.reviewTime)}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-sm font-semibold',
                        review.confidence >= 85 ? 'text-[#4ade80]' :
                        review.confidence >= 65 ? 'text-[#fbbf24]' : 'text-[#f87171]'
                      )}>{review.confidence}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <ApprovalBadge status={review.approvalStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(prev => prev === review.id ? null : review.id)}
                        className="flex items-center gap-1 text-xs text-[#8888a8] hover:text-[#a89bff] transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {review.comments ? 'View' : 'Add'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setFinalStatus(p => ({ ...p, [review.id]: 'approved' }))}
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors',
                            fs === 'approved'
                              ? 'bg-[#16a34a] text-white'
                              : 'bg-[#16a34a20] text-[#4ade80] hover:bg-[#16a34a40]'
                          )}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Approve
                        </button>
                        <button
                          onClick={() => setFinalStatus(p => ({ ...p, [review.id]: 'sent_back' }))}
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors',
                            fs === 'sent_back'
                              ? 'bg-[#d97706] text-white'
                              : 'bg-[#d9770620] text-[#fbbf24] hover:bg-[#d9770640]'
                          )}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Send Back
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline comment */}
                  {expanded === review.id && (
                    <tr key={`${review.id}-comment`}>
                      <td colSpan={7} className="px-4 pb-4 bg-[#0a0a0f]">
                        <div className="space-y-2">
                          {review.comments && (
                            <div className="bg-[#1a1a24] rounded-[6px] p-2.5 text-xs text-[#c0c0d0]">
                              <p className="text-[10px] text-[#55556a] mb-1">Previous comment:</p>
                              {review.comments}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Add a comment..."
                              value={comments[review.id] ?? ''}
                              onChange={e => setComments(p => ({ ...p, [review.id]: e.target.value }))}
                              className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] text-[#f0f0f5] text-xs rounded-[6px] px-3 py-2 outline-none focus:border-[#7c6af7]"
                            />
                            <button
                              onClick={() => setExpanded(null)}
                              className="px-3 py-2 bg-[#7c6af7] hover:bg-[#6b5ae6] text-white text-xs rounded-[6px] transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
