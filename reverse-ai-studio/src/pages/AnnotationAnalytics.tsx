import { BarChart3, Users, Zap, Target, Eye, Copy, Star } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockAnnotationAnalytics, mockDatasetQualityScore, mockActiveLearningFrames } from '@/services/mockData'

const analytics = mockAnnotationAnalytics
const quality   = mockDatasetQualityScore

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#12121c] border border-[#1e1e2a] rounded-xl p-4">
      <div className={cn('text-2xl font-bold', color ?? 'text-[#f0f0f5]')}>{value}</div>
      <div className="text-xs text-[#55556a] mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-[#3b82f6] mt-1">{sub}</div>}
    </div>
  )
}

function EfficiencyBadge({ avgMs }: { avgMs: number }) {
  const label = avgMs < 5500 ? 'Fast' : avgMs < 7000 ? 'Normal' : 'Slow'
  const color  = avgMs < 5500 ? 'text-[#4ade80] bg-[#16a34a20]' : avgMs < 7000 ? 'text-[#fbbf24] bg-[#f59e0b20]' : 'text-[#f87171] bg-[#dc262620]'
  return <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', color)}>{label}</span>
}

const REASON_LABELS: Record<string, string> = {
  high_blur:         'High Blur',
  low_ocr:           'Low OCR',
  unknown_packaging: 'Unknown Packaging',
  unknown_product:   'Unknown Product',
  unknown_damage:    'Unknown Damage',
}
const PRIORITY_COLORS: Record<string, string> = {
  high:   'text-[#f87171] bg-[#dc262620]',
  medium: 'text-[#fbbf24] bg-[#f59e0b20]',
  low:    'text-[#4ade80] bg-[#16a34a20]',
}

export function AnnotationAnalytics() {
  const maxReviewed = Math.max(...analytics.dailyProgress.map(d => d.reviewed), 1)

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#7c6af720] flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-[#a89bff]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f5]">Annotation Analytics</h1>
          <p className="text-xs text-[#55556a]">Performance insights & dataset quality</p>
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        <StatCard label="Frames Reviewed"   value={analytics.totalFramesReviewed.toLocaleString()} color="text-[#a89bff]" />
        <StatCard label="Approval Rate"     value={`${analytics.approvalRate}%`}   color="text-[#4ade80]" />
        <StatCard label="Avg Review Time"   value={`${(analytics.avgReviewTimeMs/1000).toFixed(1)}s`} color="text-[#60a5fa]" />
        <StatCard label="AI Accuracy"       value={`${analytics.aiAccuracy}%`}     color="text-[#34d399]" />
        <StatCard label="OCR Accuracy"      value={`${analytics.ocrAccuracy}%`}    color="text-[#fbbf24]" />
        <StatCard label="Duplicate Reduction" value={`${analytics.duplicateReduction}%`} color="text-[#f97316]" />
      </div>

      {/* Dataset Quality Score */}
      <div className="bg-[#12121c] border border-[#1e1e2a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-[#fbbf24]" />
          <h2 className="text-sm font-semibold text-[#f0f0f5]">Dataset Quality Score</h2>
          <span className="text-xs text-[#55556a] ml-auto">Dataset ID: {quality.datasetId}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
          {[
            { label: 'Images',                value: quality.totalImages.toLocaleString(), unit: '' },
            { label: 'Blur',                  value: quality.blurPercent,                  unit: '%' },
            { label: 'Duplicates',            value: quality.duplicatesPercent,             unit: '%' },
            { label: 'OCR Quality',           value: quality.ocrQuality,                   unit: '%' },
            { label: 'Annotation Consistency',value: quality.annotationConsistency,         unit: '%' },
          ].map(m => (
            <div key={m.label}>
              <div className="text-lg font-bold text-[#f0f0f5]">{m.value}{m.unit}</div>
              <div className="text-[10px] text-[#55556a]">{m.label}</div>
            </div>
          ))}
          <div className="flex flex-col items-center justify-center">
            <div className={cn('text-4xl font-black', quality.overallScore >= 90 ? 'text-[#4ade80]' : quality.overallScore >= 70 ? 'text-[#fbbf24]' : 'text-[#f87171]')}>
              {quality.overallScore}
            </div>
            <div className="text-xs text-[#55556a]">Overall Score</div>
          </div>
        </div>
      </div>

      {/* Daily Progress chart */}
      <div className="bg-[#12121c] border border-[#1e1e2a] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#f0f0f5] mb-4">Daily Progress (7 days)</h2>
        <div className="flex items-end gap-3 h-40">
          {analytics.dailyProgress.map(day => {
            const revH   = Math.round((day.reviewed  / maxReviewed) * 140)
            const appH   = Math.round((day.approved  / maxReviewed) * 140)
            const rejH   = Math.round((day.rejected  / maxReviewed) * 140)
            const date   = new Date(day.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-0.5 h-36" title={`Reviewed: ${day.reviewed}, Approved: ${day.approved}, Rejected: ${day.rejected}`}>
                  <div className="w-3 rounded-t bg-[#a89bff]" style={{ height: revH }} title={`Reviewed ${day.reviewed}`} />
                  <div className="w-3 rounded-t bg-[#4ade80]" style={{ height: appH }} title={`Approved ${day.approved}`} />
                  <div className="w-3 rounded-t bg-[#f87171]" style={{ height: rejH }} title={`Rejected ${day.rejected}`} />
                </div>
                <span className="text-[9px] text-[#55556a] whitespace-nowrap">{date}</span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-[#55556a]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#a89bff]" /> Reviewed</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#4ade80]" /> Approved</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#f87171]" /> Rejected</span>
        </div>
      </div>

      {/* Reviewer Performance table */}
      <div className="bg-[#12121c] border border-[#1e1e2a] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#1e1e2a]">
          <Users className="w-4 h-4 text-[#55556a]" />
          <h2 className="text-sm font-semibold text-[#f0f0f5]">Reviewer Performance</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2a]">
              {['Reviewer','Frames Reviewed','Approval Rate','Avg Review Time','Efficiency'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[10px] text-[#55556a] uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analytics.reviewerPerformance.map((r, i) => (
              <tr key={r.reviewer} className={cn('border-b border-[#1e1e2a]', i % 2 === 0 ? 'bg-[#0d0d14]' : 'bg-[#12121c]')}>
                <td className="px-5 py-3 font-medium text-[#f0f0f5]">{r.reviewer}</td>
                <td className="px-5 py-3 text-[#8888a8]">{r.framesReviewed.toLocaleString()}</td>
                <td className="px-5 py-3">
                  <span className={cn('font-bold', r.approvalRate >= 85 ? 'text-[#4ade80]' : r.approvalRate >= 75 ? 'text-[#fbbf24]' : 'text-[#f87171]')}>
                    {r.approvalRate}%
                  </span>
                </td>
                <td className="px-5 py-3 text-[#8888a8] font-mono">{(r.avgTimeMs / 1000).toFixed(1)}s</td>
                <td className="px-5 py-3"><EfficiencyBadge avgMs={r.avgTimeMs} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Active Learning Queue */}
      <div className="bg-[#12121c] border border-[#1e1e2a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[#a89bff]" />
          <h2 className="text-sm font-semibold text-[#f0f0f5]">Active Learning Queue</h2>
          <span className="text-xs text-[#55556a] ml-auto">{mockActiveLearningFrames.length} frames flagged</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {mockActiveLearningFrames.map(frame => (
            <div key={frame.frameId} className="bg-[#1a1a28] rounded-lg p-3 space-y-2">
              <div className="w-full aspect-video bg-[#0d0d14] rounded flex items-center justify-center">
                <span className="text-[10px] text-[#2e2e3a] font-mono">{frame.frameId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize', PRIORITY_COLORS[frame.priority])}>
                  {frame.priority}
                </span>
              </div>
              <div className="text-[10px] text-[#8888a8]">{REASON_LABELS[frame.reason] ?? frame.reason}</div>
              <div className="text-[10px] text-[#55556a]">
                Blur: {frame.blurScore} · OCR: {frame.ocrConfidence}%
              </div>
              <button className="w-full py-1 rounded bg-[#7c6af720] text-[#a89bff] text-[10px] font-medium hover:bg-[#7c6af740] transition-colors">
                Assign to Review
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
