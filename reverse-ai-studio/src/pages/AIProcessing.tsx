import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Cpu, Plus, Play, CheckCircle, XCircle, Clock, ChevronRight,
  FileVideo, ScanText, MapPin, Package, Box, Star, X
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockProcessingJobs } from '@/services/mockData'
import type { ProcessingJob, ProcessingJobStatus } from '@/types'

function StatusBadge({ status }: { status: ProcessingJobStatus }) {
  const cfg = {
    pending: 'bg-[#2a2a3a] text-[#8888a8]',
    running: 'bg-[#7c6af720] text-[#a89bff]',
    completed: 'bg-[#16a34a20] text-[#4ade80]',
    failed: 'bg-[#dc262620] text-[#f87171]',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', cfg[status])}>
      {status}
    </span>
  )
}

function StepIcon({ icon: Icon, status }: { icon: React.ComponentType<{ className?: string }>, status: string }) {
  const color =
    status === 'completed' ? 'text-[#4ade80]' :
    status === 'running' ? 'text-[#a89bff]' :
    status === 'failed' ? 'text-[#f87171]' :
    status === 'skipped' ? 'text-[#55556a]' :
    'text-[#55556a]'
  return <Icon className={cn('w-4 h-4', color)} />
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 bg-[#1e1e2a] rounded-full overflow-hidden', className)}>
      <div
        className="h-full bg-gradient-to-r from-[#7c6af7] to-[#a855f7] rounded-full transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

const steps = [
  { key: 'frameExtraction', label: 'Frames', icon: FileVideo },
  { key: 'ocr', label: 'OCR', icon: ScanText },
  { key: 'tracking', label: 'Tracking', icon: MapPin },
  { key: 'packagingDetection', label: 'Packaging', icon: Package },
  { key: 'productDetection', label: 'Product', icon: Box },
  { key: 'qualityDetection', label: 'Quality', icon: Star },
] as const

function formatDuration(start: string, end?: string) {
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const diff = Math.floor((e.getTime() - s.getTime()) / 1000)
  const m = Math.floor(diff / 60)
  const sec = diff % 60
  return `${m}m ${sec}s`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function AIProcessing() {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)

  const stats = {
    total: mockProcessingJobs.length,
    running: mockProcessingJobs.filter(j => j.status === 'running').length,
    completed: mockProcessingJobs.filter(j => j.status === 'completed').length,
    failed: mockProcessingJobs.filter(j => j.status === 'failed').length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[#7c6af720] flex items-center justify-center">
            <Cpu className="w-5 h-5 text-[#a89bff]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#f0f0f5]">AI Processing</h1>
            <p className="text-xs text-[#8888a8]">Manage video processing jobs</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#7c6af7] hover:bg-[#6b5ae6] text-white text-sm font-medium rounded-[8px] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Job
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs', value: stats.total, icon: Cpu, color: 'text-[#a89bff]', bg: 'bg-[#7c6af720]' },
          { label: 'Running', value: stats.running, icon: Play, color: 'text-[#fbbf24]', bg: 'bg-[#fbbf2420]' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-[#4ade80]', bg: 'bg-[#4ade8020]' },
          { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-[#f87171]', bg: 'bg-[#f8717120]' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] p-4 flex items-center gap-4">
            <div className={cn('w-10 h-10 rounded-[10px] flex items-center justify-center', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#f0f0f5]">{value}</p>
              <p className="text-xs text-[#8888a8]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Jobs table */}
      <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e1e2a]">
          <h2 className="text-sm font-semibold text-[#f0f0f5]">Processing Queue</h2>
        </div>
        <div className="divide-y divide-[#1e1e2a]">
          {mockProcessingJobs.map((job) => (
            <JobRow key={job.id} job={job} onNavigate={() => navigate(`/ai-processing/${job.id}`)} />
          ))}
        </div>
      </div>

      {/* Create Job Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[16px] p-6 w-[420px] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#f0f0f5]">Create Processing Job</h3>
              <button onClick={() => setShowModal(false)} className="text-[#55556a] hover:text-[#f0f0f5]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[#8888a8]">Select a video to start a new AI processing pipeline.</p>
            <select className="w-full bg-[#1a1a24] border border-[#2a2a3a] text-[#f0f0f5] text-sm rounded-[8px] px-3 py-2 outline-none">
              <option>warehouse-scan-2024-01-15.mp4</option>
              <option>zone-b-inspection.mp4</option>
              <option>quality-control-batch-7.mp4</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-[8px] border border-[#2a2a3a] text-sm text-[#8888a8] hover:text-[#f0f0f5] transition-colors">
                Cancel
              </button>
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-[8px] bg-[#7c6af7] hover:bg-[#6b5ae6] text-white text-sm font-medium transition-colors">
                Start Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function JobRow({ job, onNavigate }: { job: ProcessingJob; onNavigate: () => void }) {
  const duration = job.status === 'pending' ? '—' : formatDuration(job.startTime, job.endTime)

  return (
    <div
      className="px-5 py-4 hover:bg-[#ffffff04] cursor-pointer transition-colors"
      onClick={onNavigate}
    >
      <div className="flex items-center gap-4">
        {/* Video name + status */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-[#f0f0f5] truncate">{job.videoName}</span>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-[#55556a]">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(job.startTime)}</span>
            <span>{duration}</span>
          </div>
        </div>

        {/* Step icons */}
        <div className="hidden lg:flex items-center gap-3">
          {steps.map(({ key, icon }) => (
            <StepIcon key={key} icon={icon} status={job.steps[key].status} />
          ))}
        </div>

        {/* Progress */}
        <div className="w-32 hidden md:block">
          <div className="flex justify-between text-xs text-[#8888a8] mb-1">
            <span>Progress</span>
            <span>{job.progress}%</span>
          </div>
          <ProgressBar value={job.progress} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {job.status === 'running' && (
            <button
              onClick={e => e.stopPropagation()}
              className="px-3 py-1.5 text-xs rounded-[6px] border border-[#2a2a3a] text-[#8888a8] hover:text-[#f87171] hover:border-[#f87171] transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onNavigate() }}
            className="p-1.5 text-[#55556a] hover:text-[#a89bff] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Overall progress bar */}
      {job.status === 'running' && (
        <ProgressBar value={job.progress} className="mt-3" />
      )}
    </div>
  )
}
