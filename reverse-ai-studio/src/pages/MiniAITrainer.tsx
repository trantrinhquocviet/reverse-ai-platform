import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Brain, Database, Play, Download, CheckCircle, Loader2, AlertCircle, BarChart3, Layers, HardDrive, Trash2, RefreshCw, Star, History, X, ZoomIn, Zap } from 'lucide-react'
import { supabase } from '@/services/api'
import { cn } from '@/utils/cn'
import { useAutoTrain } from '@/hooks/useAutoTrain'

async function loadTF() {
  const tf = await import('@tensorflow/tfjs')
  await import('@tensorflow/tfjs-backend-webgl')
  await tf.ready()
  return tf
}

// ── Task definitions ──────────────────────────────────────────────────────────
const PACKAGING_LABELS = ['ok', 'damaged', 'unknown'] as const
const BOOL_LABELS      = ['no', 'yes'] as const
const OBJECT_LABELS    = ['cardboard_box', 'shipping_label', 'barcode_1d', 'qr_code', 'hand', 'barcode_scanner', 'other'] as const

type PackagingLabel = typeof PACKAGING_LABELS[number]
type ObjectLabel    = typeof OBJECT_LABELS[number]

interface MultiTaskSample {
  imageUrl: string
  packaging: PackagingLabel
  hasLabel:  boolean
  hasHand:   boolean
  dominantObject: ObjectLabel
}

interface DetectedObject { label: string; confidence: number }

interface ModelVersion {
  id: string           // e.g. "warehouse-multitask-v3"
  versionNum: number
  savedAt: string
  samples: number
  finalAccs: number[]  // [packaging, hasLabel, hasHand, object]
}

const VERSIONS_KEY = 'mini_ai_trainer_versions'
const ACTIVE_KEY   = 'mini_ai_trainer_active'
const HISTORY_KEY  = 'mini_ai_trainer_history'
const MAX_HISTORY  = 50

interface TestRecord {
  id: string
  versionId: string
  versionNum: number
  testedAt: string
  filename: string
  thumbnail: string  // small base64 ~10KB
  results: {
    packaging: { label: string; conf: number }
    hasLabel:  { label: string; conf: number }
    hasHand:   { label: string; conf: number }
    object:    { label: string; conf: number }
  }
}

function loadHistory(): TestRecord[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}
function saveHistory(h: TestRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-MAX_HISTORY)))
}

function idbKey(id: string) { return `indexeddb://${id}` }

function loadVersions(): ModelVersion[] {
  try { return JSON.parse(localStorage.getItem(VERSIONS_KEY) ?? '[]') } catch { return [] }
}
function saveVersions(vs: ModelVersion[]) {
  localStorage.setItem(VERSIONS_KEY, JSON.stringify(vs))
}

function dominantObj(objects: DetectedObject[]): ObjectLabel {
  if (!objects.length) return 'other'
  const sorted = [...objects].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
  const top = sorted[0].label as ObjectLabel
  return OBJECT_LABELS.includes(top) ? top : 'other'
}

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchSamples(): Promise<MultiTaskSample[]> {
  const { data, error } = await supabase
    .from('dataset_images')
    .select('file_path, ai_result, annotations(status)')
    .not('ai_result', 'is', null)
  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter((row: any) => (row.annotations as any[])?.[0]?.status === 'approved')
    .map((row: any) => {
      const ai = row.ai_result as {
        packaging_status?: string
        objects?: DetectedObject[]
      }
      const objects = ai?.objects ?? []
      const packaging = (PACKAGING_LABELS.includes(ai?.packaging_status as PackagingLabel)
        ? ai.packaging_status : 'unknown') as PackagingLabel
      return {
        imageUrl: row.file_path,
        packaging,
        hasLabel:  objects.some(o => o.label === 'shipping_label'),
        hasHand:   objects.some(o => o.label === 'hand'),
        dominantObject: dominantObj(objects),
      }
    })
}

// ── Component ─────────────────────────────────────────────────────────────────
const TASK_INFO = [
  { key: 'packaging', label: 'Packaging Status', labels: PACKAGING_LABELS, icon: '📦' },
  { key: 'hasLabel',  label: 'Shipping Label',   labels: BOOL_LABELS,      icon: '🏷️' },
  { key: 'hasHand',   label: 'Hand Present',     labels: BOOL_LABELS,      icon: '✋' },
  { key: 'object',    label: 'Dominant Object',  labels: OBJECT_LABELS,    icon: '🔍' },
]

// ── Zoom Modal ────────────────────────────────────────────────────────────────
function ZoomModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt="zoom"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-[10px] shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// ── Badge color helpers ───────────────────────────────────────────────────────
function packagingBadgeColor(label: string) {
  if (label === 'ok') return 'bg-green-500/80 text-white'
  if (label === 'damaged') return 'bg-red-500/80 text-white'
  return 'bg-yellow-500/80 text-black'
}

export function MiniAITrainer() {
  const [phase, setPhase] = useState<'idle' | 'extracting' | 'training' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ step: '', percent: 0, epoch: 0, losses: [0, 0, 0, 0], accs: [0, 0, 0, 0] })
  const [modelReady, setModelReady] = useState(false)
  const [versions, setVersions] = useState<ModelVersion[]>(loadVersions)
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY))
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [history, setHistory] = useState<TestRecord[]>(loadHistory)
  const [testResult, setTestResult] = useState<{
    packaging: { label: string; conf: number }
    hasLabel:  { label: string; conf: number }
    hasHand:   { label: string; conf: number }
    object:    { label: string; conf: number }
  } | null>(null)
  const [testImage, setTestImage] = useState<string | null>(null)

  // Right panel tab: 'training' | 'history'
  const [rightTab, setRightTab] = useState<'training' | 'history'>('training')

  // History filters
  const [filterVersion, setFilterVersion] = useState<string>('all')
  const [filterSort, setFilterSort] = useState<'newest' | 'oldest'>('newest')
  const [filterMinConf, setFilterMinConf] = useState<number>(0)  // 0 = any, 50, 70, 90

  // Zoom modal
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)

  const modelRef = useRef<any>(null)
  const fileRef  = useRef<HTMLInputElement>(null)

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['training-samples-mt'],
    queryFn: fetchSamples,
  })

  const packagingCounts = PACKAGING_LABELS.reduce((a, l) => {
    a[l] = samples.filter(s => s.packaging === l).length; return a
  }, {} as Record<PackagingLabel, number>)

  const canTrain = samples.length >= 6

  const { enabled: atEnabled, setEnabled: atSetEnabled, threshold: atThreshold, setThreshold: atSetThreshold,
          count: atCount, isReady: atIsReady, resetCount: atResetCount } = useAutoTrain()

  // Full-auto: trigger training when event fired (user is on this page)
  useEffect(() => {
    const handler = () => {
      if (phase === 'idle' || phase === 'done') {
        startTraining()
        atResetCount()
      }
    }
    window.addEventListener('auto-train-trigger', handler)
    return () => window.removeEventListener('auto-train-trigger', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Auto-load active version on mount
  useEffect(() => {
    if (!activeId) return
    const ver = loadVersions().find(v => v.id === activeId)
    if (!ver) return
    setLoadingId(activeId)
    ;(async () => {
      try {
        const tf = await loadTF()
        const mobilenet = await import('@tensorflow-models/mobilenet')
        const [model, mobileNet] = await Promise.all([
          tf.loadLayersModel(idbKey(activeId)),
          mobilenet.load({ version: 2, alpha: 0.5 }),
        ])
        modelRef.current = { model, mobileNet }
        setModelReady(true)
        setPhase('done')
      } catch {
        setVersions(vs => { const next = vs.filter(v => v.id !== activeId); saveVersions(next); return next })
        localStorage.removeItem(ACTIVE_KEY)
        setActiveId(null)
      } finally {
        setLoadingId(null)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch to a stored version ────────────────────────────────────────────
  const switchVersion = async (ver: ModelVersion) => {
    if (loadingId) return
    setLoadingId(ver.id)
    setTestResult(null); setTestImage(null)
    try {
      const tf = await loadTF()
      const mobilenet = await import('@tensorflow-models/mobilenet')
      const [model, mobileNet] = await Promise.all([
        tf.loadLayersModel(idbKey(ver.id)),
        mobilenet.load({ version: 2, alpha: 0.5 }),
      ])
      modelRef.current = { model, mobileNet }
      setActiveId(ver.id)
      localStorage.setItem(ACTIVE_KEY, ver.id)
      setModelReady(true)
      setPhase('done')
    } catch {
      alert('Không load được version này. Có thể đã bị xóa khỏi browser.')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Delete a stored version ───────────────────────────────────────────────
  const deleteVersion = async (ver: ModelVersion) => {
    try {
      const tf = await loadTF()
      await tf.io.removeModel(idbKey(ver.id))
    } catch { /* already gone */ }
    const next = versions.filter(v => v.id !== ver.id)
    setVersions(next); saveVersions(next)
    if (activeId === ver.id) {
      modelRef.current = null
      setModelReady(false); setPhase('idle')
      setTestResult(null); setTestImage(null)
      setActiveId(null); localStorage.removeItem(ACTIVE_KEY)
    }
  }

  // ── Training ─────────────────────────────────────────────────────────────
  const startTraining = async () => {
    setPhase('extracting')
    setProgress(p => ({ ...p, step: 'Loading TensorFlow.js...', percent: 5 }))

    try {
      const tf = await loadTF()
      const mobilenet = await import('@tensorflow-models/mobilenet')

      setProgress(p => ({ ...p, step: 'Loading MobileNetV2...', percent: 10 }))
      const mobileNet = await mobilenet.load({ version: 2, alpha: 0.5 })

      const features: number[][] = []
      const labels = { packaging: [] as number[], hasLabel: [] as number[], hasHand: [] as number[], object: [] as number[] }

      for (let i = 0; i < samples.length; i++) {
        const s = samples[i]
        try {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = s.imageUrl })
          const emb = mobileNet.infer(img, true) as any
          features.push(Array.from(await emb.data()))
          emb.dispose()
          labels.packaging.push(PACKAGING_LABELS.indexOf(s.packaging))
          labels.hasLabel.push(s.hasLabel ? 1 : 0)
          labels.hasHand.push(s.hasHand ? 1 : 0)
          labels.object.push(OBJECT_LABELS.indexOf(s.dominantObject) >= 0
            ? OBJECT_LABELS.indexOf(s.dominantObject) : OBJECT_LABELS.length - 1)
        } catch { /* skip */ }
        setProgress(p => ({ ...p, step: `Extracting features ${i + 1}/${samples.length}`, percent: 10 + Math.round((i / samples.length) * 45) }))
      }

      if (features.length < 4) throw new Error('Không đủ ảnh để train (cần ≥4)')

      setPhase('training')
      setProgress(p => ({ ...p, step: 'Building multi-task model...', percent: 55 }))

      const featSize = features[0].length
      const inputLayer = tf.input({ shape: [featSize] })
      const shared1 = tf.layers.dense({ units: 256, activation: 'relu' }).apply(inputLayer) as any
      const dropped = tf.layers.dropout({ rate: 0.3 }).apply(shared1) as any

      const packagingOut = tf.layers.dense({ units: PACKAGING_LABELS.length, activation: 'softmax', name: 'packaging' }).apply(dropped) as any
      const hasLabelOut  = tf.layers.dense({ units: 2, activation: 'softmax', name: 'has_label' }).apply(dropped) as any
      const hasHandOut   = tf.layers.dense({ units: 2, activation: 'softmax', name: 'has_hand' }).apply(dropped) as any
      const objectOut    = tf.layers.dense({ units: OBJECT_LABELS.length, activation: 'softmax', name: 'object_type' }).apply(dropped) as any

      const model = tf.model({ inputs: inputLayer, outputs: [packagingOut, hasLabelOut, hasHandOut, objectOut] })
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: ['categoricalCrossentropy', 'categoricalCrossentropy', 'categoricalCrossentropy', 'categoricalCrossentropy'],
        metrics: ['accuracy'],
      })

      const xs          = tf.tensor2d(features)
      const ysPackaging = tf.oneHot(tf.tensor1d(labels.packaging, 'int32'), PACKAGING_LABELS.length)
      const ysLabel     = tf.oneHot(tf.tensor1d(labels.hasLabel, 'int32'), 2)
      const ysHand      = tf.oneHot(tf.tensor1d(labels.hasHand, 'int32'), 2)
      const ysObject    = tf.oneHot(tf.tensor1d(labels.object, 'int32'), OBJECT_LABELS.length)

      let finalAccs = [0, 0, 0, 0]
      const EPOCHS = 40
      await model.fit(xs, [ysPackaging, ysLabel, ysHand, ysObject], {
        epochs: EPOCHS,
        batchSize: Math.min(8, features.length),
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            const get = (key: string) => parseFloat(((logs?.[key] ?? 0) as number).toFixed(4))
            const accs = [
              parseFloat(((logs?.['packaging_acc'] ?? 0) as number * 100).toFixed(1)),
              parseFloat(((logs?.['has_label_acc'] ?? 0) as number * 100).toFixed(1)),
              parseFloat(((logs?.['has_hand_acc'] ?? 0) as number * 100).toFixed(1)),
              parseFloat(((logs?.['object_type_acc'] ?? 0) as number * 100).toFixed(1)),
            ]
            finalAccs = accs
            setProgress({
              step: `Training epoch ${epoch + 1}/${EPOCHS}`,
              percent: 55 + Math.round(((epoch + 1) / EPOCHS) * 42),
              epoch: epoch + 1,
              losses: [get('packaging_loss'), get('has_label_loss'), get('has_hand_loss'), get('object_type_loss')],
              accs,
            })
          },
        },
      })

      xs.dispose(); ysPackaging.dispose(); ysLabel.dispose(); ysHand.dispose(); ysObject.dispose()

      setProgress(p => ({ ...p, step: 'Saving to IndexedDB...', percent: 98 }))
      const existingVersions = loadVersions()
      const versionNum = existingVersions.length + 1
      const newId = `warehouse-multitask-v${versionNum}`
      await model.save(idbKey(newId))

      const newVer: ModelVersion = {
        id: newId,
        versionNum,
        savedAt: new Date().toISOString(),
        samples: features.length,
        finalAccs,
      }
      const next = [...existingVersions, newVer]
      saveVersions(next)
      setVersions(next)
      setActiveId(newId)
      localStorage.setItem(ACTIVE_KEY, newId)

      modelRef.current = { model, mobileNet }
      setPhase('done')
      setModelReady(true)
      setProgress(p => ({ ...p, step: `v${versionNum} saved! 4 tasks learned.`, percent: 100 }))
    } catch (e) {
      setPhase('error')
      setProgress(p => ({ ...p, step: e instanceof Error ? e.message : 'Lỗi không xác định' }))
    }
  }

  // ── Inference ─────────────────────────────────────────────────────────────
  const testFrame = async (file: File) => {
    if (!modelRef.current) return
    const { model, mobileNet } = modelRef.current
    const url = URL.createObjectURL(file)
    setTestImage(url); setTestResult(null)

    const img = new Image()
    img.onload = async () => {
      const tf = await loadTF()
      const emb = mobileNet.infer(img, true) as any
      const embData = Array.from(await emb.data() as Float32Array)
      emb.dispose()
      const input = tf.tensor2d([embData])
      const preds = model.predict(input) as any[]
      const toResult = async (t: any, labels: readonly string[]) => {
        const probs = Array.from(await t.data() as Float32Array) as number[]
        const idx = probs.indexOf(Math.max(...probs))
        return { label: labels[idx], conf: Math.round(probs[idx] * 100) }
      }
      const [packaging, hasLabel, hasHand, object] = await Promise.all([
        toResult(preds[0], PACKAGING_LABELS),
        toResult(preds[1], BOOL_LABELS),
        toResult(preds[2], BOOL_LABELS),
        toResult(preds[3], OBJECT_LABELS),
      ])
      input.dispose(); preds.forEach((t: any) => t.dispose())
      const results = { packaging, hasLabel, hasHand, object }
      setTestResult(results)

      const thumb = (() => {
        try {
          const c = document.createElement('canvas')
          const scale = 320 / img.naturalWidth
          c.width = 320; c.height = Math.round(img.naturalHeight * scale)
          c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
          return c.toDataURL('image/jpeg', 0.5)
        } catch { return '' }
      })()

      const activeVer = loadVersions().find(v => v.id === activeId)
      if (activeId && activeVer) {
        const record: TestRecord = {
          id: crypto.randomUUID(),
          versionId: activeId,
          versionNum: activeVer.versionNum,
          testedAt: new Date().toISOString(),
          filename: file.name,
          thumbnail: thumb,
          results,
        }
        const next = [...loadHistory(), record]
        saveHistory(next)
        setHistory(next.slice(-MAX_HISTORY))
      }
    }
    img.src = url
  }

  const downloadModel = async () => {
    if (!modelRef.current) return
    const activeVer = versions.find(v => v.id === activeId)
    await modelRef.current.model.save(`downloads://warehouse-multitask-${activeVer?.id ?? 'model'}`)
  }

  const avgAcc = (accs: number[]) => Math.round(accs.reduce((a, b) => a + b, 0) / accs.length)

  // ── History filtering ─────────────────────────────────────────────────────
  const avgConfOfRecord = (rec: TestRecord) =>
    Math.round((rec.results.packaging.conf + rec.results.hasLabel.conf + rec.results.hasHand.conf + rec.results.object.conf) / 4)

  const filteredHistory = (() => {
    let h = [...history]
    if (filterVersion !== 'all') h = h.filter(r => r.versionId === filterVersion)
    if (filterMinConf > 0) h = h.filter(r => avgConfOfRecord(r) >= filterMinConf)
    if (filterSort === 'newest') h = h.reverse()
    return h
  })()

  const showVersionComparison = filterVersion === 'all' && versions.length >= 2

  const handleCloseZoom = useCallback(() => setZoomSrc(null), [])

  const taskKeys = ['packaging', 'hasLabel', 'hasHand', 'object'] as const

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Zoom Modal */}
      {zoomSrc && <ZoomModal src={zoomSrc} onClose={handleCloseZoom} />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[#7c6af720] flex items-center justify-center">
          <Brain className="w-5 h-5 text-[#a89bff]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#f0f0f5]">Mini AI Trainer</h1>
          <p className="text-xs text-[#8888a8]">Multi-task learning — 4 tasks, 1 shared model</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Semi-auto banner — appears when threshold reached */}
          {atIsReady && phase !== 'extracting' && phase !== 'training' && (
            <div className="rounded-[14px] bg-[#7c6af715] border border-[#7c6af740] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#a89bff]" />
                <p className="text-sm font-semibold text-[#a89bff]">{atCount} frames approved</p>
              </div>
              <p className="text-[11px] text-[#8888a8]">Đủ data để train version mới. Retrain ngay?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { startTraining(); atResetCount() }}
                  disabled={!canTrain}
                  className="flex-1 py-1.5 bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-xs rounded-[8px] font-medium transition-colors"
                >
                  Train v{versions.length + 1}
                </button>
                <button
                  onClick={atResetCount}
                  className="px-3 py-1.5 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#55556a] text-xs rounded-[8px] transition-colors"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          )}

          {/* Dataset */}
          <div className="rounded-[14px] bg-[#111118] border border-[#1e1e2a] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#55556a]" />
              <h3 className="text-sm font-semibold text-[#f0f0f5]">Dataset</h3>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 text-[#55556a] text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {PACKAGING_LABELS.map(l => (
                    <div key={l} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', l === 'ok' ? 'bg-green-400' : l === 'damaged' ? 'bg-red-400' : 'bg-[#55556a]')} />
                        <span className="text-[#8888a8] capitalize">{l}</span>
                      </div>
                      <span className={cn('font-medium', l === 'ok' ? 'text-green-400' : l === 'damaged' ? 'text-red-400' : 'text-[#55556a]')}>
                        {packagingCounts[l]}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1e1e2a]">
                    <span className="text-[#55556a]">Has label</span>
                    <span className="text-[#f0f0f5]">{samples.filter(s => s.hasLabel).length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#55556a]">Has hand</span>
                    <span className="text-[#f0f0f5]">{samples.filter(s => s.hasHand).length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium border-t border-[#1e1e2a] pt-1">
                    <span className="text-[#55556a]">Total approved</span>
                    <span className="text-[#a89bff]">{samples.length}</span>
                  </div>
                </div>
                {!canTrain && (
                  <div className="flex items-start gap-2 bg-[#f59e0b10] rounded-[8px] p-2.5">
                    <AlertCircle className="w-3.5 h-3.5 text-[#fbbf24] flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-[#fbbf24]">Cần ≥6 approved frames. Approve thêm trong Annotation Queue.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Saved versions */}
          {versions.length > 0 && (
            <div className="rounded-[14px] bg-[#111118] border border-[#1e1e2a] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#55556a]" />
                <h3 className="text-sm font-semibold text-[#f0f0f5]">Saved Versions</h3>
                <span className="ml-auto text-[10px] text-[#55556a]">{versions.length} version{versions.length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {[...versions].reverse().map(ver => {
                  const isActive = ver.id === activeId
                  const isLoading_ = loadingId === ver.id
                  return (
                    <div key={ver.id}
                      className={cn(
                        'rounded-[8px] p-2.5 border transition-colors',
                        isActive
                          ? 'bg-[#7c6af715] border-[#7c6af740]'
                          : 'bg-[#1a1a24] border-[#1e1e2a] hover:border-[#2a2a3a]'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {isActive && <Star className="w-3 h-3 text-[#a89bff]" fill="currentColor" />}
                          <span className={cn('text-xs font-semibold', isActive ? 'text-[#a89bff]' : 'text-[#f0f0f5]')}>
                            v{ver.versionNum}
                          </span>
                          <span className="text-[10px] text-[#44445a]">· {ver.samples} samples</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {!isActive && (
                            <button
                              onClick={() => switchVersion(ver)}
                              disabled={!!loadingId}
                              className="text-[#55556a] hover:text-[#a89bff] transition-colors disabled:opacity-40"
                              title="Switch to this version"
                            >
                              {isLoading_ ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => deleteVersion(ver)}
                            disabled={!!loadingId}
                            className="text-[#55556a] hover:text-red-400 transition-colors disabled:opacity-40"
                            title="Delete this version"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#44445a]">
                          {new Date(ver.savedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        {ver.finalAccs.length > 0 && (
                          <span className={cn('text-[10px] font-medium', avgAcc(ver.finalAccs) >= 80 ? 'text-green-400' : 'text-yellow-400')}>
                            avg {avgAcc(ver.finalAccs)}%
                          </span>
                        )}
                      </div>
                      {ver.finalAccs.length > 0 && (
                        <div className="mt-1.5 flex gap-1">
                          {ver.finalAccs.map((acc, i) => (
                            <div key={i} className="flex-1">
                              <div className="h-1 rounded-full bg-[#1e1e2a] overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full', acc >= 80 ? 'bg-green-500' : acc >= 60 ? 'bg-yellow-500' : 'bg-red-500')}
                                  style={{ width: `${acc}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Test model */}
          {modelReady && (
            <div className="rounded-[14px] bg-[#111118] border border-[#1e1e2a] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#f0f0f5]">Test Model</h3>
                {activeId && <span className="text-[10px] text-[#a89bff]">v{versions.find(v => v.id === activeId)?.versionNum}</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && testFrame(e.target.files[0])} />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full py-2 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#8888a8] text-xs rounded-[8px] transition-colors"
              >
                Upload ảnh để test
              </button>

              {/* Test image with result badge overlay */}
              {testImage && (
                <div className="relative group">
                  <img
                    src={testImage}
                    alt="test"
                    className="w-full aspect-video object-cover rounded-[8px] cursor-zoom-in"
                    onClick={() => setZoomSrc(testImage)}
                  />
                  {/* Zoom hint */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-black/60 rounded-[6px] p-1">
                      <ZoomIn className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  {/* Badge overlay when result is available */}
                  {testResult && (
                    <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 pointer-events-none">
                      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-[4px] backdrop-blur-sm', packagingBadgeColor(testResult.packaging.label))}>
                        📦 {testResult.packaging.label} {testResult.packaging.conf}%
                      </span>
                      {testResult.hasHand.label === 'yes' && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-[#a89bff]/80 text-white backdrop-blur-sm">
                          ✋ hand {testResult.hasHand.conf}%
                        </span>
                      )}
                      {testResult.hasLabel.label === 'yes' && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-blue-500/80 text-white backdrop-blur-sm">
                          🏷️ label {testResult.hasLabel.conf}%
                        </span>
                      )}
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-[#1e1e2a]/90 text-[#8888a8] backdrop-blur-sm">
                        🔍 {testResult.object.label.replace(/_/g, ' ')} {testResult.object.conf}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {testResult && (
                <div className="space-y-2">
                  {[
                    { icon: '📦', label: 'Packaging', result: testResult.packaging,
                      color: testResult.packaging.label === 'ok' ? 'text-green-400' : testResult.packaging.label === 'damaged' ? 'text-red-400' : 'text-yellow-400' },
                    { icon: '🏷️', label: 'Has Label', result: testResult.hasLabel,
                      color: testResult.hasLabel.label === 'yes' ? 'text-[#a89bff]' : 'text-[#55556a]' },
                    { icon: '✋', label: 'Has Hand', result: testResult.hasHand,
                      color: testResult.hasHand.label === 'yes' ? 'text-[#a89bff]' : 'text-[#55556a]' },
                    { icon: '🔍', label: 'Object', result: testResult.object, color: 'text-[#f0f0f5]' },
                  ].map(({ icon, label, result, color }) => (
                    <div key={label} className="bg-[#1a1a24] rounded-[8px] px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{icon}</span>
                        <span className="text-[10px] text-[#55556a]">{label}</span>
                      </div>
                      <div className="text-right">
                        <span className={cn('text-xs font-medium capitalize', color)}>
                          {result.label.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-[#44445a] ml-1.5">{result.conf}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={downloadModel}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#7c6af720] hover:bg-[#7c6af740] text-[#a89bff] text-xs rounded-[8px] transition-colors">
                <Download className="w-3.5 h-3.5" /> Download Model
              </button>
            </div>
          )}

          {/* Auto-train settings */}
          <div className="rounded-[14px] bg-[#111118] border border-[#1e1e2a] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#55556a]" />
              <h3 className="text-sm font-semibold text-[#f0f0f5]">Auto-Train</h3>
              <button
                onClick={() => atSetEnabled(!atEnabled)}
                className={cn(
                  'ml-auto w-9 h-5 rounded-full transition-colors relative',
                  atEnabled ? 'bg-[#7c6af7]' : 'bg-[#2a2a3a]'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                  atEnabled ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </button>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#55556a]">Trigger sau mỗi</span>
              <select
                value={atThreshold}
                onChange={e => atSetThreshold(Number(e.target.value))}
                className="bg-[#1e1e2a] text-[#f0f0f5] text-xs rounded-[6px] px-2 py-1 border border-[#2a2a3a]"
              >
                {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n} approvals</option>)}
              </select>
            </div>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#44445a]">
                <span>{atCount} / {atThreshold} approved</span>
                <span>{Math.min(100, Math.round(atCount / atThreshold * 100))}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1e1e2a] overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', atIsReady ? 'bg-[#7c6af7]' : 'bg-[#44445a]')}
                  style={{ width: `${Math.min(100, atCount / atThreshold * 100)}%` }}
                />
              </div>
            </div>
            <p className="text-[9px] text-[#44445a]">
              {atEnabled ? 'Full-auto: train ngay khi đủ threshold (cần ở trang này)' : 'Semi-auto: hỏi trước khi train'}
            </p>
          </div>
        </div>

        {/* ── Right panel with tabs ──────────────────────────────────────── */}
        <div className="lg:col-span-2 rounded-[14px] bg-[#111118] border border-[#1e1e2a] overflow-hidden flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-[#1e1e2a] px-5 pt-4">
            <button
              onClick={() => setRightTab('training')}
              className={cn(
                'pb-3 mr-6 text-sm font-medium transition-colors border-b-2 -mb-px',
                rightTab === 'training'
                  ? 'border-[#a89bff] text-[#f0f0f5]'
                  : 'border-transparent text-[#55556a] hover:text-[#8888a8]'
              )}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5" />
                Training
              </span>
            </button>
            <button
              onClick={() => setRightTab('history')}
              className={cn(
                'pb-3 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2',
                rightTab === 'history'
                  ? 'border-[#a89bff] text-[#f0f0f5]'
                  : 'border-transparent text-[#55556a] hover:text-[#8888a8]'
              )}
            >
              <History className="w-3.5 h-3.5" />
              History
              {history.length > 0 && (
                <span className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                  rightTab === 'history' ? 'bg-[#a89bff]/20 text-[#a89bff]' : 'bg-[#1e1e2a] text-[#55556a]'
                )}>
                  {history.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Training tab content ───────────────────────────────────── */}
          {rightTab === 'training' && (
            <div className="p-5 space-y-5 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#f0f0f5]">Multi-Task Training</h3>
                {versions.length > 0 && (
                  <span className="ml-auto text-[10px] text-[#55556a]">
                    Next: <span className="text-[#a89bff]">v{versions.length + 1}</span>
                  </span>
                )}
              </div>

              {/* Architecture */}
              <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[10px] p-4 space-y-3">
                <p className="text-[10px] text-[#55556a] uppercase tracking-wider">Model Architecture</p>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <div className="px-3 py-2 bg-[#7c6af720] border border-[#7c6af740] rounded-[8px] text-[10px] text-[#a89bff] text-center">
                      MobileNetV2<br/><span className="text-[#55556a]">feature extractor</span>
                    </div>
                    <div className="w-px h-3 bg-[#2a2a3a]" />
                    <div className="px-3 py-2 bg-[#1e1e2a] rounded-[8px] text-[10px] text-[#8888a8] text-center">
                      Dense 256 + Dropout<br/><span className="text-[#55556a]">shared backbone</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      {['↙', '↓', '↓', '↘'].map((a, i) => <span key={i} className="text-[#44445a] text-xs">{a}</span>)}
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    {TASK_INFO.map((t, i) => (
                      <div key={t.key} className="bg-[#1a1a24] rounded-[8px] p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs">{t.icon}</span>
                          <span className="text-[10px] text-[#a89bff] font-medium">Head {i + 1}</span>
                        </div>
                        <p className="text-[10px] text-[#f0f0f5]">{t.label}</p>
                        <p className="text-[9px] text-[#55556a] mt-0.5">{t.labels.length} classes</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Layers className="w-3 h-3 text-[#55556a]" />
                  <p className="text-[10px] text-[#55556a]">All 4 tasks train simultaneously — shared features, 4 separate output heads</p>
                </div>
              </div>

              {/* Progress */}
              {phase !== 'idle' && (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className={cn('text-[#8888a8]', phase === 'error' && 'text-red-400')}>{progress.step}</span>
                    <span className="text-[#f0f0f5]">{progress.percent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#1e1e2a]">
                    <div
                      className={cn('h-2 rounded-full transition-all duration-500',
                        phase === 'error' ? 'bg-red-500' : phase === 'done' ? 'bg-green-500' : 'bg-[#7c6af7]')}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>

                  {phase === 'training' && progress.epoch > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {TASK_INFO.map((t, i) => (
                        <div key={t.key} className="bg-[#1a1a24] rounded-[8px] p-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[10px]">{t.icon}</span>
                            <span className="text-[9px] text-[#55556a]">{t.label}</span>
                          </div>
                          <div className="flex justify-between">
                            <div>
                              <p className="text-[9px] text-[#44445a]">Loss</p>
                              <p className="text-xs font-bold text-[#f87171]">{progress.losses[i]}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-[#44445a]">Acc</p>
                              <p className="text-xs font-bold text-[#4ade80]">{progress.accs[i]}%</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {phase === 'done' && (
                    <div className="flex items-center gap-2 bg-[#16a34a20] rounded-[8px] p-3">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <p className="text-xs text-green-400">
                        Xong! {versions.find(v => v.id === activeId)?.id} đã lưu vào IndexedDB. Train lại để tạo version mới.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(phase === 'idle' || phase === 'error' || phase === 'done') && (
                <button
                  onClick={startTraining}
                  disabled={!canTrain || isLoading || !!loadingId}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3 rounded-[10px] text-sm font-medium transition-colors',
                    canTrain && !isLoading && !loadingId
                      ? 'bg-[#7c6af7] hover:bg-[#6b5ce7] text-white'
                      : 'bg-[#1e1e2a] text-[#55556a] cursor-not-allowed'
                  )}
                >
                  <Play className="w-4 h-4" />
                  {phase === 'error' ? 'Thử lại' : versions.length > 0 ? `Train v${versions.length + 1}` : 'Train All 4 Tasks'}
                </button>
              )}
              {(phase === 'extracting' || phase === 'training') && (
                <div className="flex items-center justify-center gap-2 py-3 text-[#8888a8] text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-[#7c6af7]" />
                  Đang train trong browser...
                </div>
              )}

              {/* Pipeline notes */}
              <div className="border-t border-[#1e1e2a] pt-4 space-y-1.5">
                <p className="text-[10px] text-[#55556a] font-medium uppercase tracking-wide">Pipeline</p>
                {[
                  '1. MobileNetV2 → extract 1280-dim feature vector từ mỗi frame',
                  '2. Shared Dense(256) layer học chung representation',
                  '3. Head 1 (Packaging): ok / damaged / unknown',
                  '4. Head 2 (Label): shipping label có xuất hiện không?',
                  '5. Head 3 (Hand): bàn tay người có trong frame không?',
                  '6. Head 4 (Object): vật thể chủ đạo trong frame là gì?',
                  '7. 4 loss functions train song song — 1 backward pass duy nhất',
                ].map(s => <p key={s} className="text-[10px] text-[#55556a]">{s}</p>)}
              </div>
            </div>
          )}

          {/* ── History tab content ────────────────────────────────────── */}
          {rightTab === 'history' && (
            <div className="p-5 flex-1 space-y-4">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <History className="w-8 h-8 text-[#2a2a3a]" />
                  <p className="text-sm text-[#55556a]">No test history yet</p>
                  <p className="text-[10px] text-[#44445a]">Test an image in the Test Model panel to see records here.</p>
                </div>
              ) : (
                <>
                  {/* Filter bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Version filter */}
                    <select
                      value={filterVersion}
                      onChange={e => setFilterVersion(e.target.value)}
                      className="text-xs bg-[#1e1e2a] border border-[#2a2a3a] text-[#f0f0f5] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#a89bff] transition-colors"
                    >
                      <option value="all">All versions</option>
                      {versions.map(v => (
                        <option key={v.id} value={v.id}>v{v.versionNum}</option>
                      ))}
                    </select>

                    {/* Sort */}
                    <select
                      value={filterSort}
                      onChange={e => setFilterSort(e.target.value as 'newest' | 'oldest')}
                      className="text-xs bg-[#1e1e2a] border border-[#2a2a3a] text-[#f0f0f5] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#a89bff] transition-colors"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>

                    {/* Min avg confidence */}
                    <select
                      value={filterMinConf}
                      onChange={e => setFilterMinConf(Number(e.target.value))}
                      className="text-xs bg-[#1e1e2a] border border-[#2a2a3a] text-[#f0f0f5] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#a89bff] transition-colors"
                    >
                      <option value={0}>Any confidence</option>
                      <option value={50}>&gt;50% avg conf</option>
                      <option value={70}>&gt;70% avg conf</option>
                      <option value={90}>&gt;90% avg conf</option>
                    </select>

                    <span className="text-[10px] text-[#44445a] ml-auto">
                      {filteredHistory.length} record{filteredHistory.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => { const next: TestRecord[] = []; saveHistory(next); setHistory(next) }}
                      className="text-[10px] text-[#55556a] hover:text-red-400 transition-colors px-2 py-1 rounded-[6px] hover:bg-[#1e1e2a]"
                    >
                      clear all
                    </button>
                  </div>

                  {/* Version comparison table — only when All versions + ≥2 versions with test data */}
                  {showVersionComparison && (() => {
                    const versionsWithData = versions.filter(ver => history.some(r => r.versionId === ver.id))
                    if (versionsWithData.length < 2) return null
                    return (
                      <div className="bg-[#0d0d14] rounded-[10px] p-3 space-y-2">
                        <p className="text-[10px] text-[#55556a] uppercase tracking-wider">Version Comparison (avg confidence)</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr>
                                <th className="text-left text-[#44445a] pb-2 pr-4">Version</th>
                                <th className="text-left text-[#44445a] pb-2 pr-3">Tests</th>
                                {TASK_INFO.map(t => (
                                  <th key={t.key} className="text-left text-[#44445a] pb-2 pr-3">{t.icon}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {versions.map(ver => {
                                const vRecs = history.filter(r => r.versionId === ver.id)
                                if (!vRecs.length) return null
                                const avgConf = (key: typeof taskKeys[number]) =>
                                  Math.round(vRecs.reduce((s, r) => s + r.results[key].conf, 0) / vRecs.length)
                                return (
                                  <tr key={ver.id} className={cn(ver.id === activeId && 'text-[#a89bff]')}>
                                    <td className="pr-4 pb-1.5 font-medium">
                                      {ver.id === activeId && <Star className="w-2.5 h-2.5 inline mr-1" fill="currentColor" />}
                                      v{ver.versionNum}
                                    </td>
                                    <td className="pr-3 pb-1.5 text-[#55556a]">{vRecs.length}</td>
                                    {taskKeys.map(k => (
                                      <td key={k} className={cn('pr-3 pb-1.5 font-medium',
                                        avgConf(k) >= 80 ? 'text-green-400' : avgConf(k) >= 60 ? 'text-yellow-400' : 'text-[#55556a]'
                                      )}>
                                        {avgConf(k)}%
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
                  })()}

                  {/* History cards grid */}
                  {filteredHistory.length === 0 ? (
                    <div className="text-center py-8 text-[#44445a] text-xs">No records match the current filters.</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                      {filteredHistory.map(rec => (
                        <div key={rec.id} className="bg-[#1a1a24] rounded-[10px] overflow-hidden">
                          {/* Thumbnail — clickable zoom */}
                          <div className="relative group cursor-zoom-in" onClick={() => rec.thumbnail && setZoomSrc(rec.thumbnail)}>
                            {rec.thumbnail
                              ? <img src={rec.thumbnail} alt={rec.filename} className="w-full aspect-video object-cover" />
                              : <div className="w-full aspect-video bg-[#0d0d14] flex items-center justify-center text-[#44445a] text-[10px]">no thumb</div>
                            }
                            {rec.thumbnail && (
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </div>

                          <div className="p-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-[#a89bff] font-medium">v{rec.versionNum}</span>
                              <span className="text-[9px] text-[#44445a]">
                                {new Date(rec.testedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            <p className="text-[9px] text-[#55556a] truncate">{rec.filename}</p>
                            <div className="space-y-0.5">
                              {([
                                { icon: '📦', label: rec.results.packaging.label, conf: rec.results.packaging.conf,
                                  color: rec.results.packaging.label === 'ok' ? 'text-green-400' : rec.results.packaging.label === 'damaged' ? 'text-red-400' : 'text-yellow-400' },
                                { icon: '🏷️', label: rec.results.hasLabel.label, conf: rec.results.hasLabel.conf,
                                  color: rec.results.hasLabel.label === 'yes' ? 'text-[#a89bff]' : 'text-[#44445a]' },
                                { icon: '✋', label: rec.results.hasHand.label, conf: rec.results.hasHand.conf,
                                  color: rec.results.hasHand.label === 'yes' ? 'text-[#a89bff]' : 'text-[#44445a]' },
                                { icon: '🔍', label: rec.results.object.label.replace(/_/g, ' '), conf: rec.results.object.conf, color: 'text-[#8888a8]' },
                              ] as const).map(({ icon, label, conf, color }) => (
                                <div key={icon} className="flex items-center justify-between">
                                  <span className="text-[9px]">{icon} <span className={cn('capitalize', color)}>{label}</span></span>
                                  <span className="text-[9px] text-[#44445a]">{conf}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
