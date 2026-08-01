import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Brain, Database, Play, Download, CheckCircle, Loader2, AlertCircle, BarChart3 } from 'lucide-react'
import { supabase } from '@/services/api'
import { cn } from '@/utils/cn'

// Lazy-load TF.js to avoid blocking initial render
async function loadTF() {
  const tf = await import('@tensorflow/tfjs')
  await import('@tensorflow/tfjs-backend-webgl')
  await tf.ready()
  return tf
}

interface TrainingSample {
  imageUrl: string
  label: 'ok' | 'damaged' | 'unknown'
}

const LABELS = ['ok', 'damaged', 'unknown'] as const
type Label = typeof LABELS[number]

const LABEL_COLORS: Record<Label, string> = {
  ok: 'text-green-400',
  damaged: 'text-red-400',
  unknown: 'text-[#8888a8]',
}

async function fetchTrainingSamples(): Promise<TrainingSample[]> {
  // Get approved frames with packaging_status
  const { data, error } = await supabase
    .from('dataset_images')
    .select('file_path, ai_result, annotations(status)')
    .not('ai_result', 'is', null)

  if (error) throw new Error(error.message)

  const samples: TrainingSample[] = []
  for (const row of data ?? []) {
    const ann = (row.annotations as { status: string }[])?.[0]
    if (ann?.status !== 'approved') continue
    const status = (row.ai_result as { packaging_status?: string })?.packaging_status
    if (!status || !LABELS.includes(status as Label)) continue
    samples.push({ imageUrl: row.file_path, label: status as Label })
  }
  return samples
}

async function loadImageTensor(tf: Awaited<ReturnType<typeof loadTF>>, url: string, size = 224) {
  return new Promise<ReturnType<typeof tf.tensor3d>>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      canvas.getContext('2d')!.drawImage(img, 0, 0, size, size)
      const tensor = tf.browser.fromPixels(canvas)
        .toFloat()
        .div(255)
        .expandDims(0) as ReturnType<typeof tf.tensor3d>
      resolve(tensor)
    }
    img.onerror = () => reject(new Error(`Failed to load ${url}`))
    img.src = url
  })
}

export function MiniAITrainer() {
  const [phase, setPhase] = useState<'idle' | 'extracting' | 'training' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ step: '', percent: 0, epoch: 0, loss: 0, acc: 0 })
  const [modelReady, setModelReady] = useState(false)
  const [testResult, setTestResult] = useState<{ label: string; confidence: number } | null>(null)
  const [testImage, setTestImage] = useState<string | null>(null)
  const modelRef = useRef<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['training-samples'],
    queryFn: fetchTrainingSamples,
  })

  const counts = LABELS.reduce((acc, l) => {
    acc[l] = samples.filter(s => s.label === l).length
    return acc
  }, {} as Record<Label, number>)

  const canTrain = samples.length >= 6 && LABELS.filter(l => counts[l] > 0).length >= 2

  const startTraining = async () => {
    setPhase('extracting')
    setProgress({ step: 'Đang load TensorFlow.js...', percent: 5, epoch: 0, loss: 0, acc: 0 })

    try {
      const tf = await loadTF()
      const mobilenet = await import('@tensorflow-models/mobilenet')

      setProgress(p => ({ ...p, step: 'Đang load MobileNet...', percent: 10 }))
      const mobileNet = await mobilenet.load({ version: 2, alpha: 0.5 })

      // Extract features for all samples
      setProgress(p => ({ ...p, step: 'Đang extract features từ ảnh...', percent: 15 }))
      const features: number[][] = []
      const labelIndices: number[] = []

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i]
        try {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise<void>((res, rej) => {
            img.onload = () => res(); img.onerror = () => rej()
            img.src = sample.imageUrl
          })
          const embedding = mobileNet.infer(img, true) as any
          const data = await embedding.data()
          features.push(Array.from(data))
          embedding.dispose()
          labelIndices.push(LABELS.indexOf(sample.label))
        } catch { /* skip failed images */ }
        setProgress(p => ({
          ...p,
          step: `Extracting features ${i + 1}/${samples.length}`,
          percent: 15 + Math.round((i / samples.length) * 40),
        }))
      }

      if (features.length < 4) throw new Error('Không đủ ảnh load được')

      // Build classifier on top of MobileNet features
      setPhase('training')
      setProgress(p => ({ ...p, step: 'Đang train classifier...', percent: 55 }))

      const xs = tf.tensor2d(features)
      const ys = tf.oneHot(tf.tensor1d(labelIndices, 'int32'), LABELS.length)

      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [features[0].length], units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: LABELS.length, activation: 'softmax' }),
        ],
      })
      model.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy', metrics: ['accuracy'] })

      const EPOCHS = 30
      await model.fit(xs, ys, {
        epochs: EPOCHS,
        batchSize: Math.min(8, features.length),
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            setProgress({
              step: `Training epoch ${epoch + 1}/${EPOCHS}`,
              percent: 55 + Math.round(((epoch + 1) / EPOCHS) * 40),
              epoch: epoch + 1,
              loss: parseFloat((logs?.loss ?? 0).toFixed(4)),
              acc: parseFloat(((logs?.acc ?? 0) * 100).toFixed(1)),
            })
          },
        },
      })

      xs.dispose(); ys.dispose()
      modelRef.current = { model, mobileNet }

      setPhase('done')
      setModelReady(true)
      setProgress(p => ({ ...p, step: 'Training hoàn tất!', percent: 100 }))
    } catch (e) {
      setPhase('error')
      setProgress(p => ({ ...p, step: e instanceof Error ? e.message : 'Lỗi không xác định' }))
    }
  }

  const testFrame = async (file: File) => {
    if (!modelRef.current) return
    const { model, mobileNet } = modelRef.current
    const url = URL.createObjectURL(file)
    setTestImage(url)
    setTestResult(null)

    const img = new Image()
    img.onload = async () => {
      const embedding = mobileNet.infer(img, true) as any
      const tf = await loadTF()
      const embData = await (embedding as any).data() as Float32Array
      const input = tf.tensor2d([Array.from(embData)])
      const pred = model.predict(input) as any
      const probs = Array.from(await pred.data() as Float32Array) as number[]
      const maxIdx = probs.indexOf(Math.max(...probs))
      embedding.dispose(); input.dispose(); pred.dispose()
      setTestResult({ label: LABELS[maxIdx], confidence: Math.round(probs[maxIdx] * 100) })
    }
    img.src = url
  }

  const downloadModel = async () => {
    if (!modelRef.current) return
    await modelRef.current.model.save('downloads://packaging-classifier')
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[#7c6af720] flex items-center justify-center">
          <Brain className="w-5 h-5 text-[#a89bff]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#f0f0f5]">Mini AI Trainer</h1>
          <p className="text-xs text-[#8888a8]">Train packaging classifier từ approved frames</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Dataset stats */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-[14px] bg-[#111118] border border-[#1e1e2a] p-4 space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-[#55556a]" />
              <h3 className="text-sm font-semibold text-[#f0f0f5]">Training Dataset</h3>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-[#55556a] text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                {LABELS.map(label => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', {
                        'bg-green-400': label === 'ok',
                        'bg-red-400': label === 'damaged',
                        'bg-[#55556a]': label === 'unknown',
                      })} />
                      <span className="text-xs text-[#8888a8] capitalize">{label}</span>
                    </div>
                    <span className={cn('text-xs font-medium', LABEL_COLORS[label])}>
                      {counts[label]} frames
                    </span>
                  </div>
                ))}

                <div className="pt-2 border-t border-[#1e1e2a]">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#55556a]">Total approved</span>
                    <span className="text-[#f0f0f5] font-medium">{samples.length}</span>
                  </div>
                </div>

                {!canTrain && (
                  <div className="flex items-start gap-2 bg-[#f59e0b10] rounded-[8px] p-2.5">
                    <AlertCircle className="w-3.5 h-3.5 text-[#fbbf24] flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-[#fbbf24]">
                      Cần ít nhất 6 frames approved (≥2 class) để train. Hãy approve thêm trong Annotation Queue.
                    </p>
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
              {testImage && (
                <img src={testImage} alt="test" className="w-full aspect-video object-cover rounded-[8px]" />
              )}
              {testResult && (
                <div className="bg-[#1a1a24] rounded-[8px] p-3 text-center">
                  <p className={cn('text-lg font-bold capitalize', LABEL_COLORS[testResult.label as Label])}>
                    {testResult.label}
                  </p>
                  <p className="text-xs text-[#55556a]">confidence {testResult.confidence}%</p>
                </div>
              )}
              <button onClick={downloadModel}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#7c6af720] hover:bg-[#7c6af740] text-[#a89bff] text-xs rounded-[8px] transition-colors">
                <Download className="w-3.5 h-3.5" /> Download Model
              </button>
            </div>
          )}
        </div>

        {/* Training panel */}
        <div className="lg:col-span-2 rounded-[14px] bg-[#111118] border border-[#1e1e2a] p-5 space-y-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#55556a]" />
            <h3 className="text-sm font-semibold text-[#f0f0f5]">Training</h3>
          </div>

          {/* Architecture info */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Base Model', value: 'MobileNetV2' },
              { label: 'Classes', value: `${LABELS.length} (ok/damaged/unknown)` },
              { label: 'Method', value: 'Transfer Learning' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#1a1a24] rounded-[8px] p-3">
                <p className="text-[10px] text-[#55556a] mb-1">{label}</p>
                <p className="text-xs text-[#f0f0f5] font-medium">{value}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          {phase !== 'idle' && (
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className={cn('text-[#8888a8]', phase === 'error' && 'text-red-400')}>
                  {progress.step}
                </span>
                <span className="text-[#f0f0f5]">{progress.percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#1e1e2a]">
                <div
                  className={cn('h-2 rounded-full transition-all duration-500',
                    phase === 'error' ? 'bg-red-500' : phase === 'done' ? 'bg-green-500' : 'bg-[#7c6af7]'
                  )}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              {phase === 'training' && progress.epoch > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Epoch', value: `${progress.epoch}/30` },
                    { label: 'Loss', value: progress.loss },
                    { label: 'Accuracy', value: `${progress.acc}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#1a1a24] rounded-[8px] p-2.5 text-center">
                      <p className="text-[10px] text-[#55556a]">{label}</p>
                      <p className="text-sm font-bold text-[#a89bff]">{value}</p>
                    </div>
                  ))}
                </div>
              )}
              {phase === 'done' && (
                <div className="flex items-center gap-2 bg-[#16a34a20] rounded-[8px] p-3">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <p className="text-xs text-green-400">
                    Model đã train xong! Dùng tab "Test Model" để kiểm tra, hoặc Download để lưu lại.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Start button */}
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
              {phase === 'error' ? 'Thử lại' : 'Bắt đầu Training'}
            </button>
          )}

          {(phase === 'extracting' || phase === 'training') && (
            <div className="flex items-center justify-center gap-2 py-3 text-[#8888a8] text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-[#7c6af7]" />
              Đang xử lý trong browser...
            </div>
          )}

          {/* How it works */}
          <div className="border-t border-[#1e1e2a] pt-4 space-y-2">
            <p className="text-[10px] text-[#55556a] font-medium uppercase tracking-wide">Cách hoạt động</p>
            {[
              '1. Load MobileNetV2 pretrained (feature extractor)',
              '2. Extract embedding từ mỗi approved frame',
              '3. Train classifier layer: ok / damaged / unknown',
              '4. Model chạy hoàn toàn trong browser, không cần server',
            ].map(step => (
              <p key={step} className="text-[11px] text-[#55556a]">{step}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
