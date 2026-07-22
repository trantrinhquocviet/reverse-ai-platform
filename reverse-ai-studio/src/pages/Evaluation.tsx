import { useState } from 'react'
import { Target, Upload, Download, RefreshCw } from 'lucide-react'
import { mockModelRegistry, mockEvaluationReports } from '@/services/mockData'
import { cn } from '@/utils/cn'

// Simple confusion matrix (4x4 heatmap)
const CM_CLASSES = ['Package', 'Product', 'Label', 'Damage']
const CM_DATA = [
  [412, 18, 4, 2],
  [22, 387, 8, 3],
  [5, 12, 341, 7],
  [3, 6, 9, 298],
]
const CM_MAX = Math.max(...CM_DATA.flat())

function ConfusionMatrix() {
  return (
    <div>
      <div className="text-xs text-[#55556a] mb-2">Predicted →</div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-around text-[10px] text-[#44445a] pr-2" style={{ height: CM_CLASSES.length * 48 + 'px' }}>
          {CM_CLASSES.map(c => <span key={c} className="text-right leading-none">{c}</span>)}
        </div>
        <div>
          <div className="flex gap-px mb-px">
            {CM_CLASSES.map(c => <div key={c} className="w-12 text-center text-[9px] text-[#44445a]">{c}</div>)}
          </div>
          {CM_DATA.map((row, ri) => (
            <div key={ri} className="flex gap-px mb-px">
              {row.map((val, ci) => {
                const intensity = val / CM_MAX
                return (
                  <div
                    key={ci}
                    className="w-12 h-12 flex items-center justify-center text-[10px] font-medium rounded transition-all"
                    style={{
                      backgroundColor: ri === ci
                        ? `rgba(124, 106, 247, ${0.2 + intensity * 0.7})`
                        : `rgba(251, 146, 60, ${intensity * 0.6})`,
                      color: intensity > 0.5 ? '#f0f0f5' : '#8888a8',
                    }}
                    title={`True: ${CM_CLASSES[ri]}, Pred: ${CM_CLASSES[ci]}: ${val}`}
                  >
                    {val}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Evaluation() {
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [evalSource, setEvalSource] = useState<'dataset' | 'images' | 'video'>('dataset')
  const [hasResults, setHasResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const model = mockModelRegistry.find(m => m.id === selectedModel)
  const report = mockEvaluationReports[0]

  const runEval = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); setHasResults(true) }, 1800)
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  return (
    <div className="p-6 space-y-6">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#7c6af7] text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
          {toastMsg}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-[#f0f0f5] flex items-center gap-3">
          <Target className="w-7 h-7 text-[#a89bff]" />
          Model Evaluation
        </h1>
        <p className="text-[#8888a8] mt-1">Evaluate model performance on datasets or custom images</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Config */}
        <div className="space-y-4">
          <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-[#f0f0f5]">Evaluation Setup</h3>
            <div>
              <label className="block text-xs text-[#55556a] mb-1">Select Model</label>
              <select
                value={selectedModel}
                onChange={e => { setSelectedModel(e.target.value); setSelectedVersion('') }}
                className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
              >
                <option value="">Choose model...</option>
                {mockModelRegistry.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#55556a] mb-1">Model Version</label>
              <select
                value={selectedVersion}
                onChange={e => setSelectedVersion(e.target.value)}
                disabled={!model}
                className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7] disabled:opacity-40"
              >
                <option value="">Choose version...</option>
                {model?.versions.map(v => <option key={v.id} value={v.id}>{v.version}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#55556a] mb-2">Evaluation Source</label>
              <div className="flex gap-2">
                {(['dataset', 'images', 'video'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setEvalSource(s)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs capitalize transition-colors',
                      evalSource === s ? 'bg-[#7c6af720] text-[#a89bff] border border-[#7c6af740]' : 'bg-[#1e1e2a] text-[#55556a] hover:text-white'
                    )}
                  >{s}</button>
                ))}
              </div>
            </div>
            {evalSource !== 'dataset' && (
              <div className="border-2 border-dashed border-[#2a2a3a] rounded-xl p-6 text-center hover:border-[#7c6af7] transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-[#44445a] mx-auto mb-2" />
                <p className="text-xs text-[#55556a]">Drop {evalSource === 'images' ? 'images' : 'video'} here</p>
                <p className="text-[10px] text-[#2a2a3a] mt-1">or click to browse</p>
              </div>
            )}
            <button
              onClick={runEval}
              disabled={loading || !selectedModel}
              className="w-full py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              {loading ? 'Evaluating...' : 'Run Evaluation'}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2 space-y-4">
          {hasResults ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Precision', value: report.precision.toFixed(3), color: 'text-blue-400' },
                  { label: 'Recall', value: report.recall.toFixed(3), color: 'text-purple-400' },
                  { label: 'F1 Score', value: report.f1.toFixed(3), color: 'text-pink-400' },
                  { label: 'mAP50', value: report.mAP50.toFixed(3), color: 'text-green-400' },
                  { label: 'mAP50-95', value: report.mAP5095.toFixed(3), color: 'text-green-300' },
                  { label: 'Infer Speed', value: `${report.inferenceSpeedMs}ms`, color: 'text-yellow-400' },
                  { label: 'False Pos', value: report.falsePositives, color: 'text-orange-400' },
                  { label: 'False Neg', value: report.falseNegatives, color: 'text-red-400' },
                  { label: 'IoU', value: report.iou.toFixed(3), color: 'text-[#a89bff]' },
                ].map(s => (
                  <div key={s.label} className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-3 text-center">
                    <div className={cn('text-lg font-bold', s.color)}>{s.value}</div>
                    <div className="text-[10px] text-[#44445a] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Misclassified samples */}
              <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[#f0f0f5] mb-3">Misclassified Samples</h3>
                <div className="grid grid-cols-4 gap-3">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="bg-[#1e1e2a] rounded-lg overflow-hidden">
                      <div className="h-20 bg-gradient-to-br from-[#2a2a3a] to-[#1e1e2a] flex items-center justify-center">
                        <span className="text-[#44445a] text-xs">Frame {i + 1}</span>
                      </div>
                      <div className="p-2 text-[9px]">
                        <div className="text-red-400">Pred: {['Package', 'Product', 'Label', 'Damage'][i % 4]}</div>
                        <div className="text-green-400">GT: {['Product', 'Package', 'Damage', 'Label'][i % 4]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confusion matrix */}
              <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[#f0f0f5] mb-4">Confusion Matrix</h3>
                <ConfusionMatrix />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => showToast('Report downloaded!')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e1e2a] border border-[#2a2a3a] text-[#8888a8] text-sm hover:text-white transition-colors"
                >
                  <Download className="w-4 h-4" /> Download Report
                </button>
              </div>
            </>
          ) : (
            <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-12 text-center">
              <Target className="w-12 h-12 text-[#2a2a3a] mx-auto mb-3" />
              <p className="text-[#44445a] text-sm">Configure and run an evaluation to see results</p>
            </div>
          )}
        </div>
      </div>

      {/* Previous reports */}
      <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e2a]">
          <h3 className="text-sm font-semibold text-[#f0f0f5]">Previous Evaluation Reports</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e1e2a] text-[#44445a] uppercase tracking-wider">
              <th className="text-left px-4 py-2">Model</th>
              <th className="text-center px-4 py-2">Version</th>
              <th className="text-center px-4 py-2">Dataset</th>
              <th className="text-center px-4 py-2">mAP50</th>
              <th className="text-center px-4 py-2">F1</th>
              <th className="text-center px-4 py-2">Precision</th>
              <th className="text-center px-4 py-2">Recall</th>
              <th className="text-left px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {mockEvaluationReports.map(r => {
              const m = mockModelRegistry.find(x => x.id === r.modelId)
              return (
                <tr key={r.id} className="border-b border-[#1e1e2a]/50 hover:bg-[#1e1e2a]/40">
                  <td className="px-4 py-2 text-[#f0f0f5]">{m?.name ?? r.modelId}</td>
                  <td className="px-4 py-2 text-center font-mono text-[#a89bff]">{r.modelVersion}</td>
                  <td className="px-4 py-2 text-center text-[#55556a]">{r.datasetVersion}</td>
                  <td className="px-4 py-2 text-center text-green-400 font-medium">{r.mAP50.toFixed(3)}</td>
                  <td className="px-4 py-2 text-center text-[#f0f0f5]">{r.f1.toFixed(3)}</td>
                  <td className="px-4 py-2 text-center text-[#f0f0f5]">{r.precision.toFixed(3)}</td>
                  <td className="px-4 py-2 text-center text-[#f0f0f5]">{r.recall.toFixed(3)}</td>
                  <td className="px-4 py-2 text-[#44445a]">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
