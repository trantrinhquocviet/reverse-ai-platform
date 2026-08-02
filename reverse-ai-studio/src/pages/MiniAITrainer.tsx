import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Brain, Database, Play, Download, CheckCircle, Loader2, AlertCircle, BarChart3, Layers } from 'lucide-react'
import { supabase } from '@/services/api'
import { cn } from '@/utils/cn'

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
  packaging: PackagingLabel   // Task 1
  hasLabel:  boolean          // Task 2: shipping_label visible?
  hasHand:   boolean          // Task 3: hand visible?
  dominantObject: ObjectLabel // Task 4: most confident detected object
}

interface DetectedObject { label: string; confidence: number }

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
export function MiniAITrainer() {
  const [phase, setPhase] = useState<'idle' | 'extracting' | 'training' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ step: '', percent: 0, epoch: 0, losses: [0, 0, 0, 0], accs: [0, 0, 0, 0] })
  const [modelReady, setModelReady] = useState(false)
  const [testResult, setTestResult] = useState<{
    packaging: { label: string; conf: number }
    hasLabel:  { label: string; conf: number }
    hasHand:   { label: string; conf: number }
    object:    { label: string; conf: number }
  } | null>(null)
  const [testImage, setTestImage] = useState<string | null>(null)
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

  // ── Training ─────────────────────────────────────────────────────────────
  const startTraining = async () => {
    setPhase('extracting')
    setProgress(p => ({ ...p, step: 'Loading TensorFlow.js...', percent: 5 }))

    try {
      const tf = await loadTF()
      const mobilenet = await import('@tensorflow-models/mobilenet')

      setProgress(p => ({ ...p, step: 'Loading MobileNetV2...', percent: 10 }))
      const mobileNet = await mobilenet.load({ version: 2, alpha: 0.5 })

      // Extract MobileNet features
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

      // ── Build multi-output functional model ──
      setPhase('training')
      setProgress(p => ({ ...p, step: 'Building multi-task model...', percent: 55 }))

      const featSize = features[0].length
      const inputLayer = tf.input({ shape: [featSize] })
      const shared1 = tf.layers.dense({ units: 256, activation: 'relu' }).apply(inputLayer) as any
      const dropped = tf.layers.dropout({ rate: 0.3 }).apply(shared1) as any

      // 4 task heads
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

      // Build label tensors
      const xs       = tf.tensor2d(features)
      const ysPackaging = tf.oneHot(tf.tensor1d(labels.packaging, 'int32'), PACKAGING_LABELS.length)
      const ysLabel  = tf.oneHot(tf.tensor1d(labels.hasLabel, 'int32'), 2)
      const ysHand   = tf.oneHot(tf.tensor1d(labels.hasHand, 'int32'), 2)
      const ysObject = tf.oneHot(tf.tensor1d(labels.object, 'int32'), OBJECT_LABELS.length)

      const EPOCHS = 40
      await model.fit(xs, [ysPackaging, ysLabel, ysHand, ysObject], {
        epochs: EPOCHS,
        batchSize: Math.min(8, features.length),
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            const get = (key: string) => parseFloat(((logs?.[key] ?? 0) as number).toFixed(4))
            setProgress({
              step: `Training epoch ${epoch + 1}/${EPOCHS}`,
              percent: 55 + Math.round(((epoch + 1) / EPOCHS) * 42),
              epoch: epoch + 1,
              losses: [get('packaging_loss'), get('has_label_loss'), get('has_hand_loss'), get('object_type_loss')],
              accs: [
                parseFloat(((logs?.['packaging_acc'] ?? 0) as number * 100).toFixed(1)),
                parseFloat(((logs?.['has_label_acc'] ?? 0) as number * 100).toFixed(1)),
                parseFloat(((logs?.['has_hand_acc'] ?? 0) as number * 100).toFixed(1)),
                parseFloat(((logs?.['object_type_acc'] ?? 0) as number * 100).toFixed(1)),
              ],
            })
          },
        },
      })

      xs.dispose(); ysPackaging.dispose(); ysLabel.dispose(); ysHand.dispose(); ysObject.dispose()
      modelRef.current = { model, mobileNet }
      setPhase('done')
      setModelReady(true)
      setProgress(p => ({ ...p, step: 'Training hoàn tất! 4 tasks learned.', percent: 100 }))
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
      setTestResult({ packaging, hasLabel, hasHand, object })
    }
    img.src = url
  }

  const downloadModel = async () => {
    if (!modelRef.current) return
    await modelRef.current.model.save('downloads://warehouse-multitask-classifier')
  }

  const TASK_INFO = [
    { key: 'packaging', label: 'Packaging Status', labels: PACKAGING_LABELS, icon: '📦' },
    { key: 'hasLabel',  label: 'Shipping Label',   labels: BOOL_LABELS,      icon: '🏷️' },
    { key: 'hasHand',   label: 'Hand Present',      labels: BOOL_LABELS,      icon: '✋' },
    { key: 'object',    label: 'Dominant Object',   labels: OBJECT_LABELS,    icon: '🔍' },
  ]

  return (
    <div className="p-6 space-y-5 animate-fade-in">
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
        {/* Left panel */}
        <div className="space-y-4">
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

          {/* Test model */}
          {modelReady && (
            <div className="rounded-[14px] bg-[#111118] border border-[#1e1e2a] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#f0f0f5]">Test Model</h3>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && testFrame(e.target.files[0])} />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full py-2 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#8888a8] text-xs rounded-[8px] transition-colors"
              >
                Upload ảnh để test
              </button>
              {testImage && <img src={testImage} alt="test" className="w-full aspect-video object-cover rounded-[8px]" />}
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
        </div>

        {/* Right: training panel */}
        <div className="lg:col-span-2 rounded-[14px] bg-[#111118] border border-[#1e1e2a] p-5 space-y-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#55556a]" />
            <h3 className="text-sm font-semibold text-[#f0f0f5]">Multi-Task Training</h3>
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
                    Xong! Model học được 4 tasks cùng lúc. Test ngay hoặc Download để dùng offline.
                  </p>
                </div>
              )}
            </div>
          )}

          {(phase === 'idle' || phase === 'error') && (
            <button
              onClick={startTraining}
              disabled={!canTrain || isLoading}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 rounded-[10px] text-sm font-medium transition-colors',
                canTrain && !isLoading
                  ? 'bg-[#7c6af7] hover:bg-[#6b5ce7] text-white'
                  : 'bg-[#1e1e2a] text-[#55556a] cursor-not-allowed'
              )}
            >
              <Play className="w-4 h-4" />
              {phase === 'error' ? 'Thử lại' : 'Train All 4 Tasks'}
            </button>
          )}
          {(phase === 'extracting' || phase === 'training') && (
            <div className="flex items-center justify-center gap-2 py-3 text-[#8888a8] text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-[#7c6af7]" />
              Đang train trong browser...
            </div>
          )}

          {/* How it works */}
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
      </div>
    </div>
  )
}
