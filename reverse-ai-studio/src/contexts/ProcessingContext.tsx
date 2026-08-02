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
  const [job, setJob] = useState<ProcessingJob | null>(null)
  const [queue, setQueue] = useState<QueuedVideo[]>([])
  const processingRef = useRef(false)
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null)

  const getZxing = () => {
    if (!zxingRef.current) zxingRef.current = new BrowserMultiFormatReader()
    return zxingRef.current
  }

  const decodeBarcode = async (canvas: HTMLCanvasElement): Promise<string[]> => {
    try {
      const img = document.createElement('img')
      await new Promise<void>((res) => { img.onload = () => res(); img.src = canvas.toDataURL() })
      const result = await getZxing().decodeFromImageElement(img)
      return result ? [result.getText()] : []
    } catch { return [] }
  }

  const ocrCanvas = async (canvas: HTMLCanvasElement): Promise<{ text: string; codes: string[] }> => {
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

  const extractFrame = (videoEl: HTMLVideoElement, ts: number): Promise<{ base64: string; canvas: HTMLCanvasElement }> =>
    new Promise((resolve, reject) => {
      videoEl.currentTime = ts
      const onSeeked = () => {
        videoEl.removeEventListener('seeked', onSeeked)
        try {
          const canvas = document.createElement('canvas')
          canvas.width = Math.min(videoEl.videoWidth, 1280)
          canvas.height = Math.round(canvas.width * (videoEl.videoHeight / videoEl.videoWidth))
          canvas.getContext('2d')!.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
          resolve({ base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], canvas })
        } catch (e) { reject(e) }
      }
      videoEl.addEventListener('seeked', onSeeked)
    })

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

    const INTERVAL = 10
    const OFFSET = 8
    const duration = videoEl.duration
    const timestamps: number[] = []
    for (let t = OFFSET; t < duration; t += INTERVAL) timestamps.push(parseFloat(t.toFixed(1)))
    if (timestamps.length === 0) timestamps.push(Math.min(OFFSET, duration - 1))

    const results: FrameResult[] = []
    setJob({ videoId, videoName, current: 0, total: timestamps.length, results: [], status: 'running', message: '' })

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i]
      const filename = `frame_${String(Math.round(ts)).padStart(6, '0')}.jpg`
      try {
        const { base64, canvas } = await extractFrame(videoEl, ts)
        const [clientBarcodes, ocrResult] = await Promise.all([
          decodeBarcode(canvas),
          ocrCanvas(canvas),
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

      setJob(prev => prev ? { ...prev, current: i + 1, results: [...results] } : null)
    }

    const ok = results.filter(r => r.status === 'ok').length
    await supabase.from('videos').update({ status: ok > 0 ? 'ready' : 'failed' }).eq('id', videoId)
    setJob(prev => prev ? {
      ...prev, status: 'done',
      message: `Hoàn tất! ${ok}/${timestamps.length} frames thành công`,
    } : null)
  }, [])

  const clearJob = useCallback(() => setJob(null), [])

  const addToQueue = useCallback((videos: QueuedVideo[]) => {
    setQueue(prev => {
      const existingIds = new Set(prev.map(v => v.id))
      return [...prev, ...videos.filter(v => !existingIds.has(v.id))]
    })
  }, [])

  const removeFromQueue = useCallback((videoId: string) => {
    setQueue(prev => prev.filter(v => v.id !== videoId))
  }, [])

  const clearQueue = useCallback(() => setQueue([]), [])

  // Auto-process queue: when job is idle and queue has items, pick next and run
  useEffect(() => {
    if (processingRef.current) return
    if (queue.length === 0) return
    if (job && job.status === 'running') return

    const next = queue[0]
    if (!next.filePath) return

    processingRef.current = true
    setQueue(prev => prev.slice(1))

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
