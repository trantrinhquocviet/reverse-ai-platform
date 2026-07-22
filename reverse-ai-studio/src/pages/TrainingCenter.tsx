import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain, ChevronRight, Database, Settings2, Cpu, FlaskConical, BarChart3, Archive, Rocket,
  CheckCircle2, Plus,
} from 'lucide-react'
import { mockTrainingTemplates, mockGPUNodes, mockDatasetRecord } from '@/services/mockData'

const mockDatasetRecords = [mockDatasetRecord]
import type { HyperparamConfig, TrainingTemplate, GPUNode } from '@/types'
import { cn } from '@/utils/cn'

const STEPS = [
  { label: 'Dataset', icon: Database },
  { label: 'Model', icon: Brain },
  { label: 'Hyperparams', icon: Settings2 },
  { label: 'GPU', icon: Cpu },
]

const WORKFLOW = [
  { label: 'Dataset', icon: Database },
  { label: 'Config', icon: Settings2 },
  { label: 'Training Job', icon: Brain },
  { label: 'GPU', icon: Cpu },
  { label: 'Evaluation', icon: FlaskConical },
  { label: 'Benchmark', icon: BarChart3 },
  { label: 'Registry', icon: Archive },
  { label: 'Deployment', icon: Rocket },
]

export function TrainingCenter() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [selectedDataset, setSelectedDataset] = useState('')
  const [splitTrain, setSplitTrain] = useState(70)
  const [splitVal, setSplitVal] = useState(20)
  const [splitTest, setSplitTest] = useState(10)
  const [selectedTemplate, setSelectedTemplate] = useState<TrainingTemplate | null>(null)
  const [selectedGPU, setSelectedGPU] = useState<GPUNode | null>(null)
  const [jobName, setJobName] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const [hyperparams, setHyperparams] = useState<HyperparamConfig>({
    epochs: 100, batchSize: 16, imageSize: 640, learningRate: 0.01,
    optimizer: 'AdamW', scheduler: 'cosine', earlyStoppingPatience: 10,
    workers: 8, randomSeed: 42, mixedPrecision: true, resumeTraining: false, autoSave: true,
  })

  const handleTemplateSelect = (tpl: TrainingTemplate) => {
    setSelectedTemplate(tpl)
    setHyperparams(tpl.defaultHyperparams)
  }

  const hp = (field: keyof HyperparamConfig, val: string | number | boolean) =>
    setHyperparams(prev => ({ ...prev, [field]: val }))

  const canProceed = [
    selectedDataset !== '',
    selectedTemplate !== null,
    jobName.trim() !== '',
    selectedGPU !== null,
  ]

  const estimatedTime = selectedGPU && selectedTemplate
    ? `~${Math.round(hyperparams.epochs * (selectedGPU.name.includes('A100') ? 0.8 : selectedGPU.name.includes('4090') ? 1.2 : 2.1))} min`
    : '—'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f0f5] flex items-center gap-3">
            <Brain className="w-7 h-7 text-[#a89bff]" />
            AI Training Center
          </h1>
          <p className="text-[#8888a8] mt-1">Configure and launch model training jobs on GPU infrastructure</p>
        </div>
        <button
          onClick={() => navigate('/training-jobs')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Training Job
        </button>
      </div>

      {/* Workflow visualization */}
      <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-4">
        <p className="text-xs text-[#55556a] uppercase tracking-widest mb-4">Training Workflow</p>
        <div className="flex items-center gap-1 overflow-x-auto">
          {WORKFLOW.map((w, i) => (
            <div key={w.label} className="flex items-center gap-1 flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center',
                  i <= step ? 'bg-[#7c6af720] text-[#a89bff]' : 'bg-[#1e1e2a] text-[#44445a]'
                )}>
                  <w.icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-[#55556a] whitespace-nowrap">{w.label}</span>
              </div>
              {i < WORKFLOW.length - 1 && (
                <ChevronRight className="w-3 h-3 text-[#2a2a3a] mb-3 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setStep(i)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              step === i
                ? 'bg-[#7c6af720] text-[#a89bff] border border-[#7c6af740]'
                : canProceed[i]
                ? 'bg-[#1e1e2a] text-[#c8c8e8] hover:bg-[#2a2a3a]'
                : 'bg-[#13131f] text-[#44445a]'
            )}
          >
            {canProceed[i] && i !== step ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <s.icon className="w-4 h-4" />}
            Step {i + 1}: {s.label}
          </button>
        ))}
      </div>

      {/* Step 1: Dataset */}
      {step === 0 && (
        <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-[#f0f0f5]">Step 1 — Dataset Selection</h2>
          <div>
            <label className="block text-sm text-[#8888a8] mb-2">Dataset Version</label>
            <select
              value={selectedDataset}
              onChange={e => setSelectedDataset(e.target.value)}
              className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
            >
              <option value="">Select dataset version...</option>
              {mockDatasetRecords.map(d => (
                <option key={d.id} value={d.id}>{d.name} — {d.version}</option>
              ))}
            </select>
          </div>
          {selectedDataset && (() => {
            const ds = mockDatasetRecords.find(d => d.id === selectedDataset)!
            return (
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Images', value: ds.totalImages.toLocaleString() },
                  { label: 'Training', value: ds.trainingImages.toLocaleString() },
                  { label: 'Validation', value: ds.validationImages.toLocaleString() },
                  { label: 'Version', value: ds.version },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#1e1e2a] rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-[#a89bff]">{stat.value}</div>
                    <div className="text-xs text-[#55556a] mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            )
          })()}
          <div>
            <label className="block text-sm text-[#8888a8] mb-3">Split Ratio</label>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Train %', val: splitTrain, set: setSplitTrain },
                { label: 'Val %', val: splitVal, set: setSplitVal },
                { label: 'Test %', val: splitTest, set: setSplitTest },
              ].map(s => (
                <div key={s.label}>
                  <label className="text-xs text-[#55556a]">{s.label}</label>
                  <input
                    type="number" min={0} max={100}
                    value={s.val}
                    onChange={e => s.set(Number(e.target.value))}
                    className="w-full mt-1 bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 h-2 rounded-full overflow-hidden flex">
              <div className="bg-[#7c6af7]" style={{ width: `${splitTrain}%` }} />
              <div className="bg-[#4ade80]" style={{ width: `${splitVal}%` }} />
              <div className="bg-[#fb923c]" style={{ width: `${splitTest}%` }} />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-[#55556a]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#7c6af7] inline-block" />Train</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4ade80] inline-block" />Val</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#fb923c] inline-block" />Test</span>
            </div>
          </div>
          <button
            onClick={() => setStep(1)}
            disabled={!selectedDataset}
            className="px-6 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium disabled:opacity-40 transition-colors"
          >
            Next: Select Model
          </button>
        </div>
      )}

      {/* Step 2: Model */}
      {step === 1 && (
        <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-[#f0f0f5]">Step 2 — Model Selection</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockTrainingTemplates.map(tpl => (
              <div
                key={tpl.id}
                onClick={() => handleTemplateSelect(tpl)}
                className={cn(
                  'bg-[#1e1e2a] border rounded-xl p-4 cursor-pointer transition-all hover:border-[#7c6af760]',
                  selectedTemplate?.id === tpl.id
                    ? 'border-[#7c6af7] bg-[#7c6af710]'
                    : 'border-[#2a2a3a]'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-semibold text-[#f0f0f5]">{tpl.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#7c6af720] text-[#a89bff]">{tpl.framework}</span>
                </div>
                <p className="text-xs text-[#55556a] mb-3">{tpl.description}</p>
                <div className="flex flex-wrap gap-1">
                  {tpl.supportedTasks.map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a3a] text-[#8888a8]">{t}</span>
                  ))}
                </div>
                {selectedTemplate?.id === tpl.id && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-[#4ade80]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="px-4 py-2 rounded-lg border border-[#2a2a3a] text-[#8888a8] text-sm hover:text-white transition-colors">Back</button>
            <button
              onClick={() => setStep(2)}
              disabled={!selectedTemplate}
              className="px-6 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium disabled:opacity-40 transition-colors"
            >
              Next: Hyperparameters
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Hyperparams */}
      {step === 2 && (
        <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-[#f0f0f5]">Step 3 — Hyperparameter Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#8888a8] mb-1">Training Name *</label>
              <input
                value={jobName} onChange={e => setJobName(e.target.value)}
                placeholder="e.g. YOLOv11 Warehouse v3"
                className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
              />
            </div>
            <div>
              <label className="block text-sm text-[#8888a8] mb-1">Description</label>
              <input
                value={jobDesc} onChange={e => setJobDesc(e.target.value)}
                placeholder="Optional description..."
                className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Epochs', field: 'epochs', type: 'number' },
              { label: 'Batch Size', field: 'batchSize', type: 'number' },
              { label: 'Image Size', field: 'imageSize', type: 'number' },
              { label: 'Learning Rate', field: 'learningRate', type: 'number' },
              { label: 'Early Stop Patience', field: 'earlyStoppingPatience', type: 'number' },
              { label: 'Workers', field: 'workers', type: 'number' },
              { label: 'Random Seed', field: 'randomSeed', type: 'number' },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="block text-xs text-[#55556a] mb-1">{label}</label>
                <input
                  type={type}
                  value={String(hyperparams[field as keyof HyperparamConfig])}
                  onChange={e => hp(field as keyof HyperparamConfig, type === 'number' ? Number(e.target.value) : e.target.value)}
                  className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-[#55556a] mb-1">Optimizer</label>
              <select
                value={hyperparams.optimizer}
                onChange={e => hp('optimizer', e.target.value)}
                className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
              >
                {['Adam', 'SGD', 'AdamW'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#55556a] mb-1">Scheduler</label>
              <select
                value={hyperparams.scheduler}
                onChange={e => hp('scheduler', e.target.value)}
                className="w-full bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
              >
                {['cosine', 'linear', 'step'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            {[
              { label: 'Mixed Precision', field: 'mixedPrecision' },
              { label: 'Resume Training', field: 'resumeTraining' },
              { label: 'Auto Save', field: 'autoSave' },
            ].map(({ label, field }) => (
              <label key={field} className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => hp(field as keyof HyperparamConfig, !hyperparams[field as keyof HyperparamConfig])}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    hyperparams[field as keyof HyperparamConfig] ? 'bg-[#7c6af7]' : 'bg-[#2a2a3a]'
                  )}
                >
                  <div className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    hyperparams[field as keyof HyperparamConfig] ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </div>
                <span className="text-sm text-[#8888a8]">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg border border-[#2a2a3a] text-[#8888a8] text-sm hover:text-white transition-colors">Back</button>
            <button
              onClick={() => setStep(3)}
              disabled={!jobName.trim()}
              className="px-6 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium disabled:opacity-40 transition-colors"
            >
              Next: GPU Selection
            </button>
          </div>
        </div>
      )}

      {/* Step 4: GPU */}
      {step === 3 && (
        <div className="bg-[#13131f] border border-[#1e1e2a] rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-[#f0f0f5]">Step 4 — GPU Selection</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockGPUNodes.map(gpu => (
              <div
                key={gpu.id}
                onClick={() => gpu.status !== 'offline' && setSelectedGPU(gpu)}
                className={cn(
                  'border rounded-xl p-4 transition-all',
                  gpu.status === 'offline'
                    ? 'border-[#2a2a3a] opacity-50 cursor-not-allowed bg-[#13131f]'
                    : selectedGPU?.id === gpu.id
                    ? 'border-[#7c6af7] bg-[#7c6af710] cursor-pointer'
                    : 'border-[#2a2a3a] bg-[#1e1e2a] cursor-pointer hover:border-[#7c6af760]'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-[#f0f0f5]">{gpu.name}</span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    gpu.status === 'available' ? 'bg-green-900/40 text-green-400' :
                    gpu.status === 'busy' ? 'bg-yellow-900/40 text-yellow-400' :
                    'bg-red-900/40 text-red-400'
                  )}>{gpu.status}</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[#55556a] mb-1">
                      <span>VRAM</span><span>{gpu.memoryUsed}/{gpu.memoryTotal} GB</span>
                    </div>
                    <div className="h-1.5 bg-[#2a2a3a] rounded-full overflow-hidden">
                      <div className="h-full bg-[#7c6af7]" style={{ width: `${(gpu.memoryUsed / gpu.memoryTotal) * 100}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mt-2">
                    <div>
                      <div className={cn('font-medium', gpu.temperature > 85 ? 'text-red-400' : gpu.temperature > 70 ? 'text-yellow-400' : 'text-green-400')}>{gpu.temperature}°C</div>
                      <div className="text-[#44445a]">Temp</div>
                    </div>
                    <div>
                      <div className="text-[#f0f0f5] font-medium">{gpu.power}W</div>
                      <div className="text-[#44445a]">Power</div>
                    </div>
                    <div>
                      <div className="text-[#f0f0f5] font-medium">{gpu.utilization}%</div>
                      <div className="text-[#44445a]">Util</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {selectedGPU && selectedTemplate && (
            <div className="bg-[#1e1e2a] rounded-lg p-3 text-sm flex items-center gap-3">
              <Cpu className="w-4 h-4 text-[#a89bff]" />
              <span className="text-[#8888a8]">Estimated Training Time:</span>
              <span className="text-[#f0f0f5] font-medium">{estimatedTime}</span>
              <span className="text-[#55556a]">on {selectedGPU.name}</span>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg border border-[#2a2a3a] text-[#8888a8] text-sm hover:text-white transition-colors">Back</button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!selectedGPU}
              className="px-6 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              <Brain className="w-4 h-4" /> Start Training
            </button>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#13131f] border border-[#2a2a3a] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#f0f0f5] mb-4">Confirm Training Job</h3>
            <div className="space-y-2 text-sm mb-6">
              {[
                { l: 'Job Name', v: jobName },
                { l: 'Model', v: selectedTemplate?.name },
                { l: 'GPU', v: selectedGPU?.name },
                { l: 'Epochs', v: hyperparams.epochs },
                { l: 'Batch Size', v: hyperparams.batchSize },
                { l: 'Learning Rate', v: hyperparams.learningRate },
                { l: 'Estimated Time', v: estimatedTime },
              ].map(row => (
                <div key={row.l} className="flex justify-between">
                  <span className="text-[#55556a]">{row.l}</span>
                  <span className="text-[#f0f0f5]">{String(row.v)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a3a] text-[#8888a8] text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); navigate('/training-jobs') }}
                className="flex-1 px-4 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium transition-colors"
              >
                Launch Training
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
