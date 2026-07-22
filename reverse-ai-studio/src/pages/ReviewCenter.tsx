import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Check, X, Edit3, Filter, ToggleRight, ToggleLeft } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockAIAnnotationSuggestions, mockReviewSessions } from '@/services/mockData'
import type { AIAnnotationSuggestion } from '@/types'

const LABEL_COLORS: Record<string, string> = {
  TrackingLabel:  'text-[#a89bff] bg-[#7c6af720]',
  Barcode:        'text-[#60a5fa] bg-[#3b82f620]',
  QRCode:         'text-[#34d399] bg-[#10b98120]',
  ProductRegion:  'text-[#f59e0b] bg-[#f59e0b20]',
  Packaging:      'text-[#f97316] bg-[#f9731620]',
  PossibleDamage: 'text-[#f87171] bg-[#dc262620]',
  OCRRegion:      'text-[#e879f9] bg-[#a21caf20]',
}

function ConfBar({ value }: { value: number }) {
  const color = value >= 90 ? 'bg-[#4ade80]' : value >= 70 ? 'bg-[#fbbf24]' : 'bg-[#f87171]'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-[#1e1e2a]">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] font-mono text-[#8888a8] w-7 text-right">{value}%</span>
    </div>
  )
}

// Group suggestions by frameId
function groupByFrame(suggestions: AIAnnotationSuggestion[]) {
  const map: Record<string, AIAnnotationSuggestion[]> = {}
  for (const s of suggestions) {
    if (!map[s.frameId]) map[s.frameId] = []
    map[s.frameId].push(s)
  }
  return Object.entries(map).map(([frameId, subs]) => ({
    frameId,
    suggestions: subs,
    avgConf: Math.round(subs.reduce((a, s) => a + s.confidence, 0) / subs.length),
  }))
}

export function ReviewCenter() {
  const navigate = useNavigate()
  const [smartMode, setSmartMode] = useState(false)
  const [threshold, setThreshold] = useState(85)
  const [confRange, setConfRange] = useState<[number, number]>([0, 100])
  const [statusFilter, setStatusFilter] = useState('all')
  const [reviewerFilter, setReviewerFilter] = useState('all')
  const [suggestionStates, setSuggestionStates] = useState<Record<string, 'approved' | 'rejected'>>({})

  const todaySession = mockReviewSessions[0]

  let groups = groupByFrame(mockAIAnnotationSuggestions)
  if (smartMode) groups = groups.filter(g => g.avgConf < threshold)
  groups = groups.filter(g => g.avgConf >= confRange[0] && g.avgConf <= confRange[1])
  if (statusFilter !== 'all') groups = groups.filter(g => g.suggestions.some(s => s.status === statusFilter))

  const approve = (id: string) => setSuggestionStates(s => ({ ...s, [id]: 'approved' }))
  const reject  = (id: string) => setSuggestionStates(s => ({ ...s, [id]: 'rejected' }))

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left filter panel */}
      <div className="w-56 flex-shrink-0 border-r border-[#1e1e2a] bg-[#0d0d14] p-4 space-y-5 overflow-y-auto">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#55556a]" />
          <span className="text-xs font-semibold text-[#8888a8] uppercase tracking-wider">Filters</span>
        </div>

        <div>
          <label className="text-[10px] text-[#55556a] block mb-1">Min Confidence</label>
          <input type="range" min={0} max={100} value={confRange[0]}
            onChange={e => setConfRange([+e.target.value, confRange[1]])}
            className="w-full accent-[#7c6af7]" />
          <div className="flex justify-between text-[10px] text-[#55556a]">
            <span>{confRange[0]}%</span><span>{confRange[1]}%</span>
          </div>
          <input type="range" min={0} max={100} value={confRange[1]}
            onChange={e => setConfRange([confRange[0], +e.target.value])}
            className="w-full accent-[#7c6af7]" />
        </div>

        <div>
          <label className="text-[10px] text-[#55556a] block mb-1">Status</label>
          {['all','pending','approved','rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('block w-full text-left px-2 py-1 rounded text-xs mb-0.5 capitalize transition-colors', statusFilter === s ? 'bg-[#7c6af720] text-[#a89bff]' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
              {s}
            </button>
          ))}
        </div>

        <div>
          <label className="text-[10px] text-[#55556a] block mb-1">Reviewer</label>
          {['all','Viet Tran','Lan Nguyen','Minh Le'].map(r => (
            <button key={r} onClick={() => setReviewerFilter(r)}
              className={cn('block w-full text-left px-2 py-1 rounded text-xs mb-0.5 transition-colors', reviewerFilter === r ? 'bg-[#7c6af720] text-[#a89bff]' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#1e1e2a] bg-[#0d0d14]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#7c6af720] flex items-center justify-center">
              <Eye className="w-4 h-4 text-[#a89bff]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#f0f0f5]">Review Center</h1>
              <p className="text-xs text-[#55556a]">{groups.length} frames to review</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Today's progress */}
            <div className="flex items-center gap-4 text-xs">
              {[
                { label: "Reviewed",  value: todaySession.framesReviewed, color: 'text-[#f0f0f5]' },
                { label: "Approved",  value: todaySession.approvals,      color: 'text-[#4ade80]' },
                { label: "Rejected",  value: todaySession.rejections,     color: 'text-[#f87171]' },
                { label: "Avg Time",  value: `${(todaySession.avgReviewTimeMs / 1000).toFixed(1)}s`, color: 'text-[#60a5fa]' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className={cn('font-bold', s.color)}>{s.value}</div>
                  <div className="text-[10px] text-[#55556a]">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Smart mode */}
            <div className="flex items-center gap-2">
              <button onClick={() => setSmartMode(m => !m)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', smartMode ? 'bg-[#7c6af7] text-white' : 'bg-[#1e1e2a] text-[#8888a8] hover:text-[#f0f0f5]')}>
                {smartMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                Smart Review
              </button>
              {smartMode && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-[#55556a]">&lt;</span>
                  <input type="number" value={threshold} min={50} max={100}
                    onChange={e => setThreshold(+e.target.value)}
                    className="w-14 bg-[#0d0d14] border border-[#1e1e2a] rounded px-2 py-1 text-xs text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]" />
                  <span className="text-xs text-[#55556a]">%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cards grid */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {groups.map(group => (
              <div key={group.frameId} className="bg-[#12121c] border border-[#1e1e2a] rounded-xl overflow-hidden hover:border-[#2e2e3a] transition-colors">
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2a]">
                  <div>
                    <span className="text-sm font-semibold text-[#f0f0f5]">Frame {group.frameId}</span>
                    <span className="text-xs text-[#55556a] ml-2">·  {group.suggestions.length} suggestions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#55556a]">Avg confidence</span>
                    <span className={cn('text-sm font-bold', group.avgConf >= 90 ? 'text-[#4ade80]' : group.avgConf >= 70 ? 'text-[#fbbf24]' : 'text-[#f87171]')}>
                      {group.avgConf}%
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="w-24 h-16 flex-shrink-0 bg-[#1a1a28] rounded-lg flex items-center justify-center">
                    <span className="text-[10px] text-[#2e2e3a] font-mono">{group.frameId}</span>
                  </div>

                  {/* Suggestions */}
                  <div className="flex-1 space-y-2">
                    {group.suggestions.map(s => {
                      const state = suggestionStates[s.id]
                      return (
                        <div key={s.id} className={cn('flex items-center gap-2 p-2 rounded-lg transition-colors', state === 'approved' ? 'bg-[#16a34a10]' : state === 'rejected' ? 'bg-[#dc262610]' : 'bg-[#1a1a28]')}>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0', LABEL_COLORS[s.label] ?? 'text-[#8888a8] bg-[#1e1e2a]')}>
                            {s.label}
                          </span>
                          <div className="flex-1">
                            <ConfBar value={s.confidence} />
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => approve(s.id)}
                              className={cn('p-1 rounded transition-colors', state === 'approved' ? 'bg-[#4ade80] text-white' : 'bg-[#16a34a20] text-[#4ade80] hover:bg-[#16a34a40]')}>
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => reject(s.id)}
                              className={cn('p-1 rounded transition-colors', state === 'rejected' ? 'bg-[#f87171] text-white' : 'bg-[#dc262620] text-[#f87171] hover:bg-[#dc262640]')}>
                              <X className="w-3 h-3" />
                            </button>
                            <button onClick={() => navigate(`/annotation-editor/${s.frameId}`)}
                              className="p-1 rounded bg-[#3b82f620] text-[#60a5fa] hover:bg-[#3b82f640] transition-colors">
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
