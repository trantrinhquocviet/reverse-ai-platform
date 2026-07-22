import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wand2, Plus, Layers, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockAnnotationJobs } from '@/services/mockData'
import type { AnnotationJob } from '@/types'

function StatusBadge({ status }: { status: AnnotationJob['status'] }) {
  const cfg: Record<AnnotationJob['status'], string> = {
    pending:   'bg-[#f59e0b20] text-[#fbbf24]',
    running:   'bg-[#3b82f620] text-[#60a5fa]',
    completed: 'bg-[#16a34a20] text-[#4ade80]',
    failed:    'bg-[#dc262620] text-[#f87171]',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', cfg[status])}>
      {status}
    </span>
  )
}

function JobCard({ job }: { job: AnnotationJob }) {
  const navigate = useNavigate()
  const total = job.frameCount || 1
  const autoApprovedPct = Math.round((job.autoApprovedCount / total) * 100)
  const needReviewPct   = Math.round((job.needReviewCount   / total) * 100)
  const rejectedPct     = Math.round((job.rejectedCount     / total) * 100)

  return (
    <div className="bg-[#12121c] border border-[#1e1e2a] rounded-xl p-5 hover:border-[#7c6af740] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-[#f0f0f5]">{job.name}</h3>
          <p className="text-xs text-[#55556a] mt-0.5">
            Created {new Date(job.createdAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Frames',       value: job.frameCount,      color: 'text-[#f0f0f5]' },
          { label: 'Auto Approved',value: job.autoApprovedCount,color: 'text-[#4ade80]' },
          { label: 'Need Review',  value: job.needReviewCount,  color: 'text-[#fbbf24]' },
          { label: 'Rejected',     value: job.rejectedCount,    color: 'text-[#f87171]' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className={cn('text-lg font-bold', s.color)}>{s.value}</div>
            <div className="text-[10px] text-[#55556a]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-[#1e1e2a] mb-4">
        <div className="bg-[#4ade80]" style={{ width: `${autoApprovedPct}%` }} title={`Auto Approved ${autoApprovedPct}%`} />
        <div className="bg-[#fbbf24]" style={{ width: `${needReviewPct}%`   }} title={`Need Review ${needReviewPct}%`} />
        <div className="bg-[#f87171]" style={{ width: `${rejectedPct}%`     }} title={`Rejected ${rejectedPct}%`} />
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#55556a] mb-4">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#4ade80]" /> Auto Approved {autoApprovedPct}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#fbbf24]" /> Need Review {needReviewPct}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#f87171]" /> Rejected {rejectedPct}%</span>
      </div>

      <button
        onClick={() => navigate(`/auto-annotation/${job.id}`)}
        className="w-full py-2 rounded-lg bg-[#7c6af720] text-[#a89bff] text-sm font-medium hover:bg-[#7c6af740] transition-colors"
      >
        Open Job →
      </button>
    </div>
  )
}

export function AutoAnnotation() {
  const [showModal, setShowModal] = useState(false)

  const totalJobs      = mockAnnotationJobs.length
  const pendingReview  = mockAnnotationJobs.reduce((a, j) => a + j.needReviewCount, 0)
  const autoApproved   = mockAnnotationJobs.reduce((a, j) => a + j.autoApprovedCount, 0)
  const needReview     = mockAnnotationJobs.reduce((a, j) => a + j.pendingCount, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7c6af720] flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-[#a89bff]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#f0f0f5]">Auto Annotation</h1>
            <p className="text-xs text-[#55556a]">AI-powered annotation with confidence scoring</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c6af7] text-white text-sm font-medium hover:bg-[#6b5ce7] transition-colors"
        >
          <Plus className="w-4 h-4" /> Start New Job
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs',    value: totalJobs,    icon: Layers,       color: 'text-[#a89bff]', bg: 'bg-[#7c6af720]' },
          { label: 'Pending Review',value: pendingReview,icon: Clock,        color: 'text-[#fbbf24]', bg: 'bg-[#f59e0b20]' },
          { label: 'Auto Approved', value: autoApproved, icon: CheckCircle2, color: 'text-[#4ade80]', bg: 'bg-[#16a34a20]' },
          { label: 'Need Review',   value: needReview,   icon: XCircle,      color: 'text-[#f87171]', bg: 'bg-[#dc262620]' },
        ].map(s => (
          <div key={s.label} className="bg-[#12121c] border border-[#1e1e2a] rounded-xl p-4 flex items-center gap-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', s.bg)}>
              <s.icon className={cn('w-5 h-5', s.color)} />
            </div>
            <div>
              <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-[#55556a]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Jobs list */}
      <div>
        <h2 className="text-sm font-semibold text-[#8888a8] uppercase tracking-wider mb-3">Annotation Jobs</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mockAnnotationJobs.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </div>

      {/* New Job Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#12121c] border border-[#1e1e2a] rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-[#f0f0f5] mb-4">Start New Annotation Job</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#55556a] block mb-1">Job Name</label>
                <input className="w-full bg-[#0d0d14] border border-[#1e1e2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]" placeholder="e.g. WH-Central Batch #13" />
              </div>
              <div>
                <label className="text-xs text-[#55556a] block mb-1">Source Video / Dataset</label>
                <select className="w-full bg-[#0d0d14] border border-[#1e1e2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]">
                  <option>warehouse-scan-2024-01-15.mp4</option>
                  <option>inventory-check-north.mp4</option>
                  <option>zone-b-inspection.mp4</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#55556a] block mb-1">Auto-Approve Threshold (%)</label>
                <input type="number" defaultValue={90} min={50} max={100} className="w-full bg-[#0d0d14] border border-[#1e1e2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg border border-[#1e1e2a] text-[#8888a8] text-sm hover:border-[#7c6af7] transition-colors">Cancel</button>
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg bg-[#7c6af7] text-white text-sm font-medium hover:bg-[#6b5ce7] transition-colors">Start Job</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
