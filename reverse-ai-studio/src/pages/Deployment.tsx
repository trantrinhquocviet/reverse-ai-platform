import { useState } from 'react'
import { Rocket, Square, RotateCcw, ScrollText, Upload, Zap, X } from 'lucide-react'
import { mockDeployments, mockModelRegistry } from '@/services/mockData'
import { cn } from '@/utils/cn'

const ENV_BADGE: Record<string, string> = {
  production:  'bg-green-900/40 text-green-400',
  testing:     'bg-blue-900/40 text-blue-400',
  development: 'bg-gray-800/60 text-gray-400',
  edge:        'bg-purple-900/40 text-purple-400',
}

const FMT_BADGE: Record<string, string> = {
  docker:    'bg-[#0d9488]/20 text-[#2dd4bf]',
  onnx:      'bg-orange-900/40 text-orange-400',
  tensorrt:  'bg-[#7c6af720] text-[#a89bff]',
  pytorch:   'bg-red-900/40 text-red-400',
}

const STATUS_BADGE: Record<string, string> = {
  running:   'bg-green-900/40 text-green-400',
  deploying: 'bg-blue-900/40 text-blue-400',
  stopped:   'bg-gray-800/60 text-gray-400',
  failed:    'bg-red-900/40 text-red-400',
}

const HISTORY = [
  { time: '2026-07-20 12:00', action: 'deploy',   model: 'Warehouse Object Detector v2.0', env: 'production', by: 'viet.tran' },
  { time: '2026-07-19 08:00', action: 'deploy',   model: 'Tracking Label OCR v1.2',        env: 'production', by: 'viet.tran' },
  { time: '2026-07-15 10:00', action: 'stop',     model: 'Warehouse Object Detector v1.0', env: 'development', by: 'viet.tran' },
  { time: '2026-07-10 14:00', action: 'rollback', model: 'Warehouse Object Detector v1.0', env: 'production', by: 'admin' },
]

export function Deployment() {
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [depModel, setDepModel] = useState('')
  const [depVersion, setDepVersion] = useState('')
  const [depEnv, setDepEnv] = useState<string>('testing')
  const [depFormat, setDepFormat] = useState<string>('docker')
  const [inferenceImage, setInferenceImage] = useState(false)
  const [inferenceResult, setInferenceResult] = useState(false)
  const [loading, setLoading] = useState(false)

  const selectedModel = mockModelRegistry.find(m => m.id === depModel)

  const runInference = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); setInferenceResult(true) }, 1500)
  }

  const DETECTIONS = [
    { label: 'Package', confidence: 0.942, x: 15, y: 20, w: 30, h: 35 },
    { label: 'Label', confidence: 0.881, x: 55, y: 30, w: 25, h: 20 },
    { label: 'Product', confidence: 0.763, x: 40, y: 60, w: 28, h: 25 },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f0f5] flex items-center gap-3">
            <Rocket className="w-7 h-7 text-[#a89bff]" />
            Deployment Center
          </h1>
          <p className="text-[#8888a8] mt-1">Deploy, monitor, and manage model endpoints</p>
        </div>
        <button
          onClick={() => setShowDeployModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium transition-colors"
        >
          <Rocket className="w-4 h-4" /> Deploy Model
        </button>
      </div>

      {/* Active deployments */}
      <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e2a]">
          <h3 className="text-sm font-semibold text-[#f0f0f5]">Active Deployments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e1e2a] text-[#44445a] uppercase tracking-wider">
                <th className="text-left px-4 py-2">Model</th>
                <th className="text-center px-4 py-2">Version</th>
                <th className="text-center px-4 py-2">Environment</th>
                <th className="text-center px-4 py-2">Format</th>
                <th className="text-center px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Endpoint</th>
                <th className="text-center px-4 py-2">Replicas</th>
                <th className="text-center px-4 py-2">CPU%</th>
                <th className="text-center px-4 py-2">Mem%</th>
                <th className="text-left px-4 py-2">Deployed By</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockDeployments.map(dep => (
                <tr key={dep.id} className="border-b border-[#1e1e2a]/50 hover:bg-[#1e1e2a]/40">
                  <td className="px-4 py-3 text-[#f0f0f5] font-medium">{dep.modelName}</td>
                  <td className="px-4 py-3 text-center font-mono text-[#a89bff]">{dep.modelVersion}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('px-2 py-0.5 rounded-full', ENV_BADGE[dep.environment])}>{dep.environment}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('px-2 py-0.5 rounded-full', FMT_BADGE[dep.format])}>{dep.format}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('px-2 py-0.5 rounded-full', STATUS_BADGE[dep.status])}>{dep.status}</span>
                  </td>
                  <td className="px-4 py-3 text-[#4ade80] font-mono text-[10px] truncate max-w-xs">
                    {dep.endpoint ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-[#8888a8]">{dep.replicas}</td>
                  <td className="px-4 py-3 text-center">
                    {dep.cpuUsage > 0 ? (
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1.5 bg-[#1e1e2a] rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${dep.cpuUsage}%` }} />
                        </div>
                        <span className="text-[#55556a]">{dep.cpuUsage}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {dep.memoryUsage > 0 ? (
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1.5 bg-[#1e1e2a] rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500" style={{ width: `${dep.memoryUsage}%` }} />
                        </div>
                        <span className="text-[#55556a]">{dep.memoryUsage}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#55556a]">{dep.deployedBy}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button className="text-[#55556a] hover:text-red-400 transition-colors" title="Stop">
                        <Square className="w-3.5 h-3.5" />
                      </button>
                      <button className="text-[#55556a] hover:text-yellow-400 transition-colors" title="Rollback">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button className="text-[#55556a] hover:text-[#a89bff] transition-colors" title="Logs">
                        <ScrollText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deployment history */}
      <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[#f0f0f5] mb-4">Deployment History</h3>
        <div className="space-y-3">
          {HISTORY.map((h, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={cn(
                'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                h.action === 'deploy' ? 'bg-green-400' : h.action === 'rollback' ? 'bg-yellow-400' : 'bg-gray-400'
              )} />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                    h.action === 'deploy' ? 'bg-green-900/40 text-green-400' :
                    h.action === 'rollback' ? 'bg-yellow-900/40 text-yellow-400' :
                    'bg-gray-800/60 text-gray-400'
                  )}>{h.action}</span>
                  <span className="text-[#f0f0f5]">{h.model}</span>
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[9px]', ENV_BADGE[h.env])}>{h.env}</span>
                </div>
                <div className="text-[10px] text-[#44445a] mt-0.5">{h.time} · by {h.by}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inference Playground */}
      <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#a89bff]" />
          <h3 className="text-sm font-semibold text-[#f0f0f5]">Inference Playground</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: upload */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#55556a] mb-1">Select Deployed Model</label>
              <select className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]">
                {mockDeployments.filter(d => d.status === 'running').map(d => (
                  <option key={d.id}>{d.modelName} {d.modelVersion} ({d.environment})</option>
                ))}
              </select>
            </div>
            <div
              onClick={() => setInferenceImage(true)}
              className="border-2 border-dashed border-[#2a2a3a] rounded-xl p-8 text-center hover:border-[#7c6af7] transition-colors cursor-pointer"
            >
              {inferenceImage ? (
                <div className="bg-gradient-to-br from-[#2a2a3a] to-[#1e1e2a] h-32 rounded-lg flex items-center justify-center text-[#44445a] text-sm">
                  Image loaded
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-[#44445a] mx-auto mb-2" />
                  <p className="text-xs text-[#55556a]">Drop image here or click</p>
                </>
              )}
            </div>
            <button
              onClick={runInference}
              disabled={!inferenceImage || loading}
              className="w-full py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {loading ? 'Processing...' : 'Run Inference'}
            </button>
          </div>

          {/* Right: results */}
          <div>
            {inferenceResult ? (
              <div className="space-y-3">
                {/* SVG overlay placeholder */}
                <div className="relative bg-gradient-to-br from-[#2a2a3a] to-[#1e1e2a] rounded-xl h-48 overflow-hidden">
                  <svg className="absolute inset-0 w-full h-full">
                    {DETECTIONS.map((d, i) => (
                      <g key={i}>
                        <rect
                          x={`${d.x}%`} y={`${d.y}%`}
                          width={`${d.w}%`} height={`${d.h}%`}
                          fill="none" stroke="#7c6af7" strokeWidth={2}
                        />
                        <rect x={`${d.x}%`} y={`${d.y - 5}%`} width="60" height="14" fill="#7c6af7" fillOpacity={0.9} />
                        <text x={`${d.x + 1}%`} y={`${d.y - 0.5}%`} fill="white" fontSize={9}>{d.label} {Math.round(d.confidence * 100)}%</text>
                      </g>
                    ))}
                  </svg>
                </div>
                <div className="space-y-1.5">
                  {DETECTIONS.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="text-[#f0f0f5] w-16">{d.label}</span>
                      <div className="flex-1 h-1.5 bg-[#1e1e2a] rounded-full overflow-hidden">
                        <div className="h-full bg-[#7c6af7]" style={{ width: `${d.confidence * 100}%` }} />
                      </div>
                      <span className="text-[#a89bff] w-10 text-right">{(d.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-[#44445a]">
                  <span>Processing: 12.4ms</span>
                  <span>·</span>
                  <span>FPS: 80.6</span>
                  <span>·</span>
                  <span>{DETECTIONS.length} detections</span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-1.5 rounded-lg border border-[#2a2a3a] text-[#8888a8] text-xs hover:text-white transition-colors">Export JSON</button>
                  <button className="flex-1 py-1.5 rounded-lg border border-[#2a2a3a] text-[#8888a8] text-xs hover:text-white transition-colors">Export Image</button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[#44445a] text-sm">
                Run inference to see results
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deploy modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#13131f] border border-[#2a2a3a] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#f0f0f5]">Deploy Model</h3>
              <button onClick={() => setShowDeployModal(false)} className="text-[#55556a] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#55556a] mb-1">Model</label>
                <select
                  value={depModel}
                  onChange={e => { setDepModel(e.target.value); setDepVersion('') }}
                  className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
                >
                  <option value="">Select model...</option>
                  {mockModelRegistry.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#55556a] mb-1">Version</label>
                <select
                  value={depVersion}
                  onChange={e => setDepVersion(e.target.value)}
                  disabled={!selectedModel}
                  className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7] disabled:opacity-40"
                >
                  <option value="">Select version...</option>
                  {selectedModel?.versions.map(v => <option key={v.id} value={v.id}>{v.version}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#55556a] mb-1">Environment</label>
                <select
                  value={depEnv}
                  onChange={e => setDepEnv(e.target.value)}
                  className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
                >
                  {['development', 'testing', 'production', 'edge'].map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#55556a] mb-1">Format</label>
                <select
                  value={depFormat}
                  onChange={e => setDepFormat(e.target.value)}
                  className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
                >
                  {['docker', 'onnx', 'tensorrt', 'pytorch'].map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeployModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a3a] text-[#8888a8] text-sm hover:text-white transition-colors"
                >Cancel</button>
                <button
                  onClick={() => setShowDeployModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium transition-colors"
                >Deploy</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
