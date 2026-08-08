import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAutoTrain } from '@/hooks/useAutoTrain'
import { Tag, CheckCircle, XCircle, Filter, Loader2, RefreshCw, ZoomIn, X, Pencil, Save, Video, ChevronDown, Square, CheckSquare, ScanText, Server, Sparkles, PackageSearch, FileText, Box, ShieldAlert, ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { supabase } from '@/services/api'

interface DetectedObject {
  label: string
  confidence: number
  x?: number
  y?: number
  width?: number
  height?: number
  type?: string
  status?: string
  region?: string
}

interface ActiveParcelBbox {
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

interface AwbTextRegion {
  label: string
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

interface DetectedProduct {
  product_id: number
  product_class: string
  bbox: { x: number; y: number; width: number; height: number }
  confidence: number
  score_breakdown?: {
    emergence_from_parcel?: number
    hand_transfer?: number
    temporal_association?: number
    work_zone_placement?: number
    product_appearance?: number
  }
  visible_text?: string[]
  notes?: string
}

interface AIResult {
  objects?: DetectedObject[]
  tracking_codes?: string[]
  barcodes?: string[]
  label_text?: string[]
  confidence?: number
  notes?: string
  // Step 1 — Active parcel
  active_parcel_found?: boolean
  active_parcel_bbox?: ActiveParcelBbox | null
  active_parcel_signals?: {
    hand_interaction?: number
    motion?: number
    work_zone?: number
    parcel_label?: number
  } | null
  // Step 2 — AWB label
  awb_found?: boolean
  awb_bbox?: ActiveParcelBbox | null
  awb_text_regions?: AwbTextRegion[]
  awb_order_codes?: string[]
  awb_route_info?: string[]
  awb_raw_text?: string[]
  awb_ocr_confidence?: number
  // Step 3 — Product detection
  parcel_state?: string
  parcel_state_confidence?: number
  products?: DetectedProduct[]
  product_events?: string[]
  // WH Video Audit
  wh_errors?: Array<{
    error_code: string
    source: 'WAREHOUSE' | 'AI'
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
    description: string
    confidence: number
  }>
  evidence_checklist?: {
    active_parcel?: boolean
    awb?: boolean
    opening?: boolean
    product_visible?: boolean
    barcode?: boolean
    work_zone_clear?: boolean
  }
  quality_components?: {
    camera_quality?: number
    parcel_continuity?: number
    awb_visibility?: number
    product_visibility?: number
    identification_evidence?: number
  }
  video_evidence_score?: number
  case_status?: 'PASS' | 'PASS_WITH_WARNING' | 'WH_PROCESS_FAIL' | 'AI_UNCERTAIN' | 'HUMAN_REVIEW_REQUIRED' | 'SYSTEM_ERROR'
  event_audit?: Record<string, 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_REQUIRED'>
}

const LABEL_PALETTE = [
  '#60a5fa','#f59e0b','#34d399','#f97316','#a89bff',
  '#e879f9','#22d3ee','#86efac','#fbbf24','#fb7185',
]
const labelColorMap: Record<string, string> = {}
let _colorIdx = 0
function getLabelColor(label: string, type?: string) {
  if (type === 'text') return '#38bdf8'
  if (!labelColorMap[label]) {
    labelColorMap[label] = LABEL_PALETTE[_colorIdx % LABEL_PALETTE.length]
    _colorIdx++
  }
  return labelColorMap[label]
}


interface DatasetFrame {
  id: string
  video_id: string
  file_path: string
  image_name: string
  ai_result: AIResult | null
  split_type: string
  created_at: string
  review_status: 'pending' | 'approved' | 'rejected'
  annotation_id: string | null
}

interface VideoOption {
  id: string
  name: string
  frameCount: number
}

async function fetchVideosWithFrames(): Promise<VideoOption[]> {
  // Fetch all videos + count frames per video in parallel
  const [vidRes, imgRes] = await Promise.all([
    supabase.from('videos').select('id, name').order('created_at', { ascending: false }),
    supabase.from('dataset_images').select('video_id'),
  ])
  if (vidRes.error) throw new Error(vidRes.error.message)

  const countMap = new Map<string, number>()
  for (const row of imgRes.data ?? []) {
    if (!row.video_id) continue
    countMap.set(row.video_id, (countMap.get(row.video_id) ?? 0) + 1)
  }

  return (vidRes.data ?? []).map((v: any) => ({
    id: v.id,
    name: v.name,
    frameCount: countMap.get(v.id) ?? 0,
  }))
}

async function fetchFrames(filterStatus: string, videoId: string): Promise<DatasetFrame[]> {
  let query = supabase
    .from('dataset_images')
    .select('*, annotations(id, status)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (videoId !== 'all') query = query.eq('video_id', videoId)

  const { data: images, error } = await query
  if (error) throw new Error(error.message)

  return (images ?? []).map((row: any) => {
    const ann = row.annotations?.[0]
    return {
      id: row.id,
      video_id: row.video_id,
      file_path: row.file_path,
      image_name: row.image_name,
      ai_result: row.ai_result,
      split_type: row.split_type,
      created_at: row.created_at,
      review_status: ann?.status ?? 'pending',
      annotation_id: ann?.id ?? null,
    }
  }).filter((f: DatasetFrame) => filterStatus === 'all' || f.review_status === filterStatus)
}

async function reviewFrame(
  frameId: string,
  annotationId: string | null,
  status: 'approved' | 'rejected',
  reviewerId: string,
  aiResult: AIResult | null,
) {
  // When approving: mark all detected boxes as approved too
  if (status === 'approved' && aiResult?.objects?.length) {
    const updatedObjects = aiResult.objects.map(o => ({ ...o, status: 'approved' }))
    await supabase
      .from('dataset_images')
      .update({ ai_result: { ...aiResult, objects: updatedObjects }, annotation_status: 'approved' })
      .eq('id', frameId)
  }

  if (annotationId) {
    const { error } = await supabase
      .from('annotations')
      .update({ status, reviewer_id: reviewerId, reviewed_at: new Date().toISOString() })
      .eq('id', annotationId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('annotations').insert({
      dataset_image_id: frameId,
      status,
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
  }
}

async function reanalyzeFrame(frame: DatasetFrame, token: string): Promise<void> {
  const resp = await fetch('/api/analyze_frame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      image_base64: '',
      image_url: frame.file_path,
      video_id: frame.video_id,
      frame_timestamp: 0,
      filename: frame.image_name,
      client_barcodes: [],
      client_tracking_codes: [],
      client_label_text: [],
      text_only: true,
    }),
  })
  if (!resp.ok) throw new Error(`AI error ${resp.status}`)
}

function StatusBadge({ status }: { status: DatasetFrame['review_status'] }) {
  const cfg = {
    pending: 'bg-[#f59e0b20] text-[#fbbf24]',
    approved: 'bg-[#16a34a20] text-[#4ade80]',
    rejected: 'bg-[#dc262620] text-[#f87171]',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium capitalize', cfg[status])}>
      {status}
    </span>
  )
}


function Lightbox({ src, alt, objects, onClose }: {
  src: string; alt: string; objects?: DetectedObject[]; onClose: () => void
}) {
  const [showBoxes, setShowBoxes] = useState(true)
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-[#ffffff15] hover:bg-[#ffffff25] text-white transition-colors">
        <X className="w-5 h-5" />
      </button>
      {objects && objects.some(o => o.x != null) && (
        <button
          onClick={e => { e.stopPropagation(); setShowBoxes(v => !v) }}
          className="absolute bottom-6 right-6 px-3 py-1.5 rounded-lg bg-[#7c6af7] text-white text-xs font-medium"
        >
          {showBoxes ? 'Hide boxes' : 'Show boxes'}
        </button>
      )}
      <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
        <img src={src} alt={alt} className="max-w-full max-h-[85vh] object-contain rounded-[8px] block" />
        {showBoxes && objects && objects.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {objects.map((obj, i) => {
              if (obj.x == null || obj.y == null || obj.width == null || obj.height == null) return null
              const color = getLabelColor(obj.label, obj.type)
              const boxStatus = obj.status ?? 'pending'
              const strokeColor = boxStatus === 'approved' ? '#4ade80' : boxStatus === 'rejected' ? '#f87171' : color
              return (
                <g key={i}>
                  <rect x={`${obj.x}%`} y={`${obj.y}%`} width={`${obj.width}%`} height={`${obj.height}%`}
                    fill={`${strokeColor}18`} stroke={strokeColor} strokeWidth={2}
                    strokeDasharray={obj.type === 'text' ? '6 3' : undefined}
                    opacity={boxStatus === 'rejected' ? 0.5 : 1} />
                  <rect x={`${obj.x}%`} y={`${Math.max(obj.y - 4, 0)}%`}
                    width={`${Math.min(obj.label.length * 1.1 + 2, 22)}%`} height="4%" fill={strokeColor} />
                  <text x={`${obj.x + 0.6}%`} y={`${Math.max(obj.y - 0.5, 3.5)}%`}
                    fill="white" fontSize={10} fontFamily="monospace">
                    {obj.label} {Math.round((obj.confidence ?? 0) * 100)}%
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}

function FrameCard({ frame, reviewerId, onReviewed, selected, onSelect }: {
  frame: DatasetFrame
  reviewerId: string
  onReviewed: () => void
  selected: boolean
  onSelect: (id: string, checked: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { incrementCount } = useAutoTrain()
  const [localStatus, setLocalStatus] = useState(frame.review_status)
  const [lightbox, setLightbox] = useState(false)
  const [showBoxes, setShowBoxes] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editTracking, setEditTracking] = useState((frame.ai_result?.tracking_codes ?? []).join('\n'))
  const [editBarcodes, setEditBarcodes] = useState((frame.ai_result?.barcodes ?? []).join('\n'))
  const [editLabelText, setEditLabelText] = useState((frame.ai_result?.label_text ?? []).join('\n'))
  const [localAi, setLocalAi] = useState(frame.ai_result)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [serverOcrRunning, setServerOcrRunning] = useState(false)
  const [aiVisionRunning, setAiVisionRunning] = useState(false)
  const [activeBoxRunning, setActiveBoxRunning] = useState(false)
  const [awbRunning, setAwbRunning] = useState(false)
  const [productRunning, setProductRunning] = useState(false)
  const [auditRunning, setAuditRunning] = useState(false)

  const runOcr = useCallback(async () => {
    if (!frame.file_path || ocrRunning) return
    setOcrRunning(true)
    try {
      // Preprocess: load image → canvas → upscale if small → grayscale → adaptive threshold
      const preprocessed = await new Promise<string>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          // Upscale to at least 800px wide — Tesseract accuracy drops below ~600px
          const MIN_W = 800
          const scale = Math.max(1, MIN_W / img.naturalWidth)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.naturalWidth * scale)
          canvas.height = Math.round(img.naturalHeight * scale)
          const ctx = canvas.getContext('2d')!
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const d = imageData.data
          // Compute mean luminance for adaptive threshold
          let sum = 0
          for (let i = 0; i < d.length; i += 4) {
            sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
          }
          const thresh = Math.min(210, Math.max(80, sum / (d.length / 4) + 10))
          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
            const val = gray >= thresh ? 255 : 0
            d[i] = d[i + 1] = d[i + 2] = val
            d[i + 3] = 255
          }
          ctx.putImageData(imageData, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        }
        img.onerror = reject
        img.src = frame.file_path!
      })

      const Tesseract = (await import('tesseract.js')).default
      const result = await Tesseract.recognize(preprocessed, 'eng+vie', { logger: () => {} })
      const lines: any[] = (result.data as any).lines ?? []
      const lineTexts = lines
        .map((ln: any) => {
          const words = (ln.words ?? []).filter((w: any) => w.confidence >= 35 && w.text.trim().length >= 2)
          return words.map((w: any) => w.text.trim()).join(' ')
        })
        .filter(Boolean)
      if (lineTexts.length > 0) {
        setEditLabelText(prev => {
          const existing = prev.trim()
          return existing ? existing + '\n' + lineTexts.join('\n') : lineTexts.join('\n')
        })
      }
    } catch {
      // silent fail
    } finally {
      setOcrRunning(false)
    }
  }, [frame.file_path, ocrRunning])

  const runServerOcr = useCallback(async () => {
    if (!frame.file_path || serverOcrRunning) return
    setServerOcrRunning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const resp = await fetch('/api/v1/annotations/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image_url: frame.file_path, languages: ['vi', 'en'] }),
      })
      if (!resp.ok) throw new Error(`Server OCR error ${resp.status}`)
      const result: { lines: string[] } = await resp.json()
      if (result.lines.length > 0) {
        setEditLabelText(prev => {
          const existing = prev.trim()
          return existing ? existing + '\n' + result.lines.join('\n') : result.lines.join('\n')
        })
      }
    } catch {
      // silent fail
    } finally {
      setServerOcrRunning(false)
    }
  }, [frame.file_path, serverOcrRunning])

  const runAiVision = useCallback(async () => {
    if (!frame.file_path || aiVisionRunning) return
    setAiVisionRunning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const resp = await fetch('/api/analyze_frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          image_base64: '',
          image_url: frame.file_path,
          video_id: frame.video_id,
          frame_timestamp: 0,
          filename: frame.image_name,
          client_barcodes: [],
          client_tracking_codes: [],
          client_label_text: [],
          text_only: true,
          ocr_focus: true,
        }),
      })
      if (!resp.ok) throw new Error(`AI Vision error ${resp.status}`)
      const result: { ai_result?: { label_text?: string[]; tracking_codes?: string[] } } = await resp.json()
      const lines = result.ai_result?.label_text ?? []
      const codes = result.ai_result?.tracking_codes ?? []
      if (lines.length > 0) {
        setEditLabelText(prev => {
          const existing = prev.trim()
          return existing ? existing + '\n' + lines.join('\n') : lines.join('\n')
        })
      }
      if (codes.length > 0) {
        setEditTracking(prev => {
          const existing = prev.trim()
          return existing ? existing + '\n' + codes.join('\n') : codes.join('\n')
        })
      }
    } catch {
      // silent fail
    } finally {
      setAiVisionRunning(false)
    }
  }, [frame.file_path, frame.video_id, frame.image_name, aiVisionRunning])

  const runLabelActiveBox = useCallback(async () => {
    if (!frame.file_path || activeBoxRunning) return
    setActiveBoxRunning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const resp = await fetch('/api/analyze_frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          image_base64: '',
          image_url: frame.file_path,
          video_id: frame.video_id,
          frame_timestamp: 0,
          filename: frame.image_name,
          client_barcodes: [],
          client_tracking_codes: [],
          client_label_text: [],
          active_parcel_only: true,
        }),
      })
      if (!resp.ok) throw new Error(`Active box error ${resp.status}`)
      const result: { ai_result?: AIResult } = await resp.json()
      if (result.ai_result) {
        setLocalAi(prev => ({
          ...prev,
          active_parcel_found: result.ai_result!.active_parcel_found,
          active_parcel_bbox: result.ai_result!.active_parcel_bbox,
          active_parcel_signals: result.ai_result!.active_parcel_signals,
        }))
      }
    } catch {
      // silent fail
    } finally {
      setActiveBoxRunning(false)
    }
  }, [frame.file_path, frame.video_id, frame.image_name, activeBoxRunning])

  const runAwbDetect = useCallback(async () => {
    if (!frame.file_path || awbRunning) return
    setAwbRunning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const resp = await fetch('/api/analyze_frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          image_base64: '',
          image_url: frame.file_path,
          video_id: frame.video_id,
          frame_timestamp: 0,
          filename: frame.image_name,
          client_barcodes: [],
          client_tracking_codes: [],
          client_label_text: [],
          awb_detect: true,
        }),
      })
      if (!resp.ok) throw new Error(`AWB detect error ${resp.status}`)
      const result: { ai_result?: AIResult } = await resp.json()
      if (result.ai_result) {
        setLocalAi(prev => ({
          ...prev,
          awb_found: result.ai_result!.awb_found,
          awb_bbox: result.ai_result!.awb_bbox,
          awb_text_regions: result.ai_result!.awb_text_regions,
          awb_order_codes: result.ai_result!.awb_order_codes,
          awb_route_info: result.ai_result!.awb_route_info,
          awb_raw_text: result.ai_result!.awb_raw_text,
          awb_ocr_confidence: result.ai_result!.awb_ocr_confidence,
          tracking_codes: result.ai_result!.tracking_codes ?? prev?.tracking_codes,
          barcodes: result.ai_result!.barcodes ?? prev?.barcodes,
        }))
        // Sync editable fields if AWB found new codes
        if (result.ai_result!.tracking_codes?.length)
          setEditTracking(result.ai_result!.tracking_codes.join('\n'))
        if (result.ai_result!.barcodes?.length)
          setEditBarcodes(result.ai_result!.barcodes.join('\n'))
      }
    } catch {
      // silent fail
    } finally {
      setAwbRunning(false)
    }
  }, [frame.file_path, frame.video_id, frame.image_name, awbRunning])

  const runProductDetect = useCallback(async () => {
    if (!frame.file_path || productRunning) return
    setProductRunning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const resp = await fetch('/api/analyze_frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          image_base64: '',
          image_url: frame.file_path,
          video_id: frame.video_id,
          frame_timestamp: 0,
          filename: frame.image_name,
          client_barcodes: [],
          client_tracking_codes: [],
          client_label_text: [],
          product_detect: true,
        }),
      })
      if (!resp.ok) throw new Error(`Product detect error ${resp.status}`)
      const result: { ai_result?: AIResult } = await resp.json()
      if (result.ai_result) {
        setLocalAi(prev => ({
          ...prev,
          parcel_state: result.ai_result!.parcel_state,
          parcel_state_confidence: result.ai_result!.parcel_state_confidence,
          products: result.ai_result!.products,
          product_events: result.ai_result!.product_events,
        }))
      }
    } catch {
      // silent fail
    } finally {
      setProductRunning(false)
    }
  }, [frame.file_path, frame.video_id, frame.image_name, productRunning])

  const runVideoAudit = useCallback(async () => {
    if (!frame.file_path || auditRunning) return
    setAuditRunning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const resp = await fetch('/api/analyze_frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          image_base64: '',
          image_url: frame.file_path,
          video_id: frame.video_id,
          frame_timestamp: 0,
          filename: frame.image_name,
          client_barcodes: [],
          client_tracking_codes: [],
          client_label_text: [],
          video_audit: true,
        }),
      })
      if (!resp.ok) throw new Error(`Video audit error ${resp.status}`)
      const result: { ai_result?: AIResult } = await resp.json()
      if (result.ai_result) {
        setLocalAi(prev => ({
          ...prev,
          wh_errors: result.ai_result!.wh_errors,
          evidence_checklist: result.ai_result!.evidence_checklist,
          quality_components: result.ai_result!.quality_components,
          video_evidence_score: result.ai_result!.video_evidence_score,
          case_status: result.ai_result!.case_status,
        }))
      }
    } catch {
      // silent fail
    } finally {
      setAuditRunning(false)
    }
  }, [frame.file_path, frame.video_id, frame.image_name, auditRunning])

  // Sync when AI result updates after re-analyze refetch
  useEffect(() => {
    setLocalAi(frame.ai_result)
    setEditLabelText((frame.ai_result?.label_text ?? []).join('\n'))
  }, [frame.ai_result])
  const [reanalyzeErr, setReanalyzeErr] = useState<string | null>(null)

  const handleReanalyze = useCallback(async () => {
    if (reanalyzing || !frame.file_path) return
    setReanalyzing(true)
    setReanalyzeErr(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Chưa đăng nhập')
      await reanalyzeFrame(frame, session.access_token)
      queryClient.invalidateQueries({ queryKey: ['annotation-frames'] })
    } catch (e: any) {
      setReanalyzeErr(e.message ?? 'Lỗi')
    } finally {
      setReanalyzing(false)
    }
  }, [frame, reanalyzing, queryClient])

  const review = useMutation({
    mutationFn: (status: 'approved' | 'rejected') =>
      reviewFrame(frame.id, frame.annotation_id, status, reviewerId, localAi),
    onSuccess: (_, status) => {
      setLocalStatus(status)
      queryClient.invalidateQueries({ queryKey: ['annotation-frames'] })
      if (status === 'approved') incrementCount()
      onReviewed()
    },
  })

  const saveEdit = useMutation({
    mutationFn: async () => {
      const updated = {
        ...localAi,
        tracking_codes: editTracking.split('\n').map(s => s.trim()).filter(Boolean),
        barcodes: editBarcodes.split('\n').map(s => s.trim()).filter(Boolean),
        label_text: editLabelText.split('\n').map(s => s.trim()).filter(Boolean),
      }
      const { error } = await supabase.from('dataset_images').update({ ai_result: updated }).eq('id', frame.id)
      if (error) throw new Error(error.message)
      return updated
    },
    onSuccess: (updated) => {
      setLocalAi(updated as AIResult)
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['annotation-frames'] })
    },
  })

  const ai = localAi
  const trackingCodes = ai?.tracking_codes?.filter(Boolean) ?? []
  const barcodes = ai?.barcodes?.filter(Boolean) ?? []

  return (
    <>
      {lightbox && frame.file_path && (
        <Lightbox src={frame.file_path} alt={frame.image_name} objects={ai?.objects} onClose={() => setLightbox(false)} />
      )}
    <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] overflow-hidden hover:border-[#2a2a3a] transition-colors">
      {/* Frame image */}
      <div className="aspect-video bg-[#1a1a24] overflow-hidden relative group">
        {frame.file_path ? (
          <img
            src={frame.file_path} alt={frame.image_name}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setLightbox(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#55556a] text-xs">No preview</div>
        )}

        {/* Bounding box SVG overlay */}
        {showBoxes && ai?.objects && ai.objects.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {ai.objects.map((obj, i) => {
              if (obj.x == null || obj.y == null || obj.width == null || obj.height == null) return null
              const color = getLabelColor(obj.label, obj.type)
              const boxStatus = obj.status ?? 'pending'
              const strokeColor = boxStatus === 'approved' ? '#4ade80' : boxStatus === 'rejected' ? '#f87171' : color
              return (
                <g key={i}>
                  <rect
                    x={`${obj.x}%`} y={`${obj.y}%`}
                    width={`${obj.width}%`} height={`${obj.height}%`}
                    fill={`${strokeColor}18`}
                    stroke={strokeColor}
                    strokeWidth={1.5}
                    strokeDasharray={obj.type === 'text' ? '5 2' : undefined}
                    opacity={boxStatus === 'rejected' ? 0.5 : 1}
                  />
                  <rect
                    x={`${obj.x}%`} y={`${Math.max(obj.y - 5, 0)}%`}
                    width={`${Math.min(obj.label.length * 1.3 + 2, 25)}%`} height="5%"
                    fill={strokeColor}
                  />
                  <text
                    x={`${obj.x + 0.8}%`} y={`${Math.max(obj.y - 0.8, 4)}%`}
                    fill="white" fontSize={8} fontFamily="monospace"
                  >
                    {obj.label} {Math.round((obj.confidence ?? 0) * 100)}%
                  </text>
                </g>
              )
            })}
          </svg>
        )}

        {/* ACTIVE_PARCEL bbox — orange pulsing overlay */}
        {showBoxes && ai?.active_parcel_found && ai.active_parcel_bbox && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <rect
              x={`${ai.active_parcel_bbox.x}%`} y={`${ai.active_parcel_bbox.y}%`}
              width={`${ai.active_parcel_bbox.width}%`} height={`${ai.active_parcel_bbox.height}%`}
              fill="#f9731620" stroke="#f97316" strokeWidth={2.5}
            />
            <rect
              x={`${ai.active_parcel_bbox.x}%`} y={`${Math.max(ai.active_parcel_bbox.y - 6, 0)}%`}
              width="22%" height="6%"
              fill="#f97316"
            />
            <text
              x={`${ai.active_parcel_bbox.x + 0.8}%`} y={`${Math.max(ai.active_parcel_bbox.y - 0.8, 5)}%`}
              fill="white" fontSize={8} fontFamily="monospace" fontWeight="bold"
            >
              ACTIVE {Math.round((ai.active_parcel_bbox.confidence ?? 0) * 100)}%
            </text>
          </svg>
        )}

        {/* AWB bbox — yellow overlay */}
        {showBoxes && ai?.awb_found && ai.awb_bbox && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <rect
              x={`${ai.awb_bbox.x}%`} y={`${ai.awb_bbox.y}%`}
              width={`${ai.awb_bbox.width}%`} height={`${ai.awb_bbox.height}%`}
              fill="#eab30820" stroke="#eab308" strokeWidth={1.5} strokeDasharray="4 2"
            />
            <rect x={`${ai.awb_bbox.x}%`} y={`${Math.max(ai.awb_bbox.y - 5, 0)}%`} width="14%" height="5%" fill="#eab308" />
            <text x={`${ai.awb_bbox.x + 0.5}%`} y={`${Math.max(ai.awb_bbox.y - 0.5, 4)}%`} fill="white" fontSize={8} fontFamily="monospace" fontWeight="bold">AWB</text>
          </svg>
        )}

        {/* Products bboxes — cyan overlays */}
        {showBoxes && ai?.products && ai.products.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {ai.products.map(p => p.bbox && (
              <g key={p.product_id}>
                <rect
                  x={`${p.bbox.x}%`} y={`${p.bbox.y}%`}
                  width={`${p.bbox.width}%`} height={`${p.bbox.height}%`}
                  fill="#22d3ee18" stroke="#22d3ee" strokeWidth={1.5}
                />
                <rect x={`${p.bbox.x}%`} y={`${Math.max(p.bbox.y - 5, 0)}%`} width="18%" height="5%" fill="#22d3ee" />
                <text x={`${p.bbox.x + 0.5}%`} y={`${Math.max(p.bbox.y - 0.5, 4)}%`} fill="white" fontSize={8} fontFamily="monospace">
                  P{p.product_id} {Math.round(p.confidence * 100)}%
                </text>
              </g>
            ))}
          </svg>
        )}

        {/* Toggle boxes button */}
        {(ai?.objects?.some(o => o.x != null) || ai?.active_parcel_found || ai?.awb_found || (ai?.products?.length ?? 0) > 0) && (
          <button
            onClick={e => { e.stopPropagation(); setShowBoxes(v => !v) }}
            className={cn(
              'absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors',
              showBoxes ? 'bg-[#7c6af7] text-white' : 'bg-black/50 text-[#8888a8] hover:text-white'
            )}
          >
            {showBoxes ? 'Hide boxes' : 'Show boxes'}
          </button>
        )}

        {/* ACTIVE badge — top right when active parcel found (hidden when audit badge shows) */}
        {ai?.active_parcel_found && !ai.case_status && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-[#f97316] text-white text-[9px] font-bold flex items-center gap-0.5">
            <PackageSearch className="w-2.5 h-2.5" />
            ACTIVE
          </div>
        )}

        {/* Case status badge — top right (overrides ACTIVE badge) */}
        {ai?.case_status && (() => {
          const cfg = {
            PASS:                    { bg: '#16a34a', Icon: ShieldCheck,  label: 'PASS' },
            PASS_WITH_WARNING:       { bg: '#15803d', Icon: ShieldCheck,  label: 'PASS ⚠' },
            WH_PROCESS_FAIL:         { bg: '#dc2626', Icon: ShieldX,      label: 'WH FAIL' },
            AI_UNCERTAIN:            { bg: '#6b7280', Icon: ShieldAlert,  label: 'AI?' },
            HUMAN_REVIEW_REQUIRED:   { bg: '#d97706', Icon: AlertTriangle, label: 'REVIEW' },
            SYSTEM_ERROR:            { bg: '#7c3aed', Icon: ShieldAlert,  label: 'SYS ERR' },
          }[ai.case_status]
          if (!cfg) return null
          return (
            <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-white text-[9px] font-bold flex items-center gap-0.5`} style={{ backgroundColor: cfg.bg }}>
              <cfg.Icon className="w-2.5 h-2.5" />
              {cfg.label}
            </div>
          )
        })()}

        {/* CRITICAL error overlay stripe */}
        {ai?.wh_errors?.some(e => e.severity === 'CRITICAL') && (
          <div className="absolute bottom-0 left-0 right-0 bg-[#dc262680] flex items-center gap-1 px-2 py-0.5 pointer-events-none">
            <ShieldX className="w-2.5 h-2.5 text-[#fca5a5]" />
            <p className="text-[8px] text-[#fca5a5] font-bold truncate">
              {ai.wh_errors.filter(e => e.severity === 'CRITICAL').map(e => e.error_code).join(' · ')}
            </p>
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onSelect(frame.id, !selected) }}
          className={cn(
            'absolute top-2 left-2 w-5 h-5 rounded flex items-center justify-center transition-colors z-10',
            selected ? 'bg-[#7c6af7] text-white' : 'bg-black/50 text-[#8888a8] hover:text-white'
          )}
        >
          {selected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        <div className="absolute top-2 left-8">
          <StatusBadge status={localStatus} />
        </div>
      </div>

      {/* AI Results */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[#55556a] truncate">{frame.image_name}</p>
          <button
            onClick={() => setEditing(e => !e)}
            className="p-1 rounded hover:bg-[#ffffff10] text-[#55556a] hover:text-[#8888a8] transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>

        {editing ? (
          <div className="space-y-2">
            {/* ── Active Box Labeling Step ── */}
            <div className="border border-[#f9731630] rounded-[8px] p-2 bg-[#f9731608]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <PackageSearch className="w-3 h-3 text-[#f97316]" />
                  <p className="text-[9px] text-[#f97316] font-semibold">Active Box Label</p>
                </div>
                <button
                  onClick={runLabelActiveBox}
                  disabled={activeBoxRunning}
                  title="AI phát hiện hộp đang được xử lý (active parcel)"
                  className={cn('flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-medium transition-colors border',
                    activeBoxRunning
                      ? 'text-[#55556a] border-[#55556a30] cursor-wait'
                      : 'text-[#f97316] border-[#f9731650] hover:bg-[#f9731615]')}
                >
                  {activeBoxRunning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <PackageSearch className="w-2.5 h-2.5" />}
                  {activeBoxRunning ? 'Detecting...' : 'Detect Active Box'}
                </button>
              </div>
              {ai?.active_parcel_found && ai.active_parcel_bbox ? (
                <div className="space-y-1">
                  <p className="text-[9px] text-[#f97316]">
                    Detected — confidence {Math.round((ai.active_parcel_bbox.confidence ?? 0) * 100)}%
                  </p>
                  {ai.active_parcel_signals && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {(['hand_interaction','motion','work_zone','parcel_label'] as const).map(k => (
                        <div key={k} className="flex items-center gap-1">
                          <div className="flex-1 bg-[#1a1a24] rounded-full h-1 overflow-hidden">
                            <div
                              className="h-full bg-[#f97316] rounded-full"
                              style={{ width: `${Math.round((ai.active_parcel_signals![k] ?? 0) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[8px] text-[#55556a] w-12 truncate">{k.replace('_',' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[9px] text-[#55556a]">
                  {ai?.active_parcel_found === false ? 'No active parcel in frame' : 'Click to detect which box is being handled'}
                </p>
              )}
            </div>

            {/* ── Step 2: AWB / Label Detection ── */}
            <div className="border border-[#eab30830] rounded-[8px] p-2 bg-[#eab30808]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <FileText className="w-3 h-3 text-[#eab308]" />
                  <p className="text-[9px] text-[#eab308] font-semibold">AWB / Label Detection</p>
                </div>
                <button
                  onClick={runAwbDetect}
                  disabled={awbRunning}
                  title="AI phát hiện nhãn AWB/vận đơn → trích xuất tracking code, barcode, địa chỉ"
                  className={cn('flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-medium transition-colors border',
                    awbRunning
                      ? 'text-[#55556a] border-[#55556a30] cursor-wait'
                      : 'text-[#eab308] border-[#eab30850] hover:bg-[#eab30815]')}
                >
                  {awbRunning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <FileText className="w-2.5 h-2.5" />}
                  {awbRunning ? 'Detecting...' : 'Detect AWB'}
                </button>
              </div>
              {ai?.awb_found ? (
                <div className="space-y-1">
                  <p className="text-[9px] text-[#eab308]">
                    AWB found — OCR confidence {Math.round((ai.awb_ocr_confidence ?? 0) * 100)}%
                    {ai.awb_text_regions?.length ? ` · ${ai.awb_text_regions.length} text regions` : ''}
                  </p>
                  {ai.awb_order_codes?.length ? (
                    <p className="text-[8px] text-[#fde68a]">Orders: {ai.awb_order_codes.join(', ')}</p>
                  ) : null}
                  {ai.awb_route_info?.length ? (
                    <p className="text-[8px] text-[#fde68a]">Route: {ai.awb_route_info.join(' · ')}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[9px] text-[#55556a]">
                  {ai?.awb_found === false ? 'No AWB label visible in frame' : 'Click to detect AWB label on active parcel'}
                </p>
              )}
            </div>

            {/* ── Step 3: Product Detection ── */}
            <div className="border border-[#22d3ee30] rounded-[8px] p-2 bg-[#22d3ee08]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <Box className="w-3 h-3 text-[#22d3ee]" />
                  <p className="text-[9px] text-[#22d3ee] font-semibold">Product Detection</p>
                </div>
                <button
                  onClick={runProductDetect}
                  disabled={productRunning}
                  title="AI xác định trạng thái hộp + phát hiện sản phẩm được lấy ra"
                  className={cn('flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-medium transition-colors border',
                    productRunning
                      ? 'text-[#55556a] border-[#55556a30] cursor-wait'
                      : 'text-[#22d3ee] border-[#22d3ee50] hover:bg-[#22d3ee15]')}
                >
                  {productRunning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Box className="w-2.5 h-2.5" />}
                  {productRunning ? 'Detecting...' : 'Detect Products'}
                </button>
              </div>
              {ai?.parcel_state ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-[#22d3ee] bg-[#22d3ee18] px-1.5 py-0.5 rounded">{ai.parcel_state}</span>
                    <span className="text-[8px] text-[#55556a]">{Math.round((ai.parcel_state_confidence ?? 0) * 100)}%</span>
                  </div>
                  {(ai.products?.length ?? 0) > 0 && (
                    <p className="text-[9px] text-[#22d3ee]">{ai.products!.length} product(s) detected</p>
                  )}
                  {ai.product_events?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {ai.product_events.map(ev => (
                        <span key={ev} className="text-[8px] text-[#67e8f9] bg-[#22d3ee18] px-1 py-0.5 rounded">{ev}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-[9px] text-[#55556a]">Click to detect parcel state and products inside</p>
              )}
            </div>

            {/* ── WH Video Quality Audit ── */}
            <div className="border border-[#dc262630] rounded-[8px] p-2 bg-[#dc262608]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-[#f87171]" />
                  <p className="text-[9px] text-[#f87171] font-semibold">Video Quality Audit</p>
                </div>
                <button
                  onClick={runVideoAudit}
                  disabled={auditRunning}
                  title="Đánh giá chất lượng video bằng chứng — phát hiện lỗi kho, lỗi camera, thiếu bằng chứng"
                  className={cn('flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-medium transition-colors border',
                    auditRunning
                      ? 'text-[#55556a] border-[#55556a30] cursor-wait'
                      : 'text-[#f87171] border-[#f8717150] hover:bg-[#f8717115]')}
                >
                  {auditRunning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ShieldAlert className="w-2.5 h-2.5" />}
                  {auditRunning ? 'Auditing...' : 'Run Audit'}
                </button>
              </div>
              {ai?.case_status ? (
                <div className="space-y-1.5">
                  {/* Score bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#1a1a24] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${ai.video_evidence_score ?? 0}%`,
                          backgroundColor: (ai.video_evidence_score ?? 0) >= 70 ? '#4ade80' : (ai.video_evidence_score ?? 0) >= 40 ? '#fbbf24' : '#f87171',
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-[#f0f0f5] w-6 text-right">{ai.video_evidence_score ?? 0}</span>
                  </div>
                  {/* Evidence checklist */}
                  {ai.evidence_checklist && (
                    <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                      {Object.entries(ai.evidence_checklist).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-0.5">
                          {v
                            ? <ShieldCheck className="w-2.5 h-2.5 text-[#4ade80] flex-shrink-0" />
                            : <ShieldX className="w-2.5 h-2.5 text-[#f87171] flex-shrink-0" />}
                          <span className="text-[8px] text-[#55556a] truncate">{k.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* WH Errors */}
                  {(ai.wh_errors?.length ?? 0) > 0 && (
                    <div className="space-y-0.5 max-h-24 overflow-y-auto">
                      {ai.wh_errors!.map((err, i) => (
                        <div key={i} className="flex items-start gap-1">
                          <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded flex-shrink-0',
                            err.severity === 'CRITICAL' ? 'bg-[#dc262630] text-[#f87171]' :
                            err.severity === 'WARNING'  ? 'bg-[#d9770630] text-[#fbbf24]' :
                                                          'bg-[#6b728030] text-[#9ca3af]')}
                          >{err.severity}</span>
                          <span className="text-[8px] text-[#a0a0b8] break-words">{err.error_code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[9px] text-[#55556a]">
                  Audit video chất lượng bằng chứng — phân biệt lỗi kho vs lỗi AI
                </p>
              )}
            </div>

            <div>
              <p className="text-[9px] text-[#55556a] mb-1">Tracking Codes (mỗi dòng 1 mã)</p>
              <textarea
                value={editTracking}
                onChange={e => setEditTracking(e.target.value)}
                rows={2}
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] text-[#a89bff] text-[11px] font-mono rounded-[6px] px-2 py-1.5 outline-none focus:border-[#7c6af7] resize-none"
                placeholder="861850859724"
              />
            </div>
            <div>
              <p className="text-[9px] text-[#55556a] mb-1">Barcodes (mỗi dòng 1 mã)</p>
              <textarea
                value={editBarcodes}
                onChange={e => setEditBarcodes(e.target.value)}
                rows={2}
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] text-[#f0f0f5] text-[11px] font-mono rounded-[6px] px-2 py-1.5 outline-none focus:border-[#7c6af7] resize-none"
                placeholder="barcode value"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] text-[#55556a]">Detected Text (mỗi dòng 1 đoạn)</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={runOcr}
                    disabled={ocrRunning}
                    title="Tesseract OCR (local)"
                    className={cn('flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] transition-colors',
                      ocrRunning ? 'text-[#55556a] cursor-wait' : 'text-[#38bdf8] hover:bg-[#38bdf820]')}
                  >
                    {ocrRunning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ScanText className="w-2.5 h-2.5" />}
                    OCR
                  </button>
                  <button
                    onClick={runServerOcr}
                    disabled={serverOcrRunning}
                    title="EasyOCR (server-side, độ chính xác cao hơn)"
                    className={cn('flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] transition-colors',
                      serverOcrRunning ? 'text-[#55556a] cursor-wait' : 'text-[#34d399] hover:bg-[#34d39920]')}
                  >
                    {serverOcrRunning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Server className="w-2.5 h-2.5" />}
                    Server
                  </button>
                  <button
                    onClick={runAiVision}
                    disabled={aiVisionRunning}
                    title="AI Vision (OpenRouter model, đọc được ảnh mờ/xấu)"
                    className={cn('flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] transition-colors',
                      aiVisionRunning ? 'text-[#55556a] cursor-wait' : 'text-[#a89bff] hover:bg-[#a89bff20]')}
                  >
                    {aiVisionRunning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                    AI Vision
                  </button>
                </div>
              </div>
              <textarea
                value={editLabelText}
                onChange={e => setEditLabelText(e.target.value)}
                rows={3}
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] text-[#f0f0f5] text-[10px] font-mono rounded-[6px] px-2 py-1.5 outline-none focus:border-[#7c6af7] resize-none"
                placeholder="OCR text..."
              />
            </div>
            <button
              onClick={() => saveEdit.mutate()}
              disabled={saveEdit.isPending}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-xs rounded-[6px] transition-colors"
            >
              {saveEdit.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Lưu chỉnh sửa
            </button>
          </div>
        ) : (
          <>
            {/* Detected text from OCR */}
            {ai?.label_text && ai.label_text.length > 0 && (
              <div className="bg-[#1a1a24] rounded-[6px] p-2">
                <p className="text-[9px] text-[#55556a] mb-1.5">Detected Text</p>
                <p className="text-[10px] text-[#f0f0f5] font-mono leading-relaxed line-clamp-4 whitespace-pre-wrap break-words">
                  {ai.label_text.join(' ')}
                </p>
              </div>
            )}

            {trackingCodes.length > 0 && (
              <div className="bg-[#1a1a24] rounded-[6px] p-2">
                <p className="text-[9px] text-[#55556a] mb-1">Tracking Code</p>
                {trackingCodes.map((code, i) => (
                  <p key={i} className="text-[11px] text-[#a89bff] font-mono truncate">{code}</p>
                ))}
              </div>
            )}

            {barcodes.length > 0 && (
              <div className="bg-[#1a1a24] rounded-[6px] p-2">
                <p className="text-[9px] text-[#55556a] mb-1">Barcode</p>
                {barcodes.map((code, i) => (
                  <p key={i} className="text-[11px] text-[#f0f0f5] font-mono truncate">{code}</p>
                ))}
              </div>
            )}

            {/* Active parcel summary in view mode */}
            {ai?.active_parcel_found && ai.active_parcel_bbox && (
              <div className="bg-[#f9731610] border border-[#f9731630] rounded-[6px] p-2">
                <div className="flex items-center gap-1 mb-1">
                  <PackageSearch className="w-2.5 h-2.5 text-[#f97316]" />
                  <p className="text-[9px] text-[#f97316] font-semibold">Active Box Detected</p>
                  <span className="ml-auto text-[8px] text-[#f97316]">{Math.round((ai.active_parcel_bbox.confidence ?? 0) * 100)}%</span>
                </div>
                {ai.active_parcel_signals && (
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(ai.active_parcel_signals).map(([k, v]) => (
                      <span key={k} className="text-[8px] text-[#f9a87a] bg-[#f9731618] px-1 py-0.5 rounded">
                        {k.replace(/_/g,' ')}: {Math.round((v ?? 0) * 100)}%
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AWB summary */}
            {ai?.awb_found && (
              <div className="bg-[#eab30810] border border-[#eab30830] rounded-[6px] p-2">
                <div className="flex items-center gap-1 mb-1">
                  <FileText className="w-2.5 h-2.5 text-[#eab308]" />
                  <p className="text-[9px] text-[#eab308] font-semibold">AWB Detected</p>
                  {ai.awb_ocr_confidence != null && (
                    <span className="ml-auto text-[8px] text-[#eab308]">{Math.round(ai.awb_ocr_confidence * 100)}%</span>
                  )}
                </div>
                {ai.awb_order_codes?.length ? <p className="text-[8px] text-[#fde68a]">Orders: {ai.awb_order_codes.join(', ')}</p> : null}
                {ai.awb_route_info?.length ? <p className="text-[8px] text-[#fde68a]">Route: {ai.awb_route_info.join(' · ')}</p> : null}
              </div>
            )}

            {/* Product state summary */}
            {ai?.parcel_state && (
              <div className="bg-[#22d3ee10] border border-[#22d3ee30] rounded-[6px] p-2">
                <div className="flex items-center gap-1 mb-1">
                  <Box className="w-2.5 h-2.5 text-[#22d3ee]" />
                  <span className="text-[9px] font-mono text-[#22d3ee] bg-[#22d3ee18] px-1 rounded">{ai.parcel_state}</span>
                  {(ai.products?.length ?? 0) > 0 && (
                    <span className="ml-auto text-[8px] text-[#22d3ee]">{ai.products!.length} products</span>
                  )}
                </div>
                {ai.product_events?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {ai.product_events.map(ev => (
                      <span key={ev} className="text-[8px] text-[#67e8f9] bg-[#22d3ee18] px-1 py-0.5 rounded">{ev}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {/* Video audit summary */}
            {ai?.case_status && (
              <div className={cn('border rounded-[6px] p-2', {
                'border-[#16a34a30] bg-[#16a34a10]': ai.case_status === 'PASS' || ai.case_status === 'PASS_WITH_WARNING',
                'border-[#dc262630] bg-[#dc262610]': ai.case_status === 'WH_PROCESS_FAIL',
                'border-[#d9770630] bg-[#d9770610]': ai.case_status === 'HUMAN_REVIEW_REQUIRED',
                'border-[#6b728030] bg-[#6b728010]': ai.case_status === 'AI_UNCERTAIN',
                'border-[#7c3aed30] bg-[#7c3aed10]': ai.case_status === 'SYSTEM_ERROR',
              })}>
                <div className="flex items-center gap-1.5 mb-1">
                  {(ai.case_status === 'PASS' || ai.case_status === 'PASS_WITH_WARNING') && <ShieldCheck  className="w-3 h-3 text-[#4ade80]" />}
                  {ai.case_status === 'WH_PROCESS_FAIL'       && <ShieldX      className="w-3 h-3 text-[#f87171]" />}
                  {ai.case_status === 'HUMAN_REVIEW_REQUIRED' && <AlertTriangle className="w-3 h-3 text-[#fbbf24]" />}
                  {ai.case_status === 'AI_UNCERTAIN'          && <ShieldAlert  className="w-3 h-3 text-[#9ca3af]" />}
                  {ai.case_status === 'SYSTEM_ERROR'          && <ShieldAlert  className="w-3 h-3 text-[#c4b5fd]" />}
                  <span className={cn('text-[9px] font-bold', {
                    'text-[#4ade80]': ai.case_status === 'PASS' || ai.case_status === 'PASS_WITH_WARNING',
                    'text-[#f87171]': ai.case_status === 'WH_PROCESS_FAIL',
                    'text-[#fbbf24]': ai.case_status === 'HUMAN_REVIEW_REQUIRED',
                    'text-[#9ca3af]': ai.case_status === 'AI_UNCERTAIN',
                    'text-[#c4b5fd]': ai.case_status === 'SYSTEM_ERROR',
                  })}>{ai.case_status.replace(/_/g, ' ')}</span>
                  <span className="ml-auto text-[8px] text-[#55556a]">score: {ai.video_evidence_score ?? '—'}/100</span>
                </div>
                {(ai.wh_errors?.filter(e => e.severity === 'CRITICAL').length ?? 0) > 0 && (
                  <p className="text-[8px] text-[#f87171] mb-1">
                    {ai.wh_errors!.filter(e => e.severity === 'CRITICAL').map(e => e.error_code).join(', ')}
                  </p>
                )}
                {/* Event audit grid */}
                {ai.event_audit && Object.keys(ai.event_audit).length > 0 && (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1">
                    {Object.entries(ai.event_audit).map(([step, status]) => (
                      <div key={step} className="flex items-center gap-1">
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', {
                          'bg-[#4ade80]': status === 'PASS',
                          'bg-[#f87171]': status === 'FAIL',
                          'bg-[#fbbf24]': status === 'UNCERTAIN',
                          'bg-[#55556a]': status === 'NOT_REQUIRED',
                        })} />
                        <span className="text-[7px] text-[#9ca3af] truncate">{step.replace(/_/g, ' ')}</span>
                        <span className={cn('text-[7px] ml-auto font-bold', {
                          'text-[#4ade80]': status === 'PASS',
                          'text-[#f87171]': status === 'FAIL',
                          'text-[#fbbf24]': status === 'UNCERTAIN',
                          'text-[#55556a]': status === 'NOT_REQUIRED',
                        })}>{status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!ai && <p className="text-[10px] text-[#55556a] italic">No OCR result</p>}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={() => review.mutate('approved')}
            disabled={review.isPending}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-[6px] text-xs transition-colors',
              localStatus === 'approved'
                ? 'bg-[#16a34a] text-white'
                : 'bg-[#16a34a20] text-[#4ade80] hover:bg-[#16a34a40]'
            )}
          >
            {review.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Approve
          </button>
          <button
            onClick={() => review.mutate('rejected')}
            disabled={review.isPending}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-[6px] text-xs transition-colors',
              localStatus === 'rejected'
                ? 'bg-[#dc2626] text-white'
                : 'bg-[#dc262620] text-[#f87171] hover:bg-[#dc262640]'
            )}
          >
            {review.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
            Reject
          </button>
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            title={reanalyzeErr ?? 'Re-analyze bằng AI'}
            className={cn(
              'px-2 py-1.5 rounded-[6px] text-xs transition-colors border',
              reanalyzeErr
                ? 'bg-[#dc262620] text-[#f87171] border-[#dc262640]'
                : 'bg-[#7c6af720] text-[#a89bff] border-[#7c6af740] hover:bg-[#7c6af730]'
            )}
          >
            {reanalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
    </>
  )
}

export function AnnotationQueue() {
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterVideo, setFilterVideo] = useState<string>('all')
  const [videoDropdownOpen, setVideoDropdownOpen] = useState(false)
  const [reviewerId, setReviewerId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkReanalyzing, setBulkReanalyzing] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const queryClient = useQueryClient()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((frames: DatasetFrame[]) => {
    if (selectedIds.size === frames.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(frames.map(f => f.id)))
    }
  }, [selectedIds.size])

  const runBulkReanalyze = useCallback(async (targets: DatasetFrame[]) => {
    if (bulkReanalyzing || targets.length === 0) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setBulkReanalyzing(true)
    setBulkProgress({ done: 0, total: targets.length })
    for (let i = 0; i < targets.length; i++) {
      try { await reanalyzeFrame(targets[i], session.access_token) } catch {}
      setBulkProgress({ done: i + 1, total: targets.length })
      // Small delay to avoid rate limiting
      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 800))
    }
    setBulkReanalyzing(false)
    setBulkProgress(null)
    setSelectedIds(new Set())
    queryClient.invalidateQueries({ queryKey: ['annotation-frames'] })
  }, [bulkReanalyzing, queryClient])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setVideoDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Get current user id on mount
  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setReviewerId(data.user.id)
    })
  })

  const { data: videoOptions = [] } = useQuery({
    queryKey: ['annotation-videos'],
    queryFn: fetchVideosWithFrames,
  })

  const { data: frames = [], isLoading, refetch } = useQuery({
    queryKey: ['annotation-frames', filterStatus, filterVideo],
    queryFn: () => fetchFrames(filterStatus, filterVideo),
  })

  const selectedVideoName = filterVideo === 'all'
    ? 'All Videos'
    : (videoOptions.find(v => v.id === filterVideo)?.name ?? filterVideo)

  const pending = frames.filter(f => f.review_status === 'pending').length
  const approved = frames.filter(f => f.review_status === 'approved').length
  const rejected = frames.filter(f => f.review_status === 'rejected').length

  // Text detection stats
  const framesWithText = frames.filter(f => (f.ai_result?.label_text?.length ?? 0) > 0).length

  const displayFrames = frames

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[#7c6af720] flex items-center justify-center">
            <Tag className="w-5 h-5 text-[#a89bff]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#f0f0f5]">Annotation Queue</h1>
            <p className="text-xs text-[#8888a8]">
              {frames.length} frames · {pending} pending · {approved} approved · {rejected} rejected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-[8px] hover:bg-[#ffffff08] text-[#8888a8] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => runBulkReanalyze(frames)}
            disabled={bulkReanalyzing || frames.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[#7c6af720] text-[#a89bff] border border-[#7c6af740] text-xs font-medium hover:bg-[#7c6af730] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {bulkReanalyzing && bulkProgress
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {bulkProgress.done}/{bulkProgress.total}</>
              : <><RefreshCw className="w-3.5 h-3.5" /> Re-analyze All</>}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {frames.length > 0 && (
        <div className="flex gap-2">
          {[
            { label: 'Pending', count: pending, color: 'text-[#fbbf24]', bg: 'bg-[#f59e0b20]' },
            { label: 'Approved', count: approved, color: 'text-[#4ade80]', bg: 'bg-[#16a34a20]' },
            { label: 'Rejected', count: rejected, color: 'text-[#f87171]', bg: 'bg-[#dc262620]' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={cn('flex-1 rounded-[10px] p-3 text-center', bg)}>
              <p className={cn('text-lg font-bold', color)}>{count}</p>
              <p className="text-[10px] text-[#8888a8]">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Text detection stats */}
      {frames.length > 0 && framesWithText > 0 && (
        <div className="flex gap-2">
          <div className="rounded-[8px] p-2 text-center bg-[#7c6af710] border border-[#7c6af730] flex-1">
            <p className="text-sm font-bold text-[#a89bff]">{framesWithText}</p>
            <p className="text-[8px] text-[#55556a]">Frames có text</p>
          </div>
          <div className="rounded-[8px] p-2 text-center bg-[#1a1a24] border border-[#1e1e2a] flex-1">
            <p className="text-sm font-bold text-[#8888a8]">{frames.length - framesWithText}</p>
            <p className="text-[8px] text-[#55556a]">Không có text</p>
          </div>
        </div>
      )}

      {/* Filters */}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-[#8888a8]" />
          {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors capitalize',
                filterStatus === s
                  ? 'bg-[#7c6af7] text-white'
                  : 'bg-[#1a1a24] text-[#8888a8] hover:text-[#f0f0f5]'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Video filter */}
        <div className="relative ml-auto" ref={dropdownRef}>
          <button
            onClick={() => setVideoDropdownOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[#1a1a24] border border-[#2a2a3a] text-xs text-[#f0f0f5] hover:border-[#7c6af740] transition-colors max-w-[200px]"
          >
            <Video className="w-3.5 h-3.5 text-[#8888a8] flex-shrink-0" />
            <span className="truncate">{selectedVideoName}</span>
            <ChevronDown className={cn('w-3 h-3 text-[#55556a] flex-shrink-0 transition-transform', videoDropdownOpen && 'rotate-180')} />
          </button>
          {videoDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-[#0d0d14] border border-[#1e1e2a] rounded-[10px] shadow-2xl z-20 overflow-hidden">
              <div className="max-h-60 overflow-y-auto py-1">
                <button
                  onClick={() => { setFilterVideo('all'); setVideoDropdownOpen(false) }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[#ffffff06] transition-colors',
                    filterVideo === 'all' ? 'text-[#a89bff]' : 'text-[#8888a8]'
                  )}
                >
                  <span>All Videos</span>
                  <span className="text-[10px] text-[#55556a]">{videoOptions.reduce((a, v) => a + v.frameCount, 0)} frames</span>
                </button>
                {videoOptions.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { setFilterVideo(v.id); setVideoDropdownOpen(false) }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[#ffffff06] transition-colors',
                      filterVideo === v.id ? 'text-[#a89bff]' : 'text-[#f0f0f5]'
                    )}
                  >
                    <span className="truncate text-left max-w-[160px]">{v.name}</span>
                    <span className="text-[10px] text-[#55556a] flex-shrink-0 ml-2">{v.frameCount} frames</span>
                  </button>
                ))}
                {videoOptions.length === 0 && (
                  <p className="px-3 py-4 text-[10px] text-[#55556a] text-center">Chưa có video nào</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {frames.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSelectAll(displayFrames)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-[#1a1a24] text-[#8888a8] hover:text-[#f0f0f5] text-xs transition-colors"
          >
            {selectedIds.size === frames.length
              ? <><CheckSquare className="w-3.5 h-3.5 text-[#a89bff]" /> Deselect All</>
              : <><Square className="w-3.5 h-3.5" /> Select All</>}
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={() => runBulkReanalyze(frames.filter(f => selectedIds.has(f.id)))}
              disabled={bulkReanalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#7c6af720] text-[#a89bff] border border-[#7c6af740] text-xs font-medium hover:bg-[#7c6af730] disabled:opacity-40 transition-colors"
            >
              {bulkReanalyzing
                ? <><Loader2 className="w-3 h-3 animate-spin" /> {bulkProgress?.done}/{bulkProgress?.total}</>
                : <><RefreshCw className="w-3 h-3" /> Re-analyze {selectedIds.size} ảnh</>}
            </button>
          )}
          {selectedIds.size > 0 && (
            <span className="text-xs text-[#55556a]">Đã chọn {selectedIds.size}/{frames.length}</span>
          )}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#7c6af7] animate-spin" />
        </div>
      ) : displayFrames.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-[#55556a] text-sm">
            {filterStatus === 'all' && filterVideo === 'all'
              ? 'Chưa có frames nào — chạy AI Processing trên video trước'
              : filterVideo !== 'all'
              ? `Không có frame nào ${filterStatus !== 'all' ? `ở trạng thái "${filterStatus}"` : ''} cho video này`
              : `Không có frame nào ở trạng thái "${filterStatus}"`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayFrames.map(frame => (
            <FrameCard
              key={frame.id}
              frame={frame}
              reviewerId={reviewerId}
              onReviewed={() => {}}
              selected={selectedIds.has(frame.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
