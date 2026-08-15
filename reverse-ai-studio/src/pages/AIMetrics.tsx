import { useEffect, useState } from 'react'
import { BarChart2, Brain, Scan, AlertTriangle, Calendar, TrendingUp, Layers } from 'lucide-react'
import { supabase } from '@/services/api'

interface ModelStat {
  model: string
  calls: number
  success_rate: number
  error_count: number
}

interface MetricsData {
  total_frames: number
  total_tracking_codes: number
  total_barcodes: number
  frames_with_codes: number
  code_hit_rate: number
  model_stats: ModelStat[]
  event_distribution: { event: string; count: number }[]
  top_errors: { error_code: string; count: number }[]
  daily_frames: { date: string; frames: number }[]
}

const MODEL_COLORS: Record<string, string> = {
  NVIDIA: '#76b900',
  Alibaba: '#ff6a00',
  Meta: '#0064e0',
  Google: '#34a853',
  Mistral: '#7c3aed',
  Microsoft: '#00bcf2',
  ByteDance: '#fe2c55',
  Moonshot: '#6366f1',
  InternLM: '#f59e0b',
}

function providerColor(model: string): string {
  for (const [prefix, color] of Object.entries(MODEL_COLORS)) {
    if (model.toLowerCase().includes(prefix.toLowerCase().split('/')[0])) return color
  }
  return '#8888a8'
}

function shortModelName(model: string): string {
  const parts = model.split('/')
  return parts[parts.length - 1].replace(':free', '').replace(/-instruct$/, '')
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof BarChart2; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#1a1a24] border border-[#2a2a38] rounded-[12px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[#7c6af7]" />
        <span className="text-xs text-[#8888a8] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#f0f0f5]">{value}</p>
      {sub && <p className="text-xs text-[#55556a] mt-1">{sub}</p>}
    </div>
  )
}

export function AIMetrics() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setError('Not authenticated'); return }

        const resp = await fetch('/api/ai-analysis/metrics', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json() as MetricsData
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load metrics')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#7c6af7] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="p-6">
      <div className="bg-[#450a0a20] border border-[#ef444430] rounded-[12px] p-4 text-[#f87171] text-sm">{error}</div>
    </div>
  )

  if (!data) return null

  const maxCalls = Math.max(...(data.model_stats.map(m => m.calls)), 1)
  const maxDaily = Math.max(...(data.daily_frames.map(d => d.frames)), 1)
  const maxEvent = Math.max(...(data.event_distribution.map(e => e.count)), 1)

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center gap-3 mb-2">
        <BarChart2 className="w-5 h-5 text-[#7c6af7]" />
        <h1 className="text-lg font-bold text-[#f0f0f5]">AI Pipeline Metrics</h1>
        <span className="text-xs text-[#55556a] bg-[#ffffff08] px-2 py-0.5 rounded">live from processing_log</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Layers} label="Total Frames" value={data.total_frames.toLocaleString()} sub="đã xử lý" />
        <StatCard icon={Scan} label="Tracking Codes" value={data.total_tracking_codes.toLocaleString()} sub={`${data.frames_with_codes} frames có code`} />
        <StatCard icon={TrendingUp} label="OCR Hit Rate" value={`${Math.round(data.code_hit_rate * 100)}%`} sub="frames có tracking code" />
        <StatCard icon={Brain} label="Models Used" value={data.model_stats.length} sub="OpenRouter models" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model performance */}
        <div className="bg-[#1a1a24] border border-[#2a2a38] rounded-[12px] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-[#7c6af7]" />
            <h2 className="text-sm font-semibold text-[#f0f0f5]">Model Performance</h2>
          </div>
          {data.model_stats.length === 0 ? (
            <p className="text-xs text-[#55556a] text-center py-6">Chưa có dữ liệu — xử lý video để bắt đầu</p>
          ) : (
            <div className="space-y-2.5">
              {data.model_stats.map(m => (
                <div key={m.model}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-[#a89bff] truncate max-w-[200px]" title={m.model}>
                      {shortModelName(m.model)}
                    </span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[10px] text-[#55556a]">{m.calls} calls</span>
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: m.success_rate >= 0.9 ? '#4ade80' : m.success_rate >= 0.7 ? '#fcd34d' : '#f87171' }}
                      >
                        {Math.round(m.success_rate * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#0a0a10] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(m.calls / maxCalls) * 100}%`,
                        backgroundColor: providerColor(m.model),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event distribution */}
        <div className="bg-[#1a1a24] border border-[#2a2a38] rounded-[12px] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-[#7c6af7]" />
            <h2 className="text-sm font-semibold text-[#f0f0f5]">Event Distribution</h2>
          </div>
          {data.event_distribution.length === 0 ? (
            <p className="text-xs text-[#55556a] text-center py-6">Chưa có sự kiện nào</p>
          ) : (
            <div className="space-y-2">
              {data.event_distribution.map(e => (
                <div key={e.event}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#f0f0f5] uppercase tracking-wide">{e.event.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-[#55556a]">{e.count}</span>
                  </div>
                  <div className="h-1.5 bg-[#0a0a10] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7c6af7] rounded-full"
                      style={{ width: `${(e.count / maxEvent) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily activity */}
        <div className="bg-[#1a1a24] border border-[#2a2a38] rounded-[12px] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-[#7c6af7]" />
            <h2 className="text-sm font-semibold text-[#f0f0f5]">Daily Frames (30 ngày)</h2>
          </div>
          {data.daily_frames.length === 0 ? (
            <p className="text-xs text-[#55556a] text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="flex items-end gap-0.5 h-20 overflow-x-auto">
              {data.daily_frames.map(d => (
                <div key={d.date} className="flex flex-col items-center gap-0.5 flex-1 min-w-[8px]" title={`${d.date}: ${d.frames} frames`}>
                  <div
                    className="w-full bg-[#7c6af7] rounded-t-[2px] opacity-70 hover:opacity-100 transition-opacity"
                    style={{ height: `${(d.frames / maxDaily) * 64}px`, minHeight: d.frames > 0 ? '2px' : '0' }}
                  />
                </div>
              ))}
            </div>
          )}
          {data.daily_frames.length > 0 && (
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-[#44445a]">{data.daily_frames[0]?.date}</span>
              <span className="text-[9px] text-[#44445a]">{data.daily_frames[data.daily_frames.length - 1]?.date}</span>
            </div>
          )}
        </div>

        {/* Top WH errors */}
        <div className="bg-[#1a1a24] border border-[#2a2a38] rounded-[12px] p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
            <h2 className="text-sm font-semibold text-[#f0f0f5]">Top Warehouse Errors</h2>
          </div>
          {data.top_errors.length === 0 ? (
            <p className="text-xs text-[#55556a] text-center py-6">Không có lỗi — tốt lắm!</p>
          ) : (
            <div className="space-y-2">
              {data.top_errors.map((e, i) => (
                <div key={e.error_code} className="flex items-center justify-between py-1.5 border-b border-[#1e1e2a] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#44445a] w-4">{i + 1}</span>
                    <span className="text-xs font-mono text-[#f0f0f5]">{e.error_code.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-xs font-bold text-[#f87171]">{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
