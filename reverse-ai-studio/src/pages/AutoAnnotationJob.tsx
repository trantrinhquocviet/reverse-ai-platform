import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Edit3, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockAnnotationJobs, mockAIAnnotationSuggestions } from '@/services/mockData'

// Generate frame list for the job
function buildFrames(jobId: string) {
  const job = mockAnnotationJobs.find(j => j.id === jobId)
  if (!job) return []
  const count = Math.min(job.frameCount, 24)
  return Array.from({ length: count }, (_, i) => {
    const frameId = `f${i + 1}`
    const suggestions = mockAIAnnotationSuggestions.filter(s => s.frameId === frameId)
    const confidence = suggestions.length
      ? Math.round(suggestions.reduce((a, s) => a + s.confidence, 0) / suggestions.length)
      : Math.floor(60 + Math.random() * 40)
    return {
      frameId,
      timestamp: `00:${String(Math.floor(i * 1.5)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
      confidence,
      suggestionCount: suggestions.length || 1,
      autoApproved: confidence >= 90,
      status: confidence >= 90 ? 'Auto Approved' : 'Need Review',
    }
  })
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 90 ? 'text-[#4ade80] bg-[#16a34a20]' : value >= 70 ? 'text-[#fbbf24] bg-[#f59e0b20]' : 'text-[#f87171] bg-[#dc262620]'
  return <span className={cn('text-xs px-2 py-0.5 rounded-full font-mono font-medium', color)}>{value}%</span>
}

export function AutoAnnotationJob() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const job = mockAnnotationJobs.find(j => j.id === jobId)
  const [smartMode, setSmartMode] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [frameStates, setFrameStates] = useState<Record<string, 'approved' | 'rejected' | null>>({})

  const allFrames = buildFrames(jobId ?? '')
  const frames = smartMode ? allFrames.filter(f => f.confidence < 85) : allFrames

  const approve = useCallback((frameId: string) => setFrameStates(s => ({ ...s, [frameId]: 'approved' })), [])
  const reject  = useCallback((frameId: string) => setFrameStates(s => ({ ...s, [frameId]: 'rejected' })), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const frame = frames[selectedIdx]
      if (!frame) return
      if (e.key === 'a' || e.key === 'A') approve(frame.frameId)
      if (e.key === 'r' || e.key === 'R') reject(frame.frameId)
      if (e.key === 'e' || e.key === 'E') navigate(`/annotation-editor/${frame.frameId}`)
      if (e.key === 'n' || e.key === 'N') setSelectedIdx(i => Math.min(i + 1, frames.length - 1))
      if (e.key === 'p' || e.key === 'P') setSelectedIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIdx, frames, approve, reject, navigate])

  if (!job) return <div className="p-6 text-[#55556a]">Job not found.</div>

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#1e1e2a] bg-[#0d0d14]">
        <button onClick={() => navigate('/auto-annotation')} className="text-[#55556a] hover:text-[#f0f0f5] transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-[#f0f0f5]">{job.name}</h1>
          <p className="text-xs text-[#55556a]">Annotation Job · {job.frameCount} frames</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          {[
            { label: 'Total Frames',  value: job.frameCount,       color: 'text-[#f0f0f5]' },
            { label: 'Auto Approved', value: job.autoApprovedCount, color: 'text-[#4ade80]' },
            { label: 'Need Review',   value: job.needReviewCount,   color: 'text-[#fbbf24]' },
            { label: 'Rejected',      value: job.rejectedCount,     color: 'text-[#f87171]' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
              <div className="text-[10px] text-[#55556a]">{s.label}</div>
            </div>
          ))}
          {/* Smart Mode toggle */}
          <button
            onClick={() => setSmartMode(m => !m)}
            className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', smartMode ? 'bg-[#7c6af7] text-white' : 'bg-[#1e1e2a] text-[#8888a8] hover:text-[#f0f0f5]')}
          >
            {smartMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            Smart Review
          </button>
        </div>
      </div>

      {smartMode && (
        <div className="px-6 py-2 bg-[#7c6af710] border-b border-[#7c6af730] text-xs text-[#a89bff]">
          Smart Review Mode ON — showing only frames with confidence &lt; 85% ({frames.length} frames)
        </div>
      )}

      {/* Frame grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {frames.map((frame, idx) => {
            const state = frameStates[frame.frameId]
            const isSelected = idx === selectedIdx
            return (
              <div
                key={frame.frameId}
                onClick={() => setSelectedIdx(idx)}
                className={cn(
                  'bg-[#12121c] border rounded-xl overflow-hidden cursor-pointer transition-all',
                  isSelected ? 'border-[#7c6af7] ring-1 ring-[#7c6af7]' : 'border-[#1e1e2a] hover:border-[#2e2e3a]',
                  state === 'approved' && 'ring-1 ring-[#4ade80] border-[#4ade80]',
                  state === 'rejected' && 'ring-1 ring-[#f87171] border-[#f87171]',
                )}
              >
                {/* Thumbnail placeholder */}
                <div className="w-full aspect-video bg-[#1a1a28] flex items-center justify-center relative">
                  <span className="text-[10px] text-[#55556a] font-mono">{frame.timestamp}</span>
                  <div className="absolute top-1.5 right-1.5">
                    <ConfidenceBadge value={frame.confidence} />
                  </div>
                  {state && (
                    <div className={cn('absolute inset-0 flex items-center justify-center bg-black/40', state === 'approved' ? 'text-[#4ade80]' : 'text-[#f87171]')}>
                      {state === 'approved' ? <Check className="w-8 h-8" /> : <X className="w-8 h-8" />}
                    </div>
                  )}
                </div>
                <div className="p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px] font-medium', frame.autoApproved ? 'text-[#4ade80]' : 'text-[#fbbf24]')}>
                      {frame.autoApproved ? 'Auto Approved' : 'Need Review'}
                    </span>
                    <span className="text-[10px] text-[#55556a]">{frame.suggestionCount} AI</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); approve(frame.frameId) }}
                      className="flex-1 py-1 rounded bg-[#16a34a20] text-[#4ade80] hover:bg-[#16a34a40] transition-colors flex items-center justify-center"
                      title="Approve (A)"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); reject(frame.frameId) }}
                      className="flex-1 py-1 rounded bg-[#dc262620] text-[#f87171] hover:bg-[#dc262640] transition-colors flex items-center justify-center"
                      title="Reject (R)"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/annotation-editor/${frame.frameId}`) }}
                      className="flex-1 py-1 rounded bg-[#3b82f620] text-[#60a5fa] hover:bg-[#3b82f640] transition-colors flex items-center justify-center"
                      title="Edit (E)"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Keyboard shortcut bar */}
      <div className="flex items-center justify-center gap-6 px-6 py-3 border-t border-[#1e1e2a] bg-[#0d0d14]">
        <button onClick={() => setSelectedIdx(i => Math.max(i - 1, 0))} className="flex items-center gap-1 text-[#55556a] hover:text-[#f0f0f5]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {[
          { key: 'A', label: 'Approve', color: 'text-[#4ade80]' },
          { key: 'R', label: 'Reject',  color: 'text-[#f87171]' },
          { key: 'E', label: 'Edit',    color: 'text-[#60a5fa]' },
          { key: 'N', label: 'Next',    color: 'text-[#8888a8]' },
          { key: 'P', label: 'Prev',    color: 'text-[#8888a8]' },
        ].map(s => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-[#55556a]">
            <kbd className={cn('px-1.5 py-0.5 rounded bg-[#1e1e2a] font-mono text-[11px] border border-[#2e2e3a]', s.color)}>{s.key}</kbd>
            {s.label}
          </span>
        ))}
        <button onClick={() => setSelectedIdx(i => Math.min(i + 1, frames.length - 1))} className="flex items-center gap-1 text-[#55556a] hover:text-[#f0f0f5]">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-xs text-[#55556a] ml-4">{selectedIdx + 1} / {frames.length}</span>
      </div>
    </div>
  )
}
