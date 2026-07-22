import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Filter, BarChart3, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'
import { mockTrainingJobs, mockGPUNodes } from '@/services/mockData'
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

export function TrainingJobs() {
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'progress' | 'mAP'>('date')

  const jobs = mockTrainingJobs
    .filter(j => filterStatus === 'all' || j.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'progress') return b.progress - a.progress
      if (sortBy === 'mAP') return b.mAP50 - a.mAP50
      return new Date(b.startTime || '1970').getTime() - new Date(a.startTime || '1970').getTime()
    })

  const stats = {
    total: mockTrainingJobs.length,
    running: mockTrainingJobs.filter(j => j.status === 'training').length,
    queued: mockTrainingJobs.filter(j => j.status === 'queued').length,
    completed: mockTrainingJobs.filter(j => j.status === 'completed').length,
    failed: mockTrainingJobs.filter(j => j.status === 'failed').length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f0f5] flex items-center gap-3">
            <Play className="w-7 h-7 text-[#a89bff]" />
            Training Jobs
          </h1>
          <p className="text-[#8888a8] mt-1">Monitor and manage your model training runs</p>
        </div>
        <button
          onClick={() => navigate('/training-center')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium transition-colors"
        >
          <Play className="w-4 h-4" /> New Job
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-[#a89bff]' },
          { label: 'Running', value: stats.running, color: 'text-yellow-400' },
          { label: 'Queued', value: stats.queued, color: 'text-blue-400' },
          { label: 'Completed', value: stats.completed, color: 'text-green-400' },
          { label: 'Failed', value: stats.failed, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4 text-center">
            <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
            <div className="text-xs text-[#55556a] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-[#55556a]" />
        <div className="flex gap-2">
          {['all', 'queued', 'training', 'completed', 'failed'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                filterStatus === s
                  ? 'bg-[#7c6af720] text-[#a89bff] border border-[#7c6af740]'
                  : 'bg-[#1e1e2a] text-[#55556a] hover:text-white'
              )}
            >{s === 'all' ? 'All Jobs' : s}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-[#55556a]">
          Sort:
          {(['date', 'progress', 'mAP'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn('px-2 py-1 rounded', sortBy === s ? 'text-[#a89bff]' : 'hover:text-white')}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-3">
        {jobs.map(job => {
          const cfg = STATUS_CONFIG[job.status]
          const gpu = mockGPUNodes.find(g => g.id === job.gpuId)
          return (
            <div
              key={job.id}
              onClick={() => navigate(`/training-jobs/${job.id}`)}
              className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4 cursor-pointer hover:border-[#2a2a3a] transition-all group"
            >
              <div className="flex items-center gap-4">
                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium text-[#f0f0f5] group-hover:text-[#a89bff] transition-colors truncate">{job.name}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full flex-shrink-0', cfg.bg, cfg.color)}>
                      <cfg.icon className="w-3 h-3 inline mr-1" />{cfg.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e1e2a] text-[#8888a8] flex-shrink-0">{job.modelTemplate}</span>
                    <span className="text-xs text-[#55556a] flex-shrink-0">Dataset {job.datasetVersion}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-[#1e1e2a] rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', job.status === 'failed' ? 'bg-red-500' : 'bg-[#7c6af7]')}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#55556a] w-10 text-right">{job.progress}%</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="hidden lg:flex items-center gap-6 text-xs flex-shrink-0">
                  <div className="text-center">
                    <div className="text-[#f0f0f5] font-medium">{job.currentEpoch}/{job.totalEpochs}</div>
                    <div className="text-[#44445a]">Epoch</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#f0f0f5] font-medium">{job.mAP50 > 0 ? job.mAP50.toFixed(3) : '—'}</div>
                    <div className="text-[#44445a]">mAP50</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#f0f0f5] font-medium">{job.eta}</div>
                    <div className="text-[#44445a]">ETA</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#f0f0f5] font-medium">{gpu?.name ?? '—'}</div>
                    <div className="text-[#44445a]">GPU</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#8888a8]">{job.createdBy}</div>
                    <div className="text-[#44445a]">By</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {job.status === 'training' && (
                    <button
                      onClick={e => e.stopPropagation()}
                      className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors"
                    >Cancel</button>
                  )}
                  <button
                    onClick={e => e.stopPropagation()}
                    className="text-xs px-2 py-1 rounded bg-[#1e1e2a] text-[#8888a8] hover:text-white transition-colors"
                  >Clone</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
