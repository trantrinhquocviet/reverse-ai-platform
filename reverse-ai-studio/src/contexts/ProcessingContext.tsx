import { createContext, useContext, useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import Tesseract from 'tesseract.js'
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
  setPreferredModel: (model: string) => void
  addToQueue: (videos: QueuedVideo[]) => void
  removeFromQueue: (videoId: string) => void
  clearQueue: () => void
  startProcessing: (videoId: string, videoName: string, videoEl: HTMLVideoElement) => Promise<void>
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
  const processingRef = useRef(false)
  const cancelRef = useRef(false)
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null)

  const getZxing = () => {
    if (!zxingRef.current) zxingRef.current = new BrowserMultiFormatReader()
    return zxingRef.current
  }

  // ── Preprocessing: grayscale + contrast boost → makes text pop for OCR ──
  const preprocessForOcr = (src: HTMLCanvasElement): HTMLCanvasElement => {
    const out = document.createElement('canvas')
    out.width = src.width; out.height = src.height
    const ctx = out.getContext('2d')!
    ctx.drawImage(src, 0, 0)
    const img = ctx.getImageData(0, 0, out.width, out.height)
    const d = img.data
    const CONTRAST = 1.6   // >1 increases contrast
    const BRIGHTNESS = 10  // slight brightness lift
    for (let i = 0; i < d.length; i += 4) {
      // Luminance-weighted grayscale
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      // Contrast + brightness
      const v = Math.min(255, Math.max(0, (gray - 128) * CONTRAST + 128 + BRIGHTNESS))
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(img, 0, 0)
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
  // Matches: pure numeric ≥10 digits (J&T, GHTK, GHN...) OR alphanumeric ≥6 chars
  const extractCodes = (text: string): string[] => {
    const patterns = [
      /\b\d{10,}\b/g,                           // pure numeric ≥10 digits: 8621062280060
      /\b[A-Z]{1,4}\d{4,}[A-Z0-9]*\b/g,        // letter prefix + mixed: C028Z67, VN123456789
      /\b[A-Z0-9]{2,}[-_.][A-Z0-9]{4,}\b/g,    // dash/dot separated
      /\b[A-Z][A-Z0-9]{5,}\b/g,                 // starts with letter, 6+ total chars
    ]
    const found = new Set<string>()
    for (const pat of patterns) {
      for (const m of text.matchAll(pat)) {
        const code = m[0].replace(/[_.\-]$/,'')
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
      // Run OCR on preprocessed version (grayscale + contrast) for better accuracy
      const preprocessed = preprocessForOcr(canvas)
      const { data } = await Tesseract.recognize(preprocessed, 'eng', { logger: () => {} })
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

    // Wait for metadata
    if (!isFinite(videoEl.duration) || videoEl.duration === 0) {
      await new Promise<void>((res, rej) => {
        const onMeta = () => { videoEl.removeEventListener('loadedmetadata', onMeta); res() }
        videoEl.addEventListener('loadedmetadata', onMeta)
        setTimeout(() => rej(new Error('Timeout')), 15000)
      })
    }

    // Sample every 2s
    const SAMPLE_INTERVAL = 2
    const OFFSET = 0
    const EDGE_THRESHOLD = 0.04     // 4% edge pixels — fast pre-filter before OCR
    const MIN_TEXT_LENGTH = 15      // minimum OCR chars to keep frame

    const duration = videoEl.duration
    const candidates: number[] = []
    for (let t = OFFSET; t < duration; t += SAMPLE_INTERVAL)
      candidates.push(parseFloat(t.toFixed(1)))
    if (candidates.length === 0) candidates.push(Math.min(OFFSET, duration - 1))

    const SIMILAR_THRESHOLD = 0.03  // < 3% pixel diff vs last saved frame → skip duplicate

    const results: FrameResult[] = []
    let lastSavedThumb: HTMLCanvasElement | null = null
    let thumbnailUpdated = false
    let kept = 0

    cancelRef.current = false
    setJob({
      videoId, videoName,
      current: 0, total: candidates.length,
      results: [], status: 'running',
      message: 'Scanning frames...',
    })

    let token = session.access_token
    let tokenFetchedAt = Date.now()

    for (let i = 0; i < candidates.length; i++) {
      if (cancelRef.current) break

      const ts = candidates[i]

      // Refresh token every 45 minutes to avoid expiry on long videos
      if (Date.now() - tokenFetchedAt > 45 * 60 * 1000) {
        try { token = await getToken(); tokenFetchedAt = Date.now() } catch { /* keep old */ }
      }

      setJob(prev => prev ? {
        ...prev, current: i + 1,
        message: `OCR scanning ${i + 1}/${candidates.length} — ${kept} frames with text`,
      } : null)

      try {
        const { canvas, thumb } = await extractFrame(videoEl, ts)

        // ── Filter 1: edge density (fast — no Tesseract) ──
        if (!hasEdgeDensity(canvas, EDGE_THRESHOLD)) continue  // no labels/text visible, skip

        // ── Filter 2: similarity vs last saved frame ──
        if (lastSavedThumb && pixelDiff(lastSavedThumb, thumb) < SIMILAR_THRESHOLD) continue

        // ── Edge density passed → run full OCR ──
        const [clientBarcodes, ocrResult] = await Promise.all([
          decodeBarcode(canvas),
          fullOcr(canvas),
        ])

        // Skip frames with no meaningful text
        if (ocrResult.text.length < MIN_TEXT_LENGTH) continue

        // ── Has text + not a duplicate → save frame ──
        kept++
        lastSavedThumb = thumb
        setJob(prev => prev ? { ...prev, message: `Found text at ${ts}s — saving frame ${kept}` } : null)

        const filename = `frame_${String(Math.round(ts)).padStart(6, '0')}.jpg`
        const base64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1]

        const res = await fetch('/api/analyze_frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            image_base64: base64, video_id: videoId, frame_timestamp: ts, filename,
            client_barcodes: clientBarcodes,
            client_tracking_codes: ocrResult.codes,
            client_label_text: ocrResult.text ? [ocrResult.text] : [],
            ocr_only: true,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { detail?: string }
          results.push({ timestamp: ts, status: 'error', error: err.detail ?? `HTTP ${res.status}` })
        } else {
          const data = await res.json() as { id: string; file_path?: string; ai_result: Record<string, unknown> }
          const ai = data.ai_result ?? {}
          results.push({
            timestamp: ts, status: 'ok', imageId: data.id,
            detectedText: (ai.label_text as string[] | undefined) ?? [],
            detectedBarcodes: (ai.barcodes as string[] | undefined) ?? [],
            detectedCodes: (ai.tracking_codes as string[] | undefined) ?? [],
          })
          if (!thumbnailUpdated && data.file_path) {
            thumbnailUpdated = true
            supabase.from('videos').update({ thumbnail_path: data.file_path }).eq('id', videoId).then(() => {})
          }
        }
      } catch (e) {
        results.push({ timestamp: ts, status: 'error', error: e instanceof Error ? e.message : 'unknown' })
      }

      setJob(prev => prev ? { ...prev, results: [...results] } : null)
    }

    const ok = results.filter(r => r.status === 'ok').length
    const wasCancelled = cancelRef.current
    cancelRef.current = false
    await supabase.from('videos').update({ status: ok > 0 ? 'ready' : wasCancelled ? 'pending' : 'failed' }).eq('id', videoId)
    setJob(prev => prev ? {
      ...prev, status: 'done',
      message: wasCancelled
        ? `Cancelled — ${ok} frames saved so far`
        : `Done! ${kept}/${candidates.length} frames kept → ${ok} analyzed`,
    } : null)
  }, [])

  const cancelJob = useCallback(() => { cancelRef.current = true }, [])
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
    <ProcessingContext.Provider value={{ job, queue, preferredModel, setPreferredModel, addToQueue, removeFromQueue, clearQueue, startProcessing, cancelJob, clearJob }}>
      {/* Hidden video element used for background queue processing */}
      <video ref={hiddenVideoRef} className="hidden" preload="metadata" crossOrigin="anonymous" />
      {children}
    </ProcessingContext.Provider>
  )
}
