import { createContext, useContext, useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js'
import { BrowserMultiFormatReader } from '@zxing/library'
import { supabase } from '@/services/api'

export interface FrameResult {
  timestamp: number
  status: 'ok' | 'error'
  imageId?: string
  error?: string
  detectedText?: string[]
  detectedBarcodes?: string[]
  detectedCodes?: string[]
}

export interface ProcessingJob {
  videoId: string
  videoName: string
  current: number
  total: number
  results: FrameResult[]
  status: 'running' | 'done' | 'error'
  message: string
}

export interface QueuedVideo {
  id: string
  name: string
  filePath: string
}

export const VISION_MODELS = [
  // ── NVIDIA ──────────────────────────────────────────────────────────────
  { id: 'nvidia/nemotron-nano-12b-v2-vl:free',               label: 'Nemotron Nano 12B VL',        provider: 'NVIDIA'     },
  // ── Qwen / Alibaba ───────────────────────────────────────────────────────
  { id: 'qwen/qwen2.5-vl-72b-instruct:free',                 label: 'Qwen 2.5 VL 72B',             provider: 'Alibaba'    },
  { id: 'qwen/qwen2.5-vl-7b-instruct:free',                  label: 'Qwen 2.5 VL 7B',              provider: 'Alibaba'    },
  { id: 'qwen/qwen2-vl-72b-instruct:free',                   label: 'Qwen2 VL 72B',                provider: 'Alibaba'    },
  { id: 'qwen/qwen2-vl-7b-instruct:free',                    label: 'Qwen2 VL 7B',                 provider: 'Alibaba'    },
  // ── Meta Llama ───────────────────────────────────────────────────────────
  { id: 'meta-llama/llama-4-scout:free',                     label: 'Llama 4 Scout',               provider: 'Meta'       },
  { id: 'meta-llama/llama-4-maverick:free',                  label: 'Llama 4 Maverick',            provider: 'Meta'       },
  { id: 'meta-llama/llama-3.2-90b-vision-instruct:free',     label: 'Llama 3.2 90B Vision',        provider: 'Meta'       },
  { id: 'meta-llama/llama-3.2-11b-vision-instruct:free',     label: 'Llama 3.2 11B Vision',        provider: 'Meta'       },
  // ── Google ───────────────────────────────────────────────────────────────
  { id: 'google/gemini-2.0-flash-exp:free',                  label: 'Gemini 2.0 Flash Exp',        provider: 'Google'     },
  { id: 'google/gemini-2.5-flash-preview-05-20:free',        label: 'Gemini 2.5 Flash Preview',    provider: 'Google'     },
  { id: 'google/gemma-3-27b-it:free',                        label: 'Gemma 3 27B',                 provider: 'Google'     },
  { id: 'google/gemma-3-12b-it:free',                        label: 'Gemma 3 12B',                 provider: 'Google'     },
  { id: 'google/gemma-3-4b-it:free',                         label: 'Gemma 3 4B',                  provider: 'Google'     },
  // ── Mistral ──────────────────────────────────────────────────────────────
  { id: 'mistralai/mistral-small-3.2-24b-instruct:free',     label: 'Mistral Small 3.2 24B',       provider: 'Mistral'    },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free',     label: 'Mistral Small 3.1 24B',       provider: 'Mistral'    },
  // ── Microsoft ────────────────────────────────────────────────────────────
  { id: 'microsoft/phi-4-multimodal-instruct:free',          label: 'Phi-4 Multimodal',            provider: 'Microsoft'  },
  { id: 'microsoft/phi-4-vision-instruct:free',              label: 'Phi-4 Vision',                provider: 'Microsoft'  },
  // ── ByteDance ────────────────────────────────────────────────────────────
  { id: 'bytedance-research/ui-tars-72b:free',               label: 'UI-TARS 72B',                 provider: 'ByteDance'  },
  // ── Moonshot ─────────────────────────────────────────────────────────────
  { id: 'moonshotai/kimi-vl-a3b-thinking:free',              label: 'Kimi VL A3B Thinking',        provider: 'Moonshot'   },
  // ── InternLM ─────────────────────────────────────────────────────────────
  { id: 'internlm/internvl3-14b:free',                       label: 'InternVL3 14B',               provider: 'InternLM'   },
  { id: 'internlm/internvl3-2b:free',                        label: 'InternVL3 2B',                provider: 'InternLM'   },
]

interface ProcessingContextValue {
  job: ProcessingJob | null
  queue: QueuedVideo[]
  preferredModel: string
  paused: boolean
  setPreferredModel: (model: string) => void
  addToQueue: (videos: QueuedVideo[]) => void
  removeFromQueue: (videoId: string) => void
  clearQueue: () => void
  startProcessing: (videoId: string, videoName: string, videoEl: HTMLVideoElement) => Promise<void>
  pauseJob: () => void
  resumeJob: () => void
  cancelJob: () => void
  clearJob: () => void
}

const ProcessingContext = createContext<ProcessingContextValue | null>(null)

export function useProcessing() {
  const ctx = useContext(ProcessingContext)
  if (!ctx) throw new Error('useProcessing must be used within ProcessingProvider')
  return ctx
}

export function ProcessingProvider({ children }: { children: ReactNode }) {
  const QUEUE_KEY = 'processing_queue_v1'

  const [job, setJob] = useState<ProcessingJob | null>(null)
  const [preferredModel, setPreferredModelState] = useState<string>(
    () => localStorage.getItem('preferred_vision_model') ?? VISION_MODELS[0].id
  )
  const setPreferredModel = useCallback((model: string) => {
    localStorage.setItem('preferred_vision_model', model)
    setPreferredModelState(model)
  }, [])

  const [queue, setQueue] = useState<QueuedVideo[]>(() => {
    try {
      const saved = localStorage.getItem(QUEUE_KEY)
      return saved ? (JSON.parse(saved) as QueuedVideo[]) : []
    } catch { return [] }
  })
  const [paused, setPaused] = useState(false)
  const processingRef = useRef(false)
  const cancelRef = useRef(false)
  const pauseRef = useRef(false)
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null)
  const ocrWorkerRef = useRef<TesseractWorker | null>(null)

  const getZxing = () => {
    if (!zxingRef.current) zxingRef.current = new BrowserMultiFormatReader()
    return zxingRef.current
  }

  const getOcrWorker = async (): Promise<Tesseract.Worker> => {
    if (!ocrWorkerRef.current) {
      const w = await createWorker('eng+vie', 1, { logger: () => {} })
      ocrWorkerRef.current = w
    }
    return ocrWorkerRef.current
  }

  // Cleanup OCR worker on unmount
  useEffect(() => {
    return () => { ocrWorkerRef.current?.terminate(); ocrWorkerRef.current = null }
  }, [])

  // ── Preprocessing: scale to ≥600px wide + grayscale + adaptive threshold ──
  // Upscaling small frames improves Tesseract accuracy significantly.
  // Adaptive threshold (mean-based) handles uneven lighting better than fixed 128.
  const preprocessForOcr = (src: HTMLCanvasElement): HTMLCanvasElement => {
    const OCR_MIN_WIDTH = 600
    const scale = Math.max(1, OCR_MIN_WIDTH / src.width)
    const out = document.createElement('canvas')
    out.width = Math.round(src.width * scale)
    out.height = Math.round(src.height * scale)
    const ctx = out.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, out.width, out.height)
    const imgData = ctx.getImageData(0, 0, out.width, out.height)
    const d = imgData.data
    // Convert to grayscale and compute mean luminance for adaptive threshold
    const grays = new Uint8Array(d.length / 4)
    let sum = 0
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
      grays[i >> 2] = g
      sum += g
    }
    const mean = sum / grays.length
    // Adaptive threshold: pixels above mean+offset → white, else → black
    const OFFSET = 10
    const thresh = Math.min(220, Math.max(80, mean + OFFSET))
    for (let i = 0; i < d.length; i += 4) {
      const v = grays[i >> 2] >= thresh ? 255 : 0
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 255
    }
    ctx.putImageData(imgData, 0, 0)
    return out
  }

  // ── Step 1: extract frame at timestamp → full-res canvas + small thumb canvas ──
  const extractFrame = (
    videoEl: HTMLVideoElement,
    ts: number,
  ): Promise<{ canvas: HTMLCanvasElement; thumb: HTMLCanvasElement }> =>
    new Promise((resolve, reject) => {
      videoEl.currentTime = ts
      const onSeeked = () => {
        videoEl.removeEventListener('seeked', onSeeked)
        // Wait 2 animation frames so browser finishes decoding the compressed video frame
        requestAnimationFrame(() => requestAnimationFrame(() => {
          try {
            // Full-res — no downscale cap, preserve original video resolution for AI clarity
            const w = videoEl.videoWidth
            const h = videoEl.videoHeight
            const raw = document.createElement('canvas')
            raw.width = w; raw.height = h
            raw.getContext('2d')!.drawImage(videoEl, 0, 0, w, h)

            // Tiny thumbnail (64×36) for fast pixel-diff
            const thumb = document.createElement('canvas')
            thumb.width = 64; thumb.height = 36
            thumb.getContext('2d')!.drawImage(videoEl, 0, 0, 64, 36)

            resolve({ canvas: raw, thumb })
          } catch (e) { reject(e) }
        }))
      }
      videoEl.addEventListener('seeked', onSeeked)
    })

  // ── Step 2: pixel diff — returns fraction of pixels that changed significantly ──
  const pixelDiff = (a: HTMLCanvasElement, b: HTMLCanvasElement): number => {
    const aData = a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data
    const bData = b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data
    let changed = 0
    const total = aData.length / 4
    for (let i = 0; i < aData.length; i += 4) {
      const dr = Math.abs(aData[i] - bData[i])
      const dg = Math.abs(aData[i + 1] - bData[i + 1])
      const db = Math.abs(aData[i + 2] - bData[i + 2])
      if ((dr + dg + db) / 3 > 20) changed++   // threshold: avg channel diff > 20
    }
    return changed / total
  }

  // ── Step 3: edge density heuristic — fast substitute for quick OCR ──
  // High edge pixel % suggests text/labels are present; avoids Tesseract on every frame
  const hasEdgeDensity = (canvas: HTMLCanvasElement, threshold = 0.08): boolean => {
    const small = document.createElement('canvas')
    small.width = 160; small.height = Math.round(160 * (canvas.height / canvas.width))
    const ctx = small.getContext('2d')!
    ctx.drawImage(canvas, 0, 0, small.width, small.height)
    const d = ctx.getImageData(0, 0, small.width, small.height).data
    let edges = 0
    const w = small.width * 4
    for (let i = w; i < d.length - w; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const above = 0.299 * d[i - w] + 0.587 * d[i - w + 1] + 0.114 * d[i - w + 2]
      const left  = 0.299 * d[i - 4] + 0.587 * d[i - 3] + 0.114 * d[i - 2]
      if (Math.abs(gray - above) + Math.abs(gray - left) > 40) edges++
    }
    return edges / (small.width * small.height) > threshold
  }

  // ── Extract tracking codes from OCR text ──
  // Matches VN shipping carriers: J&T (numeric 12-13d), GHN (GHNXXX), GHTK (numeric 9-12d),
  // Viettel Post (VTPxxx), VNPost (numeric 11d), Shopee Express (SPXxxx)
  const extractCodes = (text: string): string[] => {
    const patterns = [
      /\b\d{9,15}\b/g,                              // pure numeric 9-15 digits (GHN, J&T, GHTK, VNPost)
      /\bGHN[A-Z0-9]{5,}\b/gi,                      // GHN tracking: GHNxxxxxxx
      /\bSPX[A-Z0-9]{5,}\b/gi,                      // Shopee Express
      /\bVTP[A-Z0-9]{5,}\b/gi,                       // Viettel Post
      /\bJT[A-Z0-9]{8,}\b/gi,                        // J&T: JTxxxxxxxx
      /\b[A-Z]{1,4}\d{4,}[A-Z0-9]*\b/g,             // letter prefix + mixed: C028Z67, VN123456789
      /\b[A-Z0-9]{2,}[-_.][A-Z0-9]{4,}\b/g,         // dash/dot separated
      /\b[A-Z][A-Z0-9]{5,}\b/g,                      // starts with letter, 6+ total chars
    ]
    const found = new Set<string>()
    for (const pat of patterns) {
      for (const m of text.toUpperCase().matchAll(pat)) {
        const code = m[0].replace(/[_.\-]+$/, '')
        if (code.length >= 6) found.add(code)
      }
    }
    return [...found]
  }

  // ── Step 4: full OCR + barcode decode on kept frames ──
  const decodeBarcode = async (canvas: HTMLCanvasElement): Promise<string[]> => {
    try {
      const img = document.createElement('img')
      await new Promise<void>((res) => { img.onload = () => res(); img.src = canvas.toDataURL() })
      const result = await getZxing().decodeFromImageElement(img)
      return result ? [result.getText()] : []
    } catch { return [] }
  }

  const fullOcr = async (canvas: HTMLCanvasElement): Promise<{ text: string; codes: string[] }> => {
    try {
      const preprocessed = preprocessForOcr(canvas)
      const worker = await getOcrWorker()
      const { data } = await worker.recognize(preprocessed)
      const text = data.text
      const codes = extractCodes(text)
      return { text: text.trim(), codes }
    } catch { return { text: '', codes: [] } }
  }

  const getToken = async (): Promise<string> => {
    // Always refresh before use — access tokens expire in ~1h
    const { data } = await supabase.auth.refreshSession()
    if (data.session) return data.session.access_token
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    return session.access_token
  }

  const startProcessing = useCallback(async (videoId: string, videoName: string, videoEl: HTMLVideoElement) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await supabase.from('videos').update({ status: 'processing' }).eq('id', videoId)

    if (!isFinite(videoEl.duration) || videoEl.duration === 0) {
      await new Promise<void>((res, rej) => {
        const onMeta = () => { videoEl.removeEventListener('loadedmetadata', onMeta); res() }
        videoEl.addEventListener('loadedmetadata', onMeta)
        setTimeout(() => rej(new Error('Timeout')), 15000)
      })
    }

    // ── Video-level pre-checks (no AI needed) ──────────────────────────────
    const VIDEO_MIN_DURATION = 10    // seconds
    const VIDEO_MAX_DURATION = 600   // seconds
    const VIDEO_MIN_WIDTH    = 640   // pixels
    const preCheckErrors: Array<{ error_code: string; source: string; severity: string; description: string; confidence: number }> = []

    if (videoEl.duration < VIDEO_MIN_DURATION) {
      preCheckErrors.push({ error_code: 'VIDEO_TOO_SHORT', source: 'WAREHOUSE', severity: 'CRITICAL',
        description: `Video duration ${videoEl.duration.toFixed(1)}s is below minimum ${VIDEO_MIN_DURATION}s.`, confidence: 1.0 })
    }
    if (videoEl.duration > VIDEO_MAX_DURATION) {
      preCheckErrors.push({ error_code: 'VIDEO_TOO_LONG', source: 'WAREHOUSE', severity: 'WARNING',
        description: `Video duration ${videoEl.duration.toFixed(1)}s exceeds expected ${VIDEO_MAX_DURATION}s.`, confidence: 1.0 })
    }
    if (videoEl.videoWidth > 0 && videoEl.videoWidth < VIDEO_MIN_WIDTH) {
      preCheckErrors.push({ error_code: 'LOW_RESOLUTION', source: 'WAREHOUSE', severity: 'WARNING',
        description: `Video resolution ${videoEl.videoWidth}×${videoEl.videoHeight} is below minimum ${VIDEO_MIN_WIDTH}px width.`, confidence: 1.0 })
    }

    if (preCheckErrors.length > 0) {
      const { data: existingImg } = await supabase.from('dataset_images').select('id, ai_result').eq('video_id', videoId).limit(1).maybeSingle()
      const existing = (existingImg?.ai_result ?? {}) as Record<string, unknown>
      const mergedErrors = [...(Array.isArray(existing.wh_errors) ? existing.wh_errors : []), ...preCheckErrors]
        .filter((e, i, arr) => arr.findIndex((x: any) => x.error_code === e.error_code) === i)
      const hasCritical = mergedErrors.some((e: any) => e.severity === 'CRITICAL')
      const caseStatus = hasCritical ? 'WH_PROCESS_FAIL' : 'PASS_WITH_WARNING'
      if (existingImg?.id) {
        await supabase.from('dataset_images').update({ ai_result: { ...existing, wh_errors: mergedErrors, case_status: caseStatus } }).eq('id', existingImg.id)
      }
    }

    // ── Level 1: lightweight monitoring config ──────────────────────────────
    const MONITOR_INTERVAL   = 0.5   // sample every 0.5s for event detection
    const POST_EVENT_SECS    = 2.0   // collect frames for 2s after event before picking best
    const ROLLING_BUFFER_MAX = 6     // rolling pre-event buffer size (~3s)
    const MOTION_THRESHOLD   = 0.06  // pixelDiff fraction triggering MOTION_EVENT
    const SCENE_THRESHOLD    = 0.22  // pixelDiff fraction triggering SCENE_CHANGE
    const EDGE_SPIKE         = 0.10  // edge density jump → LABEL_VISIBLE
    const DEDUP_THRESHOLD    = 0.04  // skip upload if too similar to last uploaded frame
    const MIN_TEXT_LENGTH    = 10    // minimum OCR chars on selected key frame

    type KeyFrameEvent = 'PARCEL_ENTER' | 'SCENE_CHANGE' | 'MOTION_EVENT' | 'LABEL_VISIBLE' | 'STATIC_LABEL'

    interface MonitoredFrame {
      ts: number
      canvas: HTMLCanvasElement
      thumb: HTMLCanvasElement
      edgeDensity: number
      motionScore: number
    }

    // Quality score for key frame selection (higher = better to send to AI)
    const frameQuality = (f: MonitoredFrame): number =>
      f.edgeDensity * 2.5 + Math.max(0, 0.25 - f.motionScore) * 1.5

    const detectEvent = (f: MonitoredFrame, prev: MonitoredFrame | null): KeyFrameEvent | null => {
      if (!prev) return 'PARCEL_ENTER'
      if (f.motionScore > SCENE_THRESHOLD) return 'SCENE_CHANGE'
      if (f.edgeDensity > EDGE_SPIKE && prev.edgeDensity < EDGE_SPIKE * 0.7) return 'LABEL_VISIBLE'
      if (f.motionScore > MOTION_THRESHOLD) return 'MOTION_EVENT'
      if (f.edgeDensity > EDGE_SPIKE) return 'STATIC_LABEL'
      return null
    }

    const computeEdgeDensity = (canvas: HTMLCanvasElement): number => {
      const small = document.createElement('canvas')
      small.width = 160; small.height = Math.round(160 * (canvas.height / canvas.width))
      const ctx = small.getContext('2d')!
      ctx.drawImage(canvas, 0, 0, small.width, small.height)
      const d = ctx.getImageData(0, 0, small.width, small.height).data
      let edges = 0
      const w = small.width * 4
      for (let i = w; i < d.length - w; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        const above = 0.299 * d[i - w] + 0.587 * d[i - w + 1] + 0.114 * d[i - w + 2]
        const left  = 0.299 * d[i - 4] + 0.587 * d[i - 3] + 0.114 * d[i - 2]
        if (Math.abs(gray - above) + Math.abs(gray - left) > 40) edges++
      }
      return edges / (small.width * small.height)
    }

    const duration = videoEl.duration
    const monitorTs: number[] = []
    for (let t = 0; t < duration; t += MONITOR_INTERVAL)
      monitorTs.push(parseFloat(t.toFixed(1)))
    if (monitorTs.length === 0) monitorTs.push(0)

    const results: FrameResult[] = []
    let lastUploadedThumb: HTMLCanvasElement | null = null
    let thumbnailUpdated = false
    let kept = 0
    const eventTimeline: Array<{ ts: number; event: string; quality: number }> = []

    cancelRef.current = false
    pauseRef.current = false
    setPaused(false)
    setJob({
      videoId, videoName,
      current: 0, total: monitorTs.length,
      results: [], status: 'running',
      message: 'Level 1: monitoring video for events...',
    })

    let token = session.access_token
    let tokenFetchedAt = Date.now()

    const uploadKeyFrame = async (
      f: MonitoredFrame,
      eventType: KeyFrameEvent,
      clientBarcodes: string[],
      ocrResult: { text: string; codes: string[] },
    ): Promise<FrameResult> => {
      kept++
      lastUploadedThumb = f.thumb
      setJob(prev => prev ? {
        ...prev,
        message: `[${eventType}] @${f.ts}s — uploading key frame ${kept} (quality ${frameQuality(f).toFixed(2)})`,
      } : null)

      const filename = `frame_${String(Math.round(f.ts * 10)).padStart(7, '0')}.jpg`
      const base64 = f.canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
      const body = JSON.stringify({
        image_base64: base64, video_id: videoId, frame_timestamp: f.ts, filename,
        client_barcodes: clientBarcodes,
        client_tracking_codes: ocrResult.codes,
        client_label_text: ocrResult.text ? [ocrResult.text] : [],
        event_type: eventType,
        ocr_only: true,
      })

      let res: Response | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt))
        res = await fetch('/api/analyze_frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body,
        })
        if (res.ok || ![502, 504].includes(res.status)) break
      }

      if (!res!.ok) {
        const err = await res!.json().catch(() => ({})) as { detail?: string }
        return { timestamp: f.ts, status: 'error', error: err.detail ?? `HTTP ${res!.status}` }
      }
      const data = await res!.json() as { id: string; file_path?: string; ai_result: Record<string, unknown> }
      const ai = data.ai_result ?? {}
      if (!thumbnailUpdated && data.file_path) {
        thumbnailUpdated = true
        supabase.from('videos').update({ thumbnail_path: data.file_path }).eq('id', videoId).then(() => {})
      }
      return {
        timestamp: f.ts, status: 'ok', imageId: data.id,
        detectedText: (ai.label_text as string[] | undefined) ?? [],
        detectedBarcodes: (ai.barcodes as string[] | undefined) ?? [],
        detectedCodes: (ai.tracking_codes as string[] | undefined) ?? [],
      }
    }

    // Rolling pre-event buffer + active event window state
    const rollingBuffer: MonitoredFrame[] = []
    let prevMonitored: MonitoredFrame | null = null
    let eventWindow: { event: KeyFrameEvent; frames: MonitoredFrame[]; closeAt: number } | null = null
    let uploadInFlight: Promise<FrameResult> | null = null

    const flushEventWindow = async () => {
      if (!eventWindow || eventWindow.frames.length === 0) { eventWindow = null; return }
      // Pick best-quality frame in window
      const best = eventWindow.frames.reduce((a, b) => frameQuality(a) >= frameQuality(b) ? a : b)
      const q = frameQuality(best)

      // Dedup: skip if too similar to last uploaded
      if (lastUploadedThumb && pixelDiff(lastUploadedThumb, best.thumb) < DEDUP_THRESHOLD) {
        eventWindow = null; return
      }

      // OCR on best frame
      const [clientBarcodes, ocrResult] = await Promise.all([
        decodeBarcode(best.canvas),
        fullOcr(best.canvas),
      ])

      if (ocrResult.text.length >= MIN_TEXT_LENGTH || clientBarcodes.length > 0) {
        if (uploadInFlight) { results.push(await uploadInFlight) }
        uploadInFlight = uploadKeyFrame(best, eventWindow.event, clientBarcodes, ocrResult)
        eventTimeline.push({ ts: best.ts, event: eventWindow.event, quality: q })
        setJob(p => p ? { ...p, results: [...results] } : null)
      }
      eventWindow = null
    }

    for (let i = 0; i < monitorTs.length; i++) {
      if (cancelRef.current) break

      // Pause: spin-wait until resumed or cancelled
      while (pauseRef.current && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 300))
      }
      if (cancelRef.current) break

      const ts = monitorTs[i]

      if (Date.now() - tokenFetchedAt > 45 * 60 * 1000) {
        try { token = await getToken(); tokenFetchedAt = Date.now() } catch { /* keep old */ }
      }

      setJob(prev => prev ? {
        ...prev, current: i + 1,
        message: `Monitoring ${i + 1}/${monitorTs.length} @${ts}s — ${kept} key frames selected`,
      } : null)

      try {
        const { canvas, thumb } = await extractFrame(videoEl, ts)
        const edgeDensity = computeEdgeDensity(canvas)
        const motionScore = prevMonitored ? pixelDiff(prevMonitored.thumb, thumb) : 0

        const monitored: MonitoredFrame = { ts, canvas, thumb, edgeDensity, motionScore }

        // Rolling pre-event buffer
        rollingBuffer.push(monitored)
        if (rollingBuffer.length > ROLLING_BUFFER_MAX) rollingBuffer.shift()

        const ev = detectEvent(monitored, prevMonitored)
        prevMonitored = monitored

        // Close active event window if its time is up
        if (eventWindow && ts >= eventWindow.closeAt) {
          await flushEventWindow()
        }

        if (ev && !eventWindow) {
          // Start new event window — seed with rolling pre-event buffer
          eventWindow = {
            event: ev,
            frames: [...rollingBuffer],
            closeAt: ts + POST_EVENT_SECS,
          }
        } else if (ev && eventWindow) {
          // Higher-priority event overrides current window
          const priority: KeyFrameEvent[] = ['SCENE_CHANGE', 'PARCEL_ENTER', 'LABEL_VISIBLE', 'MOTION_EVENT', 'STATIC_LABEL']
          if (priority.indexOf(ev) < priority.indexOf(eventWindow.event)) {
            await flushEventWindow()
            eventWindow = { event: ev, frames: [...rollingBuffer], closeAt: ts + POST_EVENT_SECS }
          } else {
            eventWindow.frames.push(monitored)
          }
        } else if (eventWindow) {
          eventWindow.frames.push(monitored)
        }

      } catch (e) {
        results.push({ timestamp: ts, status: 'error', error: e instanceof Error ? e.message : 'unknown' })
      }
    }

    // Flush remaining event window + in-flight upload
    await flushEventWindow()
    if (uploadInFlight) {
      try { results.push(await uploadInFlight) } catch (e) {
        results.push({ timestamp: monitorTs[monitorTs.length - 1], status: 'error', error: e instanceof Error ? e.message : 'unknown' })
      }
    }
    setJob(prev => prev ? { ...prev, results: [...results] } : null)

    // Save event timeline to video metadata
    if (eventTimeline.length > 0) {
      supabase.from('videos').update({ event_timeline: eventTimeline } as any).eq('id', videoId).then(() => {})
    }

    const ok = results.filter(r => r.status === 'ok').length
    const wasCancelled = cancelRef.current
    cancelRef.current = false
    await supabase.from('videos').update({ status: ok > 0 ? 'ready' : wasCancelled ? 'pending' : 'failed' }).eq('id', videoId)

    // Finalize video audit — aggregate wh_errors across all frames → verdict
    let auditMsg = ''
    if (ok > 0 && !wasCancelled) {
      try {
        setJob(prev => prev ? { ...prev, message: 'Finalizing video audit…' } : null)
        const freshToken = await getToken()
        const auditResp = await fetch(`/api/finalize_video_audit?video_id=${videoId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${freshToken}` },
        })
        if (auditResp.ok) {
          const audit = await auditResp.json() as { case_status?: string; video_evidence_score?: number; wh_errors?: unknown[] }
          const errCount = audit.wh_errors?.length ?? 0
          auditMsg = ` | Audit: ${audit.case_status} (score ${audit.video_evidence_score}/100, ${errCount} issues)`
        }
      } catch { /* non-fatal */ }

      // Classify video type (PACKING / UNBOXING / UNKNOWN) from temporal frame evidence
      try {
        setJob(prev => prev ? { ...prev, message: 'Classifying video type…' } : null)
        const freshToken2 = await getToken()
        const classifyResp = await fetch(`/api/classify_video_type?video_id=${videoId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${freshToken2}` },
        })
        if (classifyResp.ok) {
          const classify = await classifyResp.json() as { video_type?: string; confidence?: number }
          const pct = Math.round((classify.confidence ?? 0) * 100)
          auditMsg += ` | ${classify.video_type ?? 'UNKNOWN_VIDEO'} (${pct}%)`
        }
      } catch { /* non-fatal */ }
    }

    setJob(prev => prev ? {
      ...prev, status: 'done',
      message: wasCancelled
        ? `Cancelled — ${ok} key frames saved`
        : `Done! ${kept} key frames → ${ok} uploaded (${eventTimeline.length} events)${auditMsg}`,
    } : null)
  }, [])

  const pauseJob = useCallback(() => { pauseRef.current = true; setPaused(true) }, [])
  const resumeJob = useCallback(() => { pauseRef.current = false; setPaused(false) }, [])
  const cancelJob = useCallback(() => { pauseRef.current = false; setPaused(false); cancelRef.current = true }, [])
  const clearJob = useCallback(() => setJob(null), [])

  const setQueuePersisted = useCallback((updater: (prev: QueuedVideo[]) => QueuedVideo[]) => {
    setQueue(prev => {
      const next = updater(prev)
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const addToQueue = useCallback((videos: QueuedVideo[]) => {
    setQueuePersisted(prev => {
      const existingIds = new Set(prev.map(v => v.id))
      return [...prev, ...videos.filter(v => !existingIds.has(v.id))]
    })
  }, [setQueuePersisted])

  const removeFromQueue = useCallback((videoId: string) => {
    setQueuePersisted(prev => prev.filter(v => v.id !== videoId))
  }, [setQueuePersisted])

  const clearQueue = useCallback(() => {
    setQueuePersisted(() => [])
  }, [setQueuePersisted])

  // Auto-process queue: when job is idle and queue has items, pick next and run
  useEffect(() => {
    if (processingRef.current) return
    if (queue.length === 0) return
    if (job && job.status === 'running') return

    const next = queue[0]
    if (!next.filePath) return

    processingRef.current = true
    setQueuePersisted(prev => prev.slice(1))

    const videoEl = hiddenVideoRef.current!
    videoEl.src = next.filePath
    videoEl.load()

    startProcessing(next.id, next.name, videoEl).finally(() => {
      processingRef.current = false
    })
  }, [queue, job, startProcessing])

  return (
    <ProcessingContext.Provider value={{ job, queue, preferredModel, paused, setPreferredModel, addToQueue, removeFromQueue, clearQueue, startProcessing, pauseJob, resumeJob, cancelJob, clearJob }}>
      {/* Hidden video element used for background queue processing */}
      <video ref={hiddenVideoRef} className="hidden" preload="metadata" crossOrigin="anonymous" />
      {children}
    </ProcessingContext.Provider>
  )
}
