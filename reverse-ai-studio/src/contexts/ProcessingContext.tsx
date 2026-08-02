import { createContext, useContext, useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import Tesseract from 'tesseract.js'
import { BrowserMultiFormatReader } from '@zxing/library'
import { supabase } from '@/services/api'

export interface FrameResult {
  timestamp: number
  status: 'ok' | 'error'
  imageId?: string
  error?: string
  aiResult?: Record<string, unknown>
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

interface ProcessingContextValue {
  job: ProcessingJob | null
  queue: QueuedVideo[]
  addToQueue: (videos: QueuedVideo[]) => void
  removeFromQueue: (videoId: string) => void
  clearQueue: () => void
  startProcessing: (videoId: string, videoName: string, videoEl: HTMLVideoElement) => Promise<void>
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
  const [queue, setQueue] = useState<QueuedVideo[]>(() => {
    try {
      const saved = localStorage.getItem(QUEUE_KEY)
      return saved ? (JSON.parse(saved) as QueuedVideo[]) : []
    } catch { return [] }
  })
  const processingRef = useRef(false)
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null)

  const getZxing = () => {
    if (!zxingRef.current) zxingRef.current = new BrowserMultiFormatReader()
    return zxingRef.current
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
        try {
          // Full-res canvas (capped at 1280px wide) for OCR + AI
          const w = Math.min(videoEl.videoWidth, 1280)
          const h = Math.round(w * (videoEl.videoHeight / videoEl.videoWidth))
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          canvas.getContext('2d')!.drawImage(videoEl, 0, 0, w, h)

          // Tiny thumbnail (64×36) for fast pixel-diff
          const thumb = document.createElement('canvas')
          thumb.width = 64; thumb.height = 36
          thumb.getContext('2d')!.drawImage(videoEl, 0, 0, 64, 36)

          resolve({ canvas, thumb })
        } catch (e) { reject(e) }
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

  // ── Step 3: quick OCR at 320px width — returns raw text length ──
  const quickOcr = async (canvas: HTMLCanvasElement): Promise<string> => {
    try {
      // Downsample to 320px for speed
      const small = document.createElement('canvas')
      small.width = 320
      small.height = Math.round(320 * (canvas.height / canvas.width))
      small.getContext('2d')!.drawImage(canvas, 0, 0, small.width, small.height)
      const { data } = await Tesseract.recognize(small, 'eng', { logger: () => {} })
      return data.text.trim()
    } catch { return '' }
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
      const { data } = await Tesseract.recognize(canvas, 'eng', { logger: () => {} })
      const text = data.text
      const codes = [...new Set(
        [...text.matchAll(/[A-Z0-9]{3,}[-]?[A-Z0-9]{6,}/g)]
          .map(m => m[0]).filter(c => c.length >= 8)
      )]
      return { text: text.trim(), codes }
    } catch { return { text: '', codes: [] } }
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

    // Sample every 2s starting at 3s offset
    const SAMPLE_INTERVAL = 2
    const OFFSET = 3
    const MOTION_THRESHOLD = 0.04   // 4% pixels changed → consider it motion
    const TEXT_MIN_LENGTH = 8       // min chars from quick OCR to proceed

    const duration = videoEl.duration
    const candidates: number[] = []
    for (let t = OFFSET; t < duration; t += SAMPLE_INTERVAL)
      candidates.push(parseFloat(t.toFixed(1)))
    if (candidates.length === 0) candidates.push(Math.min(OFFSET, duration - 1))

    const results: FrameResult[] = []
    let prevThumb: HTMLCanvasElement | null = null
    let kept = 0

    setJob({
      videoId, videoName,
      current: 0, total: candidates.length,
      results: [], status: 'running',
      message: 'Scanning frames...',
    })

    for (let i = 0; i < candidates.length; i++) {
      const ts = candidates[i]

      setJob(prev => prev ? {
        ...prev, current: i + 1,
        message: `Scanning ${i + 1}/${candidates.length} — ${kept} frames kept`,
      } : null)

      try {
        const { canvas, thumb } = await extractFrame(videoEl, ts)

        // ── Filter 1: motion detection ──
        if (prevThumb) {
          const diff = pixelDiff(prevThumb, thumb)
          if (diff < MOTION_THRESHOLD) continue   // static frame, skip
        }
        prevThumb = thumb

        // ── Filter 2: quick OCR text density ──
        const quickText = await quickOcr(canvas)
        if (quickText.length < TEXT_MIN_LENGTH) continue  // no useful text, skip

        // ── Passed both filters → full analysis ──
        kept++
        setJob(prev => prev ? { ...prev, message: `Analyzing frame at ${ts}s...` } : null)

        const filename = `frame_${String(Math.round(ts)).padStart(6, '0')}.jpg`
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]

        const [clientBarcodes, ocrResult] = await Promise.all([
          decodeBarcode(canvas),
          fullOcr(canvas),
        ])

        const res = await fetch('/api/analyze_frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            image_base64: base64, video_id: videoId, frame_timestamp: ts, filename,
            client_barcodes: clientBarcodes,
            client_tracking_codes: ocrResult.codes,
            client_label_text: ocrResult.text ? [ocrResult.text] : [],
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { detail?: string }
          results.push({ timestamp: ts, status: 'error', error: err.detail ?? `HTTP ${res.status}` })
        } else {
          const data = await res.json() as { id: string; ai_result: Record<string, unknown> }
          results.push({ timestamp: ts, status: 'ok', imageId: data.id, aiResult: data.ai_result })
        }
      } catch (e) {
        results.push({ timestamp: ts, status: 'error', error: e instanceof Error ? e.message : 'unknown' })
      }

      setJob(prev => prev ? { ...prev, results: [...results] } : null)
    }

    const ok = results.filter(r => r.status === 'ok').length
    await supabase.from('videos').update({ status: ok > 0 ? 'ready' : 'failed' }).eq('id', videoId)
    setJob(prev => prev ? {
      ...prev, status: 'done',
      message: `Done! ${kept}/${candidates.length} frames kept → ${ok} analyzed`,
    } : null)
  }, [])

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
    <ProcessingContext.Provider value={{ job, queue, addToQueue, removeFromQueue, clearQueue, startProcessing, clearJob }}>
      {/* Hidden video element used for background queue processing */}
      <video ref={hiddenVideoRef} className="hidden" preload="metadata" crossOrigin="anonymous" />
      {children}
    </ProcessingContext.Provider>
  )
}
