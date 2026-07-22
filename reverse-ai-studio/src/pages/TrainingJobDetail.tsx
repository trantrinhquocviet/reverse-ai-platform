import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, XCircle, Copy, CheckCircle2, Clock, Loader2, BarChart3, AlertTriangle } from 'lucide-react'
import { mockTrainingJobs, mockGPUNodes, mockMetricHistory } from '@/services/mockData'
import type { TrainingStatus } from '@/types'
import { cn } from '@/utils/cn'

const STATUS_CONFIG: Record<TrainingStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  queued:     { label: 'Queued',     color: 'text-gray-400',   bg: 'bg-gray-800/60',   icon: Clock },
  preparing:  { label: 'Preparing',  color: 'text-blue-400',   bg: 'bg-blue-900/40',   icon: Loader2 },
  training:   { label: 'Training',   color: 'text-yellow-400', bg: 'bg-yellow-900/40', icon: Play },
  evaluating: { label: 'Evaluating', color: 'text-purple-400', bg: 'bg-purple-900/40', icon: BarChart3 },
  completed:  { label: 'Completed',  color: 'text-green-400',  bg: 'bg-green-900/40',  icon: CheckCircle2 },
  failed:     { label: 'Failed',     color: 'text-red-400',    bg: 'bg-red-900/40',    icon: XCircle },
  cancelled:  { label: 'Cancelled',  color: 'text-gray-400',   bg: 'bg-gray-800/60',   icon: XCircle },
}

const TIMELINE: { status: TrainingStatus; label: string }[] = [
  { status: 'queued', label: 'Queued' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'training', label: 'Training' },
  { status: 'evaluating', label: 'Evaluating' },
  { status: 'completed', label: 'Completed' },
]

const STATUS_ORDER: TrainingStatus[] = ['queued', 'preparing', 'training', 'evaluating', 'completed']

// Simple SVG line chart (no library)
function LineChart({ data, width = 600, height = 180 }: {
  data: { epoch: number; trainLoss: number; valLoss: number; mAP50: number }[]
  width?: number
  height?: number
}) {
  if (!data.length) return null
  const pad = { top: 10, right: 20, bottom: 30, left: 40 }
  const iw = width - pad.left - pad.right
  const ih = height - pad.top - pad.bottom

  const epochs = data.map(d => d.epoch)
  const minX = Math.min(...epochs)
  const maxX = Math.max(...epochs)
  const allVals = data.flatMap(d => [d.trainLoss, d.valLoss, d.mAP50])
  const minY = Math.min(...allVals)
  const maxY = Math.max(...allVals)

  const scaleX = (v: number) => pad.left + ((v - minX) / (maxX - minX || 1)) * iw
  const scaleY = (v: number) => pad.top + ih - ((v - minY) / (maxY - minY || 1)) * ih

  const pathFor = (key: 'trainLoss' | 'valLoss' | 'mAP50') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${scaleX(d.epoch).toFixed(1)},${scaleY(d[key]).toFixed(1)}`).join(' ')

  const yTicks = 4
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Grid */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const yVal = minY + (maxY - minY) * (i / yTicks)
        const y = scaleY(yVal)
        return (
          <g key={i}>
            <line x1={pad.left} x2={pad.left + iw} y1={y} y2={y} stroke="#1e1e2a" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 4} fontSize={9} fill="#44445a" textAnchor="end">{yVal.toFixed(2)}</text>
          </g>
        )
      })}
      {/* X labels */}
      {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map(d => (
        <text key={d.epoch} x={scaleX(d.epoch)} y={height - 4} fontSize={9} fill="#44445a" textAnchor="middle">
          {d.epoch}
        </text>
      ))}
      <text x={pad.left + iw / 2} y={height} fontSize={9} fill="#44445a" textAnchor="middle">Epoch</text>
      {/* Lines */}
      <path d={pathFor('trainLoss')} fill="none" stroke="#7c6af7" strokeWidth={2} />
      <path d={pathFor('valLoss')} fill="none" stroke="#fb923c" strokeWidth={2} />
      <path d={pathFor('mAP50')} fill="none" stroke="#4ade80" strokeWidth={2} />
    </svg>
  )
}

export function TrainingJobDetail() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const job = mockTrainingJobs.find(j => j.id === jobId)

  if (!job) return (
    <div className="p-6 text-center text-[#55556a]">Job not found.</div>
  )

  const cfg = STATUS_CONFIG[job.status]
  const gpu = mockGPUNodes.find(g => g.id === job.gpuId)
  const currentIdx = STATUS_ORDER.indexOf(job.status)
  const metrics = mockMetricHistory['exp-1'] ?? []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/training-jobs')} className="text-[#55556a] hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#f0f0f5] truncate">{job.name}</h1>
            <span className={cn('text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0', cfg.bg, cfg.color)}>
              <cfg.icon className="w-3.5 h-3.5" />{cfg.label}
            </span>
          </div>
          <p className="text-sm text-[#55556a] mt-0.5">{job.modelTemplate} · Dataset {job.datasetVersion} · {gpu?.name ?? 'CPU'}</p>
        </div>
        <div className="flex gap-2">
          {job.status === 'training' && (
            <button className="px-3 py-1.5 rounded-lg bg-red-900/40 text-red-400 text-sm hover:bg-red-900/60 transition-colors flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          )}
          <button className="px-3 py-1.5 rounded-lg bg-[#1e1e2a] text-[#8888a8] text-sm hover:text-white transition-colors flex items-center gap-1.5">
            <Copy className="w-4 h-4" /> Clone
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4">
        <div className="flex items-center gap-0">
          {TIMELINE.map((t, i) => {
            const done = STATUS_ORDER.indexOf(t.status) <= currentIdx
            const active = t.status === job.status
            const failed = job.status === 'failed' && t.status === job.status
            return (
              <div key={t.status} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2',
                    failed ? 'border-red-500 bg-red-900/40 text-red-400' :
                    active ? 'border-[#7c6af7] bg-[#7c6af720] text-[#a89bff]' :
                    done ? 'border-green-500 bg-green-900/20 text-green-400' :
                    'border-[#2a2a3a] bg-[#1e1e2a] text-[#44445a]'
                  )}>
                    {done && !active ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={cn('text-[10px] mt-1 whitespace-nowrap', active ? 'text-[#a89bff]' : done ? 'text-green-400' : 'text-[#44445a]')}>
                    {t.label}
                  </span>
                </div>
                {i < TIMELINE.length - 1 && (
                  <div className={cn('flex-1 h-0.5 mx-1 mb-4', done ? 'bg-green-500/40' : 'bg-[#1e1e2a]')} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Live metrics */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Train Loss', value: job.trainLoss > 0 ? job.trainLoss.toFixed(3) : '—', color: 'text-[#7c6af7]' },
          { label: 'Val Loss', value: job.valLoss > 0 ? job.valLoss.toFixed(3) : '—', color: 'text-orange-400' },
          { label: 'mAP50', value: job.mAP50 > 0 ? job.mAP50.toFixed(3) : '—', color: 'text-green-400' },
          { label: 'Accuracy', value: job.accuracy > 0 ? `${job.accuracy.toFixed(1)}%` : '—', color: 'text-blue-400' },
          { label: 'Recall', value: job.recall > 0 ? job.recall.toFixed(3) : '—', color: 'text-purple-400' },
          { label: 'Precision', value: job.precision > 0 ? job.precision.toFixed(3) : '—', color: 'text-pink-400' },
        ].map(m => (
          <div key={m.label} className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-3 text-center">
            <div className={cn('text-lg font-bold', m.color)}>{m.value}</div>
            <div className="text-[10px] text-[#44445a] mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Resource usage + epoch progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Resources */}
        <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#f0f0f5]">Resource Usage</h3>
          {[
            { label: 'GPU', value: job.gpuUsage, color: '#7c6af7' },
            { label: 'RAM', value: job.ramUsage, color: '#4ade80' },
            { label: 'Disk', value: job.diskUsage, color: '#fb923c' },
          ].map(r => (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#55556a]">{r.label}</span>
                <span className="text-[#f0f0f5]">{r.value}%</span>
              </div>
              <div className="h-2 bg-[#1e1e2a] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${r.value}%`, backgroundColor: r.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Epoch progress */}
        <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#f0f0f5]">Training Progress</h3>
          <div className="flex justify-between text-xs text-[#55556a]">
            <span>Epoch {job.currentEpoch} / {job.totalEpochs}</span>
            <span>ETA: {job.eta}</span>
          </div>
          <div className="h-3 bg-[#1e1e2a] rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', job.status === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-[#7c6af7] to-[#a89bff]')}
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#a89bff] font-medium">{job.progress}%</span>
            {job.startTime && (
              <span className="text-[#44445a]">Started {new Date(job.startTime).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics chart */}
      {metrics.length > 0 && (
        <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#f0f0f5]">Metrics Over Epochs</h3>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#7c6af7] inline-block" />Train Loss</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#fb923c] inline-block" />Val Loss</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#4ade80] inline-block" />mAP50</span>
            </div>
          </div>
          <LineChart data={metrics} />
        </div>
      )}

      {/* Log viewer */}
      <div className="bg-[#0a0a10] border border-[#1e1e2a] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e1e2a] bg-[#13131f]">
          <span className="text-xs font-semibold text-[#8888a8] uppercase tracking-wider">Live Logs</span>
          <span className="text-xs text-[#44445a]">{job.logs.length} entries</span>
        </div>
        <div className="h-64 overflow-y-auto p-3 font-mono text-xs space-y-1">
          {job.logs.map(log => (
            <div key={log.id} className="flex items-start gap-3">
              <span className="text-[#2a2a3a] flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0',
                log.level === 'info' ? 'bg-blue-900/60 text-blue-400' :
                log.level === 'warn' ? 'bg-yellow-900/60 text-yellow-400' :
                'bg-red-900/60 text-red-400'
              )}>{log.level}</span>
              {log.epoch && <span className="text-[#44445a] flex-shrink-0">E{log.epoch}</span>}
              <span className={cn(
                log.level === 'error' ? 'text-red-300' :
                log.level === 'warn' ? 'text-yellow-300' :
                'text-[#8888a8]'
              )}>{log.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts for failed */}
      {job.status === 'failed' && (
        <div className="bg-red-900/20 border border-red-900/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Training Failed</p>
            <p className="text-xs text-red-300/70 mt-1">
              {job.logs.filter(l => l.level === 'error').slice(-1)[0]?.message ?? 'Unknown error.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
