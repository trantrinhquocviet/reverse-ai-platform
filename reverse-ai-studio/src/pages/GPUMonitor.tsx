import { Gauge, Cpu, Thermometer, Zap, BarChart3, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
import { mockGPUNodes, mockTrainingJobs } from '@/services/mockData'
import { cn } from '@/utils/cn'

// Mock 24h usage history (hourly samples, 0-100)
const makeHistory = (base: number) =>
  Array.from({ length: 24 }, (_, i) => Math.min(100, Math.max(0, base + (Math.sin(i / 3) * 20 + Math.random() * 15 - 7.5))))

const GPU_HISTORY: Record<string, number[]> = {
  'gpu-1': makeHistory(75),
  'gpu-2': makeHistory(40),
  'gpu-3': makeHistory(20),
  'cpu-1': makeHistory(35),
}

const NOTIFICATIONS = [
  { id: 'n1', type: 'success', message: 'Training job "RT-DETR Product v2" completed successfully', time: '30m ago' },
  { id: 'n2', type: 'warn',    message: 'GPU-1 (RTX 3060) temperature reached 72°C', time: '1h ago' },
  { id: 'n3', type: 'info',   message: 'Training job "YOLOv11 v3" started on RTX 3060', time: '2h ago' },
  { id: 'n4', type: 'warn',   message: 'GPU-1 memory usage above 80%', time: '2h 15m ago' },
]

function TempGauge({ temp }: { temp: number }) {
  const color = temp > 85 ? 'text-red-400' : temp > 70 ? 'text-yellow-400' : 'text-green-400'
  const bgColor = temp > 85 ? 'bg-red-500' : temp > 70 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <Thermometer className={cn('w-3.5 h-3.5', color)} />
      <div className="flex-1 h-1.5 bg-[#1e1e2a] rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', bgColor)} style={{ width: `${(temp / 100) * 100}%` }} />
      </div>
      <span className={cn('text-xs font-medium w-12 text-right', color)}>{temp}°C</span>
    </div>
  )
}

function UsageBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#55556a]">{label}</span>
        <span className="text-[#f0f0f5]">{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-[#1e1e2a] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function MiniBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-px h-12">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{
            height: `${(v / max) * 100}%`,
            backgroundColor: v > 80 ? '#f87171' : v > 60 ? '#fbbf24' : '#7c6af7',
            opacity: 0.7,
          }}
          title={`${i}:00 — ${v.toFixed(0)}%`}
        />
      ))}
    </div>
  )
}

export function GPUMonitor() {
  const runningJobs = mockTrainingJobs.filter(j => j.status === 'training' || j.status === 'preparing')
  const queuedJobs = mockTrainingJobs.filter(j => j.status === 'queued')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f0f0f5] flex items-center gap-3">
          <Gauge className="w-7 h-7 text-[#a89bff]" />
          GPU Monitor
        </h1>
        <p className="text-[#8888a8] mt-1">Real-time GPU utilization and cluster health</p>
      </div>

      {/* GPU cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockGPUNodes.map(gpu => {
          const activeJob = runningJobs.find(j => j.gpuId === gpu.id)
          return (
            <div key={gpu.id} className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center',
                    gpu.status === 'available' ? 'bg-green-900/40' :
                    gpu.status === 'busy' ? 'bg-yellow-900/40' : 'bg-gray-800/60'
                  )}>
                    <Cpu className={cn(
                      'w-5 h-5',
                      gpu.status === 'available' ? 'text-green-400' :
                      gpu.status === 'busy' ? 'text-yellow-400' : 'text-gray-400'
                    )} />
                  </div>
                  <div>
                    <div className="font-semibold text-[#f0f0f5]">{gpu.name}</div>
                    <div className="text-xs text-[#55556a]">{gpu.memoryTotal}GB VRAM</div>
                  </div>
                </div>
                <span className={cn(
                  'text-xs px-2.5 py-1 rounded-full font-medium',
                  gpu.status === 'available' ? 'bg-green-900/40 text-green-400' :
                  gpu.status === 'busy' ? 'bg-yellow-900/40 text-yellow-400' :
                  'bg-gray-800/60 text-gray-400'
                )}>{gpu.status}</span>
              </div>

              {/* Metrics */}
              <div className="space-y-3">
                {/* VRAM */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#55556a]">VRAM</span>
                    <span className="text-[#f0f0f5]">{gpu.memoryUsed.toFixed(1)} / {gpu.memoryTotal} GB</span>
                  </div>
                  <div className="h-2 bg-[#1e1e2a] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#7c6af7]"
                      style={{ width: `${(gpu.memoryUsed / gpu.memoryTotal) * 100}%` }}
                    />
                  </div>
                </div>
                <TempGauge temp={gpu.temperature} />
                <UsageBar value={gpu.utilization} color="#4ade80" label="Utilization" />
                <div className="flex items-center gap-2 text-xs">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-[#55556a]">Power</span>
                  <span className="text-[#f0f0f5] font-medium">{gpu.power}W</span>
                </div>
              </div>

              {/* Active job */}
              {activeJob && (
                <div className="bg-[#1e1e2a] rounded-lg p-2.5 text-xs">
                  <div className="text-[#55556a] mb-1">Running Job</div>
                  <div className="text-[#f0f0f5] font-medium truncate">{activeJob.name}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-[#2a2a3a] rounded-full overflow-hidden">
                      <div className="h-full bg-[#7c6af7]" style={{ width: `${activeJob.progress}%` }} />
                    </div>
                    <span className="text-[#a89bff]">{activeJob.progress}%</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* History charts */}
      <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-[#a89bff]" />
          <h3 className="text-sm font-semibold text-[#f0f0f5]">GPU Utilization — Last 24 Hours</h3>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {mockGPUNodes.map(gpu => (
            <div key={gpu.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#8888a8]">{gpu.name}</span>
                <span className="text-xs text-[#55556a]">Avg: {(GPU_HISTORY[gpu.id].reduce((a, b) => a + b, 0) / 24).toFixed(0)}%</span>
              </div>
              <MiniBarChart data={GPU_HISTORY[gpu.id]} />
              <div className="flex justify-between text-[10px] text-[#2a2a3a] mt-1">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue + Notifications side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Queue */}
        <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[#a89bff]" />
            <h3 className="text-sm font-semibold text-[#f0f0f5]">GPU Queue</h3>
          </div>
          {queuedJobs.length === 0 ? (
            <p className="text-xs text-[#44445a]">No jobs waiting.</p>
          ) : (
            <div className="space-y-2">
              {queuedJobs.map((job, i) => (
                <div key={job.id} className="flex items-center gap-3 text-xs bg-[#1e1e2a] rounded-lg p-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2a2a3a] text-[#55556a] flex items-center justify-center flex-shrink-0 text-[10px]">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#f0f0f5] truncate">{job.name}</div>
                    <div className="text-[#44445a]">{job.modelTemplate} · {job.totalEpochs} epochs</div>
                  </div>
                  <span className="text-[#55556a] flex-shrink-0">~{Math.round(job.totalEpochs * 1.5)}min</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#f0f0f5] mb-3">Notifications</h3>
          <div className="space-y-2">
            {NOTIFICATIONS.map(n => (
              <div key={n.id} className={cn(
                'flex items-start gap-2.5 text-xs p-2.5 rounded-lg',
                n.type === 'success' ? 'bg-green-900/10' :
                n.type === 'warn' ? 'bg-yellow-900/10' :
                'bg-blue-900/10'
              )}>
                {n.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" /> :
                 n.type === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" /> :
                 <Zap className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className={cn(
                    n.type === 'success' ? 'text-green-300' : n.type === 'warn' ? 'text-yellow-300' : 'text-blue-300'
                  )}>{n.message}</p>
                  <p className="text-[#44445a] mt-0.5">{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
