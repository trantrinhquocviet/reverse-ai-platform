import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileVideo, ScanText, MapPin, Package, Box, Star,
  Users, Database, CheckCircle, XCircle, Clock, Images
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockProcessingJobs, mockProcessingLogs } from '@/services/mockData'
import type { ProcessingStep, LogLevel } from '@/types'

function formatDuration(start: string, end?: string) {
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  const diff = Math.floor((e.getTime() - s.getTime()) / 1000)
  const m = Math.floor(diff / 60)
  const sec = diff % 60
  return `${m}m ${sec}s`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function ProgressBar({ value, color = 'from-[#7c6af7] to-[#a855f7]' }: { value: number; color?: string }) {
  return (
    <div className="h-2 bg-[#1e1e2a] rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full bg-gradient-to-r transition-all', color)}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function StepStatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle className="w-4 h-4 text-[#4ade80]" />
  if (status === 'failed') return <XCircle className="w-4 h-4 text-[#f87171]" />
  if (status === 'running') return <div className="w-4 h-4 border-2 border-[#a89bff] border-t-transparent rounded-full animate-spin" />
  return <Clock className="w-4 h-4 text-[#55556a]" />
}

const pipelineSteps = [
  { key: 'frameExtraction', label: 'Extract Frames', icon: FileVideo, node: 'Video Input' },
  { key: 'ocr', label: 'OCR', icon: ScanText, node: null },
  { key: 'tracking', label: 'Regex / Tracking', icon: MapPin, node: null },
  { key: 'packagingDetection', label: 'Packaging Detection', icon: Package, node: null },
  { key: 'productDetection', label: 'Product Detection', icon: Box, node: null },
  { key: 'qualityDetection', label: 'Quality Detection', icon: Star, node: null },
] as const

function LogLevelBadge({ level }: { level: LogLevel }) {
  const cfg = {
    info: 'bg-[#3b82f620] text-[#60a5fa]',
    warn: 'bg-[#f59e0b20] text-[#fbbf24]',
    error: 'bg-[#dc262620] text-[#f87171]',
  }
  return <span className={cn('px-2 py-0.5 rounded text-xs font-mono font-medium uppercase', cfg[level])}>{level}</span>
}

export function AIJobDetail() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const job = mockProcessingJobs.find(j => j.id === jobId)
  const logs = mockProcessingLogs.filter(l => l.jobId === jobId)

  if (!job) {
    return (
      <div className="p-6 text-center text-[#8888a8]">
        Job not found.{' '}
        <button onClick={() => navigate('/ai-processing')} className="text-[#a89bff] underline">
          Back
        </button>
      </div>
    )
  }

  const steps = Object.entries(job.steps) as [string, ProcessingStep][]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/ai-processing')}
          className="p-2 rounded-[8px] text-[#55556a] hover:text-[#f0f0f5] hover:bg-[#ffffff08] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-[#f0f0f5]">{job.videoName}</h1>
          <p className="text-xs text-[#8888a8]">Job ID: {job.id}</p>
        </div>
        <button
          onClick={() => navigate(`/ai-processing/${job.id}/frames`)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] hover:border-[#7c6af7] text-[#f0f0f5] text-sm rounded-[8px] transition-colors"
        >
          <Images className="w-4 h-4" />
          View Frames
        </button>
      </div>

      {/* Pipeline visualization */}
      <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] p-6">
        <h2 className="text-sm font-semibold text-[#f0f0f5] mb-6">Processing Pipeline</h2>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {/* Start node */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-[#7c6af720] border-2 border-[#7c6af7] flex items-center justify-center">
              <FileVideo className="w-5 h-5 text-[#a89bff]" />
            </div>
            <span className="text-[10px] text-[#8888a8] mt-1.5 text-center">Video</span>
          </div>

          {pipelineSteps.map(({ key, label, icon: Icon }) => {
            const step = job.steps[key as keyof typeof job.steps]
            const isCompleted = step.status === 'completed'
            const isFailed = step.status === 'failed'
            const isRunning = step.status === 'running'
            const borderColor = isCompleted ? '#4ade80' : isFailed ? '#f87171' : isRunning ? '#a89bff' : '#2a2a3a'

            return (
              <div key={key} className="flex items-center flex-shrink-0">
                {/* Arrow */}
                <div className="w-8 h-px bg-[#2a2a3a] relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 border-l-4 border-l-[#2a2a3a] border-y-4 border-y-transparent" />
                </div>
                {/* Step node */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors"
                    style={{ borderColor, backgroundColor: `${borderColor}15` }}
                  >
                    {isRunning ? (
                      <div className="w-5 h-5 border-2 border-[#a89bff] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Icon className="w-5 h-5" style={{ color: borderColor }} />
                    )}
                  </div>
                  <span className="text-[10px] text-[#8888a8] mt-1.5 text-center max-w-[64px] leading-tight">{label}</span>
                  <span className="text-[10px] font-medium mt-0.5" style={{ color: borderColor }}>{step.progress}%</span>
                </div>
              </div>
            )
          })}

          {/* End node */}
          <div className="flex items-center flex-shrink-0">
            <div className="w-8 h-px bg-[#2a2a3a]" />
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[#16a34a20] border-2 border-[#4ade80] flex items-center justify-center">
                <Database className="w-5 h-5 text-[#4ade80]" />
              </div>
              <span className="text-[10px] text-[#8888a8] mt-1.5 text-center">Dataset</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Frame stats */}
        <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] p-5">
          <h3 className="text-sm font-semibold text-[#f0f0f5] mb-4">Frame Extraction Stats</h3>
          <div className="space-y-3">
            {[
              { label: 'Total Frames', value: job.totalFrames, color: 'text-[#f0f0f5]' },
              { label: 'Selected', value: job.selectedFrames, color: 'text-[#4ade80]' },
              { label: 'Discarded', value: job.discardedFrames, color: 'text-[#f87171]' },
              { label: 'Blur Frames', value: job.blurFrames, color: 'text-[#fbbf24]' },
              { label: 'Duplicates', value: job.duplicateFrames, color: 'text-[#8888a8]' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-[#8888a8]">{label}</span>
                <span className={cn('text-sm font-semibold', color)}>{value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] p-5">
          <h3 className="text-sm font-semibold text-[#f0f0f5] mb-4">Timeline</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#55556a] mb-0.5">Start Time</p>
              <p className="text-sm text-[#f0f0f5]">{formatDateTime(job.startTime)}</p>
            </div>
            {job.endTime && (
              <div>
                <p className="text-xs text-[#55556a] mb-0.5">End Time</p>
                <p className="text-sm text-[#f0f0f5]">{formatDateTime(job.endTime)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-[#55556a] mb-0.5">Duration</p>
              <p className="text-sm font-semibold text-[#a89bff]">
                {job.status === 'pending' ? '—' : formatDuration(job.startTime, job.endTime)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#55556a] mb-0.5">Status</p>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                job.status === 'completed' ? 'bg-[#16a34a20] text-[#4ade80]' :
                job.status === 'running' ? 'bg-[#7c6af720] text-[#a89bff]' :
                job.status === 'failed' ? 'bg-[#dc262620] text-[#f87171]' :
                'bg-[#2a2a3a] text-[#8888a8]'
              )}>{job.status}</span>
            </div>
          </div>
        </div>

        {/* Step details */}
        <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] p-5">
          <h3 className="text-sm font-semibold text-[#f0f0f5] mb-4">Step Progress</h3>
          <div className="space-y-3">
            {steps.map(([key, step]) => {
              const label = pipelineSteps.find(p => p.key === key)?.label ?? key
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <StepStatusIcon status={step.status} />
                      <span className="text-xs text-[#8888a8]">{label}</span>
                    </div>
                    <span className="text-xs text-[#f0f0f5]">{step.progress}%</span>
                  </div>
                  <ProgressBar
                    value={step.progress}
                    color={
                      step.status === 'completed' ? 'from-[#4ade80] to-[#22c55e]' :
                      step.status === 'failed' ? 'from-[#f87171] to-[#ef4444]' :
                      'from-[#7c6af7] to-[#a855f7]'
                    }
                  />
                  {step.message && <p className="text-[10px] text-[#55556a] mt-0.5 truncate">{step.message}</p>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e1e2a]">
          <h2 className="text-sm font-semibold text-[#f0f0f5]">Processing Logs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2a]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#55556a] w-20">Level</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#55556a]">Message</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#55556a] w-44">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2a]">
              {logs.length > 0 ? logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#ffffff04]">
                  <td className="px-5 py-3"><LogLevelBadge level={log.level} /></td>
                  <td className="px-5 py-3 text-xs text-[#c0c0d0]">{log.message}</td>
                  <td className="px-5 py-3 text-xs text-[#55556a] font-mono">{formatDateTime(log.timestamp)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-sm text-[#55556a]">No logs available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
