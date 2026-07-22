import { useState } from 'react'
import { FlaskConical, ChevronDown, X } from 'lucide-react'
import { mockExperiments, mockMetricHistory } from '@/services/mockData'
import type { Experiment } from '@/types'
import { cn } from '@/utils/cn'

function MiniChart({ expId }: { expId: string }) {
  const data = mockMetricHistory[expId]
  if (!data || data.length === 0) return <div className="text-xs text-[#44445a] italic">No chart data</div>
  const maxMAP = Math.max(...data.map(d => d.mAP50))
  const minMAP = Math.min(...data.map(d => d.mAP50))
  const w = 200, h = 60
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((d.mAP50 - minMAP) / (maxMAP - minMAP || 1)) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#7c6af7" strokeWidth={1.5} />
    </svg>
  )
}

function ComparisonPanel({ exps, onClose }: { exps: Experiment[]; onClose: () => void }) {
  const metrics: { key: keyof Experiment; label: string; higher?: boolean }[] = [
    { key: 'finalMaP50', label: 'mAP50', higher: true },
    { key: 'finalAccuracy', label: 'Accuracy %', higher: true },
    { key: 'finalRecall', label: 'Recall', higher: true },
    { key: 'finalPrecision', label: 'Precision', higher: true },
    { key: 'f1Score', label: 'F1 Score', higher: true },
    { key: 'inferenceSpeed', label: 'Infer Speed (ms)', higher: false },
    { key: 'modelSizeMB', label: 'Model Size (MB)', higher: false },
  ]
  return (
    <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2a]">
        <span className="text-sm font-semibold text-[#f0f0f5]">Model Comparison</span>
        <button onClick={onClose} className="text-[#55556a] hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e1e2a]">
              <th className="text-left px-4 py-2 text-[#55556a]">Metric</th>
              {exps.map(e => (
                <th key={e.id} className="text-center px-4 py-2 text-[#8888a8]">{e.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => {
              const vals = exps.map(e => Number(e[m.key]))
              const best = m.higher ? Math.max(...vals) : Math.min(...vals)
              return (
                <tr key={m.key} className="border-b border-[#1e1e2a]/50 hover:bg-[#1e1e2a]/40">
                  <td className="px-4 py-2 text-[#55556a]">{m.label}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={cn('px-4 py-2 text-center font-medium', v === best ? 'text-green-400 bg-green-900/10' : 'text-[#f0f0f5]')}>
                      {v.toFixed(3)}
                      {v === best && <span className="ml-1 text-[9px]">★</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Experiments() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  const [showComparison, setShowComparison] = useState(false)
  const [filterModel, setFilterModel] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const models = Array.from(new Set(mockExperiments.map(e => e.modelTemplate)))

  const filtered = mockExperiments.filter(e =>
    (filterModel === 'all' || e.modelTemplate === filterModel) &&
    (filterStatus === 'all' || e.status === filterStatus)
  )

  const toggleCompare = (id: string) => {
    setSelectedForCompare(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    )
  }

  const compareExps = mockExperiments.filter(e => selectedForCompare.includes(e.id))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f0f5] flex items-center gap-3">
            <FlaskConical className="w-7 h-7 text-[#a89bff]" />
            Experiment Tracker
          </h1>
          <p className="text-[#8888a8] mt-1">Compare and analyze training experiments</p>
        </div>
        {selectedForCompare.length >= 2 && (
          <button
            onClick={() => setShowComparison(true)}
            className="px-4 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium transition-colors"
          >
            Compare {selectedForCompare.length} Experiments
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={filterModel}
          onChange={e => setFilterModel(e.target.value)}
          className="bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
        >
          <option value="all">All Models</option>
          {models.map(m => <option key={m}>{m}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        {selectedForCompare.length > 0 && (
          <span className="text-xs text-[#8888a8]">{selectedForCompare.length}/3 selected for comparison</span>
        )}
      </div>

      {/* Comparison panel */}
      {showComparison && compareExps.length >= 2 && (
        <ComparisonPanel exps={compareExps} onClose={() => setShowComparison(false)} />
      )}

      {/* Experiments table */}
      <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e1e2a] text-[#55556a] uppercase tracking-wider">
              <th className="w-8 px-3 py-3"></th>
              <th className="text-left px-3 py-3">Name</th>
              <th className="text-left px-3 py-3">Model</th>
              <th className="text-center px-3 py-3">Epochs</th>
              <th className="text-center px-3 py-3">LR</th>
              <th className="text-center px-3 py-3">Batch</th>
              <th className="text-center px-3 py-3">mAP50</th>
              <th className="text-center px-3 py-3">Acc%</th>
              <th className="text-center px-3 py-3">F1</th>
              <th className="text-center px-3 py-3">Speed</th>
              <th className="text-center px-3 py-3">Size</th>
              <th className="text-left px-3 py-3">By</th>
              <th className="text-center px-3 py-3">Status</th>
              <th className="w-8 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(exp => (
              <>
                <tr
                  key={exp.id}
                  className="border-b border-[#1e1e2a]/50 hover:bg-[#1e1e2a]/40 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedForCompare.includes(exp.id)}
                      onChange={() => toggleCompare(exp.id)}
                      onClick={e => e.stopPropagation()}
                      className="accent-[#7c6af7]"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-[#f0f0f5] font-medium">{exp.name}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-[#7c6af720] text-[#a89bff]">{exp.modelTemplate}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-[#8888a8]">{exp.epochs}</td>
                  <td className="px-3 py-2.5 text-center text-[#8888a8]">{exp.learningRate}</td>
                  <td className="px-3 py-2.5 text-center text-[#8888a8]">{exp.batchSize}</td>
                  <td className="px-3 py-2.5 text-center font-medium text-green-400">{exp.finalMaP50.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-center text-[#f0f0f5]">{exp.finalAccuracy.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-center text-[#f0f0f5]">{exp.f1Score.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-center text-[#8888a8]">{exp.inferenceSpeed}ms</td>
                  <td className="px-3 py-2.5 text-center text-[#8888a8]">{exp.modelSizeMB}MB</td>
                  <td className="px-3 py-2.5 text-[#55556a]">{exp.createdBy}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-full text-[9px] font-medium',
                      exp.status === 'completed' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
                    )}>{exp.status}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <ChevronDown className={cn('w-3.5 h-3.5 text-[#44445a] transition-transform', expandedId === exp.id && 'rotate-180')} />
                  </td>
                </tr>
                {expandedId === exp.id && (
                  <tr key={`${exp.id}-expand`} className="bg-[#0d0d14]">
                    <td colSpan={14} className="px-6 py-4">
                      <div className="flex gap-8">
                        <div className="space-y-1 text-xs">
                          <div className="text-[#55556a] mb-2 font-semibold uppercase tracking-wider">Full Metrics</div>
                          {[
                            { l: 'Recall', v: exp.finalRecall.toFixed(3) },
                            { l: 'Precision', v: exp.finalPrecision.toFixed(3) },
                            { l: 'Training Time', v: exp.trainingTime },
                            { l: 'Dataset', v: exp.datasetVersion },
                            { l: 'Created', v: new Date(exp.createdAt).toLocaleDateString() },
                          ].map(row => (
                            <div key={row.l} className="flex gap-4">
                              <span className="w-28 text-[#44445a]">{row.l}</span>
                              <span className="text-[#f0f0f5]">{row.v}</span>
                            </div>
                          ))}
                        </div>
                        {mockMetricHistory[exp.id] && (
                          <div>
                            <div className="text-[10px] text-[#55556a] uppercase tracking-wider mb-2">mAP50 Curve</div>
                            <MiniChart expId={exp.id} />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
