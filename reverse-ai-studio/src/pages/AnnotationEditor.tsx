import { useState, useRef, useCallback, useEffect, forwardRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Square, Type, ZoomIn, ZoomOut, Move, RotateCcw, Sun, Contrast,
  Grid3X3, Undo2, Save, Check, X, Trash2, Loader2, AlertCircle, Crop, RefreshCw,
  ScanText,
} from 'lucide-react'
import { createWorker } from 'tesseract.js'
import { cn } from '@/utils/cn'
import { supabase } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type BoxStatus = 'pending' | 'approved' | 'rejected'
type BoxType   = 'object' | 'text'

interface AnnotationBox {
  id: string
  label: string
  x: number       // % 0–100
  y: number
  width: number
  height: number
  confidence: number
  type: BoxType
  status: BoxStatus
  source: 'ai' | 'manual'
  color: string
}

interface DrawingState {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface CropRect {
  x: number; y: number; width: number; height: number
}

// (image fetching done server-side to avoid browser CORS)

interface DatasetImageRow {
  id: string
  video_id: string
  file_path: string
  image_name: string
  frame_timestamp: number
  ai_result: {
    objects?: RawObject[]
    tracking_codes?: string[]
    barcodes?: string[]
    packaging_status?: string
    package_count?: number
    label_text?: string[]
    notes?: string
    productCorrect?: boolean | null
    filmWrapped?: boolean | null
    awbAttached?: boolean | null
    barcodeReadable?: boolean | null
  }
  annotation_status?: string
}

interface RawObject {
  label: string
  confidence: number
  x: number
  y: number
  width: number
  height: number
  type?: string
  status?: string
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const PALETTE = [
  '#60a5fa','#f59e0b','#34d399','#f97316','#a89bff',
  '#e879f9','#22d3ee','#86efac','#fbbf24','#fb7185',
]
const TEXT_COLOR = '#38bdf8'
const labelColors: Record<string, string> = {}
let colorIdx = 0

function colorFor(label: string, type: BoxType): string {
  if (type === 'text') return TEXT_COLOR
  if (!labelColors[label]) {
    labelColors[label] = PALETTE[colorIdx % PALETTE.length]
    colorIdx++
  }
  return labelColors[label]
}

const STATUS_STYLE: Record<BoxStatus, { border: string; bg: string; badge: string }> = {
  pending:  { border: '#7c6af7', bg: '#7c6af710', badge: 'bg-[#7c6af720] text-[#a89bff]' },
  approved: { border: '#4ade80', bg: '#4ade8010', badge: 'bg-[#4ade8020] text-[#4ade80]' },
  rejected: { border: '#f87171', bg: '#f8717110', badge: 'bg-[#f8717120] text-[#f87171]' },
}

const OBJECT_LABELS = [
  // QC packaging objects
  'product_item','stretch_film','bubble_wrap','awb_label','sku_label','package_surface',
  // General warehouse
  'cardboard_box','shipping_label','barcode_1d','qr_code','tape_roll',
  'barcode_scanner','label_printer','knife_cutter','keyboard','mouse','plastic_bag',
  'envelope','blue_bin','orange_box','label_roll','hand',
]
const TEXT_LABELS = ['tracking_code','barcode_text','label_text','ocr_region','date_text']

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchDatasetImage(id: string): Promise<DatasetImageRow> {
  const { data, error } = await supabase
    .from('dataset_images')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data as DatasetImageRow
}

async function saveAnnotations(id: string, boxes: AnnotationBox[], allApproved: boolean) {
  const objects = boxes.map(b => ({
    label: b.label,
    confidence: b.confidence,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    type: b.type,
    status: b.status,
    source: b.source,
  }))
  const { error } = await supabase
    .from('dataset_images')
    .update({
      ai_result: { objects },
      annotation_status: allApproved ? 'approved' : 'partial',
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnnotationEditor() {
  const { frameId } = useParams<{ frameId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: row, isLoading, error } = useQuery({
    queryKey: ['dataset-image', frameId],
    queryFn: () => fetchDatasetImage(frameId!),
    enabled: !!frameId,
  })

  const saveMut = useMutation({
    mutationFn: ({ boxes, allApproved }: { boxes: AnnotationBox[]; allApproved: boolean }) =>
      saveAnnotations(frameId!, boxes, allApproved),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dataset-image', frameId] }),
  })

  // ── Canvas ──────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null)
  const [activeTool, setActiveTool] = useState<string>('select')
  const [showGrid, setShowGrid]     = useState(false)

  // ── Boxes ───────────────────────────────────────────────────────────────────
  const [boxes, setBoxes]         = useState<AnnotationBox[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<AnnotationBox[][]>([[]])
  const initialized = useRef(false)

  // Seed boxes from AI result once data loads
  useEffect(() => {
    if (!row || initialized.current) return
    initialized.current = true
    const aiObjects: AnnotationBox[] = (row.ai_result?.objects ?? []).map((o, i) => ({
      id: `ai-${i}-${o.label}`,
      label: o.label,
      x: o.x ?? 5,
      y: o.y ?? 5,
      width: o.width ?? 20,
      height: o.height ?? 20,
      confidence: o.confidence ?? 0.8,
      type: (o.type as BoxType) ?? 'object',
      status: (o.status as BoxStatus) ?? 'pending',
      source: 'ai',
      color: colorFor(o.label, (o.type as BoxType) ?? 'object'),
    }))
    setBoxes(aiObjects)
    setUndoStack([aiObjects])
  }, [row])

  // ── Drawing ─────────────────────────────────────────────────────────────────
  const [drawing, setDrawing]   = useState<DrawingState | null>(null)
  const [pending, setPending]   = useState<Omit<AnnotationBox,'label'|'color'> | null>(null)
  const [pickerLabel, setPickerLabel] = useState(OBJECT_LABELS[0])
  const [customLabel, setCustomLabel] = useState('')

  // ── Crop + Re-analyze ────────────────────────────────────────────────────────
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [textOnly, setTextOnly] = useState(false)
  const [extractedText, setExtractedText] = useState<string[]>([])
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null)
  const [ocrRunning, setOcrRunning] = useState(false)
  const ocrWorkerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null)

  const toPercent = useCallback((cx: number, cy: number) => {
    const el = canvasRef.current
    if (!el) return { px: 0, py: 0 }
    const rect = el.getBoundingClientRect()
    return {
      px: Math.min(Math.max(((cx - rect.left) / rect.width) * 100, 0), 100),
      py: Math.min(Math.max(((cy - rect.top) / rect.height) * 100, 0), 100),
    }
  }, [])

  const pushUndo = useCallback((next: AnnotationBox[]) => {
    setUndoStack(s => [...s.slice(-20), next])
    setBoxes(next)
  }, [])

  // ── OCR: load ảnh → Tesseract word-level → tạo bounding box ─────────────────
  const runOcr = useCallback(async () => {
    if (!row?.file_path || ocrRunning) return
    setOcrRunning(true)
    setReanalyzeError(null)
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('Không load được ảnh (CORS)'))
        img.src = row.file_path
      })

      // Upscale small images before OCR — Tesseract accuracy drops below ~600px wide
      const MIN_W = 800
      const scale = Math.max(1, MIN_W / img.naturalWidth)
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * scale)
      c.height = Math.round(img.naturalHeight * scale)
      const cCtx = c.getContext('2d')!
      cCtx.imageSmoothingEnabled = true
      cCtx.imageSmoothingQuality = 'high'
      cCtx.drawImage(img, 0, 0, c.width, c.height)

      // Adaptive grayscale threshold to improve contrast for dark/light backgrounds
      const imgData = cCtx.getImageData(0, 0, c.width, c.height)
      const pd = imgData.data
      let lumSum = 0
      for (let i = 0; i < pd.length; i += 4) lumSum += 0.299 * pd[i] + 0.587 * pd[i + 1] + 0.114 * pd[i + 2]
      const adaptThresh = Math.min(220, Math.max(80, lumSum / (pd.length / 4) + 10))
      for (let i = 0; i < pd.length; i += 4) {
        const g = 0.299 * pd[i] + 0.587 * pd[i + 1] + 0.114 * pd[i + 2]
        const v = g >= adaptThresh ? 255 : 0
        pd[i] = pd[i + 1] = pd[i + 2] = v; pd[i + 3] = 255
      }
      cCtx.putImageData(imgData, 0, 0)

      if (!ocrWorkerRef.current) {
        ocrWorkerRef.current = await createWorker('eng+vie', 1, { logger: () => {} })
      }
      const { data } = await ocrWorkerRef.current.recognize(c)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lines: any[] = (data as any).lines ?? []

      const newBoxes: AnnotationBox[] = []
      for (const line of lines) {
        const lineWords: any[] = (line.words ?? []).filter(
          (w: any) => (w.confidence ?? 0) >= 35 && (w.text ?? '').trim().length >= 2
        )
        if (lineWords.length === 0) continue
        // Use line bbox to group words — one box per line of text
        const { bbox } = line
        const lineText = lineWords.map((w: any) => w.text.trim()).join(' ')
        const avgConf = lineWords.reduce((s: number, w: any) => s + w.confidence, 0) / lineWords.length
        newBoxes.push({
          id: `ocr-${Date.now()}-${newBoxes.length}`,
          label: `ocr: ${lineText}`,
          x: (bbox.x0 / scale / img.naturalWidth) * 100,
          y: (bbox.y0 / scale / img.naturalHeight) * 100,
          width: ((bbox.x1 - bbox.x0) / scale / img.naturalWidth) * 100,
          height: ((bbox.y1 - bbox.y0) / scale / img.naturalHeight) * 100,
          confidence: avgConf / 100,
          type: 'text',
          status: 'pending',
          source: 'ai',
          color: '#38bdf8',
        })
      }

      if (newBoxes.length === 0) {
        setReanalyzeError('OCR không tìm thấy text nào trong ảnh')
        return
      }

      const existing = boxes.filter(b => !b.id.startsWith('ocr-'))
      pushUndo([...existing, ...newBoxes])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allWords: any[] = lines.flatMap((ln: any) => ln.words ?? [])
      setExtractedText(allWords.filter((w: any) => w.confidence >= 35).map((w: any) => w.text.trim()))
    } catch (e) {
      setReanalyzeError(e instanceof Error ? e.message : 'OCR thất bại')
    } finally {
      setOcrRunning(false)
    }
  }, [row, ocrRunning, boxes, pushUndo])

  useEffect(() => {
    return () => { ocrWorkerRef.current?.terminate() }
  }, [])

  // ── Re-analyze ───────────────────────────────────────────────────────────────
  const reanalyze = useCallback(async () => {
    if (!row?.file_path || reanalyzing) return
    setReanalyzing(true)
    setReanalyzeError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Chưa đăng nhập')

      // Backend fetches image from URL directly — avoids browser CORS
      const resp = await fetch('/api/analyze_frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          image_base64: '',
          image_url: row.file_path,
          crop: cropRect ?? undefined,
          video_id: row.video_id,
          frame_timestamp: row.frame_timestamp,
          filename: row.image_name,
          client_barcodes: [],
          client_tracking_codes: [],
          client_label_text: [],
          preferred_model: '',
          text_only: textOnly,
        }),
      })
      const data = await resp.json() as { ai_result?: { objects?: RawObject[]; label_text?: string[] }; detail?: string }
      if (!resp.ok) throw new Error(data.detail ?? `HTTP ${resp.status}`)

      // Store extracted text for display
      if (data.ai_result?.label_text?.length) {
        setExtractedText(data.ai_result.label_text)
      }

      // Convert new AI objects to boxes, merge with existing manual boxes
      const newAiBoxes: AnnotationBox[] = (data.ai_result?.objects ?? []).map((o, i) => ({
        id: `ai-rerun-${Date.now()}-${i}`,
        label: o.label,
        x: o.x ?? 5, y: o.y ?? 5, width: o.width ?? 20, height: o.height ?? 20,
        confidence: o.confidence ?? 0.8,
        type: (o.type as BoxType) ?? 'object',
        status: 'pending' as BoxStatus,
        source: 'ai' as const,
        color: colorFor(o.label, (o.type as BoxType) ?? 'object'),
      }))

      // Keep manual boxes, replace AI ones
      const manualBoxes = boxes.filter(b => b.source === 'manual')
      const next = [...manualBoxes, ...newAiBoxes]
      pushUndo(next)
      setCropRect(null)
      setActiveTool('select')
      qc.invalidateQueries({ queryKey: ['dataset-image', frameId] })
    } catch (e) {
      setReanalyzeError(e instanceof Error ? e.message : 'Lỗi không xác định')
    } finally {
      setReanalyzing(false)
    }
  }, [row, cropRect, reanalyzing, boxes, pushUndo, frameId, qc])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (activeTool !== 'bbox' && activeTool !== 'text' && activeTool !== 'crop') return
    if (e.button !== 0) return
    e.preventDefault()
    const { px, py } = toPercent(e.clientX, e.clientY)
    setDrawing({ startX: px, startY: py, currentX: px, currentY: py })
    setSelectedId(null)
    setPending(null)
  }, [activeTool, toPercent])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return
    const { px, py } = toPercent(e.clientX, e.clientY)
    setDrawing(d => d ? { ...d, currentX: px, currentY: py } : null)
  }, [drawing, toPercent])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (!drawing) return
    const { px, py } = toPercent(e.clientX, e.clientY)
    const x = Math.min(drawing.startX, px)
    const y = Math.min(drawing.startY, py)
    const w = Math.abs(px - drawing.startX)
    const h = Math.abs(py - drawing.startY)
    setDrawing(null)
    if (w < 1 || h < 1) return

    // Crop mode — just set crop rect, don't open label picker
    if (activeTool === 'crop') {
      setCropRect({ x, y, width: w, height: h })
      return
    }

    const type: BoxType = activeTool === 'text' ? 'text' : 'object'
    setPickerLabel(type === 'text' ? TEXT_LABELS[0] : OBJECT_LABELS[0])
    setCustomLabel('')
    setPending({
      id: crypto.randomUUID(),
      x, y, width: w, height: h,
      confidence: 1.0,
      type,
      status: 'approved',
      source: 'manual',
    })
  }, [drawing, toPercent, activeTool])

  const confirmBox = useCallback(() => {
    if (!pending) return
    const label = customLabel.trim() || pickerLabel
    if (!label) return
    const newBox: AnnotationBox = { ...pending, label, color: colorFor(label, pending.type) }
    const next = [...boxes, newBox]
    pushUndo(next)
    setSelectedId(newBox.id)
    setPending(null)
  }, [pending, pickerLabel, customLabel, boxes, pushUndo])

  // ── Status actions ──────────────────────────────────────────────────────────

  const setBoxStatus = useCallback((id: string, status: BoxStatus) => {
    const next = boxes.map(b => b.id === id ? { ...b, status } : b)
    pushUndo(next)
  }, [boxes, pushUndo])

  const approveAll = useCallback(() => {
    const next = boxes.map(b => ({ ...b, status: 'approved' as BoxStatus }))
    pushUndo(next)
  }, [boxes, pushUndo])

  const rejectAll = useCallback(() => {
    const next = boxes.map(b => ({ ...b, status: 'rejected' as BoxStatus }))
    pushUndo(next)
  }, [boxes, pushUndo])

  const deleteBox = useCallback((id: string) => {
    const next = boxes.filter(b => b.id !== id)
    pushUndo(next)
    if (selectedId === id) setSelectedId(null)
  }, [boxes, pushUndo, selectedId])

  const undo = useCallback(() => {
    setUndoStack(s => {
      if (s.length <= 1) return s
      const prev = s[s.length - 2]
      setBoxes(prev)
      setSelectedId(null)
      return s.slice(0, -1)
    })
  }, [])

  // ── Keyboard ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) deleteBox(selectedId)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo()
      if (e.key === 'b') setActiveTool('bbox')
      if (e.key === 't') setActiveTool('text')
      if (e.key === 's') setActiveTool('select')
      if (e.key === 'c') setActiveTool('crop')
      if (e.key === 'Escape') { setPending(null); setSelectedId(null) }
      if (selectedId) {
        if (e.key === 'a') setBoxStatus(selectedId, 'approved')
        if (e.key === 'r') setBoxStatus(selectedId, 'rejected')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId, deleteBox, undo, setBoxStatus])

  const selectedBox = boxes.find(b => b.id === selectedId) ?? null

  const previewRect = drawing ? {
    x: Math.min(drawing.startX, drawing.currentX),
    y: Math.min(drawing.startY, drawing.currentY),
    w: Math.abs(drawing.currentX - drawing.startX),
    h: Math.abs(drawing.currentY - drawing.startY),
  } : null

  const cursor = activeTool === 'bbox' || activeTool === 'text' || activeTool === 'crop' ? 'crosshair'
    : activeTool === 'pan' ? 'grab' : 'default'

  const counts = {
    pending:  boxes.filter(b => b.status === 'pending').length,
    approved: boxes.filter(b => b.status === 'approved').length,
    rejected: boxes.filter(b => b.status === 'rejected').length,
  }

  // ─── Loading / error states ─────────────────────────────────────────────────

  if (isLoading) return (
    <div className="flex h-full items-center justify-center bg-[#0a0a10]">
      <Loader2 className="w-8 h-8 text-[#7c6af7] animate-spin" />
    </div>
  )

  if (error || !row) return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0a0a10]">
      <AlertCircle className="w-10 h-10 text-[#f87171]" />
      <p className="text-[#f87171] text-sm">Không tìm thấy frame</p>
      <button onClick={() => navigate(-1)} className="text-xs text-[#7c6af7] hover:underline">Quay lại</button>
    </div>
  )

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#0a0a10] overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#1e1e2a] bg-[#0d0d14] flex-shrink-0 overflow-x-auto">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded text-[#55556a] hover:text-[#f0f0f5] hover:bg-[#1e1e2a] mr-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-[#f0f0f5] mr-3 truncate max-w-48">{row.image_name}</span>

        <div className="w-px h-5 bg-[#1e1e2a] mx-1" />

        {/* OCR button — đặt trước để luôn hiển thị */}
        <button onClick={runOcr} disabled={ocrRunning} title="Chạy OCR — tạo bounding box cho từng vùng text"
          className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors flex-shrink-0',
            ocrRunning ? 'bg-[#1e1e2a] text-[#55556a] cursor-wait' : 'text-[#38bdf8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
          {ocrRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />}
          OCR
        </button>

        <div className="w-px h-5 bg-[#1e1e2a] mx-1 flex-shrink-0" />

        {/* Select tool */}
        <button onClick={() => setActiveTool('select')} title="Select (S)"
          className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors',
            activeTool === 'select' ? 'bg-[#1e1e2a] text-[#f0f0f5]' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
          <Move className="w-3.5 h-3.5" /> Select
        </button>

        {/* Object tool */}
        <button onClick={() => setActiveTool('bbox')} title="Object Detection (B)"
          className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors',
            activeTool === 'bbox' ? 'bg-[#7c6af7] text-white' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
          <Square className="w-3.5 h-3.5" /> Object
        </button>

        {/* Text tool */}
        <button onClick={() => setActiveTool('text')} title="Text Detection (T)"
          className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors',
            activeTool === 'text' ? 'bg-[#38bdf8] text-[#0a0a10]' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
          <Type className="w-3.5 h-3.5" /> Text
        </button>

        {/* Crop tool */}
        <button onClick={() => setActiveTool('crop')} title="Crop vùng cho AI (C)"
          className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors',
            activeTool === 'crop' ? 'bg-[#fbbf24] text-[#0a0a10]' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
          <Crop className="w-3.5 h-3.5" /> Crop
        </button>
        {cropRect && (
          <button onClick={() => setCropRect(null)}
            className="text-[10px] text-[#fbbf24] hover:text-[#f87171] px-1.5 py-1 rounded hover:bg-[#1e1e2a] transition-colors">
            ✕ crop
          </button>
        )}

        <div className="w-px h-5 bg-[#1e1e2a] mx-1" />

        {[
          { id: 'zoom-in',  icon: ZoomIn,    label: 'Zoom In' },
          { id: 'zoom-out', icon: ZoomOut,   label: 'Zoom Out' },
          { id: 'rotate',   icon: RotateCcw, label: 'Rotate' },
          { id: 'bright',   icon: Sun,       label: 'Brightness' },
          { id: 'contrast', icon: Contrast,  label: 'Contrast' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)} title={t.label}
            className={cn('p-1.5 rounded transition-colors', activeTool === t.id ? 'bg-[#7c6af7] text-white' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
            <t.icon className="w-4 h-4" />
          </button>
        ))}

        <button onClick={() => setShowGrid(g => !g)} title="Grid (G)"
          className={cn('p-1.5 rounded transition-colors', showGrid ? 'bg-[#7c6af7] text-white' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
          <Grid3X3 className="w-4 h-4" />
        </button>
        <button onClick={undo} className="p-1.5 rounded text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]" title="Undo (Ctrl+Z)">
          <Undo2 className="w-4 h-4" />
        </button>

        <div className="ml-auto flex items-center gap-3">
          {/* Status counters */}
          <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#a89bff]" />{counts.pending} pending</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />{counts.approved} ok</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f87171]" />{counts.rejected} no</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — box list */}
        <div className="w-44 flex-shrink-0 border-r border-[#1e1e2a] bg-[#0d0d14] p-2 space-y-1 overflow-y-auto">
          <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-2 px-1">
            {boxes.length} annotations
          </p>
          {boxes.length === 0 && (
            <p className="text-[11px] text-[#3e3e52] mt-4 leading-relaxed px-1">AI chưa detect được object nào</p>
          )}
          {boxes.map(b => (
            <button key={b.id} onClick={() => setSelectedId(id => id === b.id ? null : b.id)}
              className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left',
                selectedId === b.id ? 'bg-[#1e1e2a] text-[#f0f0f5]' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: b.color }} />
              <span className="truncate flex-1 font-mono">{b.label}</span>
              <StatusDot status={b.status} />
            </button>
          ))}
        </div>

        {/* Center — canvas */}
        <div className="flex-1 flex items-center justify-center bg-[#060609] overflow-hidden">
          <div ref={canvasRef}
            className="relative select-none rounded-lg overflow-hidden"
            style={{ width: 720, height: 480, cursor }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => drawing && setDrawing(null)}
          >
            {/* Real image */}
            {row.file_path ? (
              <img src={row.file_path} alt={row.image_name}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-[#1a1a28] flex items-center justify-center">
                <span className="text-[#2e2e3a] text-sm font-mono">{row.image_name}</span>
              </div>
            )}

            {/* Grid */}
            {showGrid && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                {Array.from({ length: 10 }, (_, i) => (
                  <line key={`v${i}`} x1={`${i*10}%`} y1="0" x2={`${i*10}%`} y2="100%" stroke="#a89bff" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 7 }, (_, i) => (
                  <line key={`h${i}`} x1="0" y1={`${i*14.28}%`} x2="100%" y2={`${i*14.28}%`} stroke="#a89bff" strokeWidth="0.5" />
                ))}
              </svg>
            )}

            {/* Boxes SVG */}
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
              {boxes.map(b => {
                const st = STATUS_STYLE[b.status]
                const isSelected = b.id === selectedId
                const borderColor = isSelected ? b.color : st.border
                return (
                  <g key={b.id} style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); setSelectedId(id => id === b.id ? null : b.id) }}>
                    <rect
                      x={`${b.x}%`} y={`${b.y}%`}
                      width={`${b.width}%`} height={`${b.height}%`}
                      fill={isSelected ? `${b.color}25` : st.bg}
                      stroke={borderColor}
                      strokeWidth={isSelected ? 2 : 1.5}
                      strokeDasharray={b.type === 'text' ? '6 3' : b.status === 'rejected' ? '4 2' : undefined}
                      opacity={b.status === 'rejected' ? 0.5 : 1}
                    />
                    <BoxLabel b={b} isSelected={isSelected} />
                    {isSelected && (
                      <BoxActions b={b} onApprove={() => setBoxStatus(b.id, 'approved')}
                        onReject={() => setBoxStatus(b.id, 'rejected')} onDelete={() => deleteBox(b.id)} />
                    )}
                  </g>
                )
              })}

              {/* Drawing preview */}
              {previewRect && (
                <rect
                  x={`${previewRect.x}%`} y={`${previewRect.y}%`}
                  width={`${previewRect.w}%`} height={`${previewRect.h}%`}
                  fill={activeTool === 'crop' ? '#fbbf2415' : activeTool === 'text' ? '#38bdf818' : '#7c6af718'}
                  stroke={activeTool === 'crop' ? '#fbbf24' : activeTool === 'text' ? '#38bdf8' : '#7c6af7'}
                  strokeWidth={activeTool === 'crop' ? 2 : 1.5}
                  strokeDasharray={activeTool === 'crop' ? '8 3' : '4 2'}
                />
              )}

              {/* Crop rect */}
              {cropRect && (
                <g>
                  {/* Dim outside crop */}
                  <rect x="0" y="0" width="100%" height="100%" fill="black" opacity={0.35} style={{pointerEvents:'none'}} />
                  <rect
                    x={`${cropRect.x}%`} y={`${cropRect.y}%`}
                    width={`${cropRect.width}%`} height={`${cropRect.height}%`}
                    fill="transparent"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    strokeDasharray="8 3"
                    style={{pointerEvents:'none'}}
                  />
                  <rect
                    x={`${cropRect.x}%`} y={`${cropRect.y}%`}
                    width={`${cropRect.width}%`} height={`${cropRect.height}%`}
                    fill="transparent"
                    style={{pointerEvents:'none'}}
                  />
                  <text
                    x={`${cropRect.x + 0.5}%`}
                    y={`${cropRect.y > 5 ? cropRect.y - 1 : cropRect.y + cropRect.height + 3}%`}
                    fill="#fbbf24" fontSize={10} fontFamily="monospace"
                    style={{pointerEvents:'none'}}
                  >
                    AI sẽ phân tích vùng này
                  </text>
                </g>
              )}
            </svg>

            {/* Label picker */}
            {pending && (
              <LabelPicker
                pending={pending}
                pickerLabel={pickerLabel} setPickerLabel={setPickerLabel}
                customLabel={customLabel} setCustomLabel={setCustomLabel}
                onConfirm={confirmBox} onCancel={() => setPending(null)}
              />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 flex-shrink-0 border-l border-[#1e1e2a] bg-[#0d0d14] overflow-y-auto flex flex-col">

          {/* Selected box detail */}
          <div className="p-4 border-b border-[#1e1e2a]">
            <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-3">Selected</p>
            {selectedBox ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs px-2 py-0.5 rounded font-medium"
                    style={{ backgroundColor: `${selectedBox.color}20`, color: selectedBox.color }}>
                    {selectedBox.label}
                  </span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded', STATUS_STYLE[selectedBox.status].badge)}>
                    {selectedBox.status}
                  </span>
                </div>

                {selectedBox.source === 'ai' && (
                  <div>
                    <div className="flex justify-between text-xs text-[#8888a8] mb-1">
                      <span>AI Confidence</span>
                      <span className="font-mono text-[#f0f0f5]">{Math.round(selectedBox.confidence * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1e1e2a]">
                      <div className="h-full rounded-full bg-[#7c6af7]" style={{ width: `${selectedBox.confidence * 100}%` }} />
                    </div>
                  </div>
                )}

                {/* Approve / Reject */}
                <div className="flex gap-2">
                  <button onClick={() => setBoxStatus(selectedBox.id, 'approved')}
                    className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium transition-colors',
                      selectedBox.status === 'approved'
                        ? 'bg-[#16a34a] text-white'
                        : 'bg-[#16a34a20] text-[#4ade80] hover:bg-[#16a34a40]')}>
                    <Check className="w-3.5 h-3.5" /> Approve (A)
                  </button>
                  <button onClick={() => setBoxStatus(selectedBox.id, 'rejected')}
                    className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium transition-colors',
                      selectedBox.status === 'rejected'
                        ? 'bg-[#dc2626] text-white'
                        : 'bg-[#dc262620] text-[#f87171] hover:bg-[#dc262640]')}>
                    <X className="w-3.5 h-3.5" /> Reject (R)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[['X',`${selectedBox.x.toFixed(1)}%`],['Y',`${selectedBox.y.toFixed(1)}%`],
                    ['W',`${selectedBox.width.toFixed(1)}%`],['H',`${selectedBox.height.toFixed(1)}%`]].map(([k,v]) => (
                    <div key={k} className="bg-[#1a1a28] rounded px-2 py-1 flex justify-between">
                      <span className="text-[#55556a]">{k}</span>
                      <span className="font-mono text-[#f0f0f5]">{v}</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => deleteBox(selectedBox.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-[#1e1e2a] text-[#55556a] text-xs hover:text-[#f87171] transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete (Del)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#55556a]">Click box để chọn</p>
                <div className="bg-[#1a1a28] rounded-lg p-3 space-y-1.5">
                  <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-2">Shortcuts</p>
                  {[['S','Select mode'],['B','Draw object box'],['T','Draw text box'],
                    ['C','Crop vùng cho AI'],
                    ['A','Approve selected'],['R','Reject selected'],
                    ['Del','Delete selected'],['Ctrl+Z','Undo']].map(([k,d]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <kbd className="bg-[#2a2a3a] px-1.5 py-0.5 rounded text-[#a89bff] font-mono text-[10px]">{k}</kbd>
                      <span className="text-[#55556a]">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Checkpoint verdict panel */}
          {(row.ai_result?.productCorrect !== undefined ||
            row.ai_result?.filmWrapped !== undefined ||
            row.ai_result?.awbAttached !== undefined ||
            row.ai_result?.barcodeReadable !== undefined) && (
            <div className="p-4 border-b border-[#1e1e2a]">
              <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-3">Packaging QC</p>
              <div className="space-y-2">
                {([
                  ['CP1', 'Đúng sản phẩm', row.ai_result?.productCorrect],
                  ['CP2', 'Quấn film', row.ai_result?.filmWrapped],
                  ['CP3', 'AWB đính', row.ai_result?.awbAttached],
                  ['CP4', 'Mã quét được', row.ai_result?.barcodeReadable],
                ] as [string, string, boolean | null | undefined][]).map(([cp, label, val]) => (
                  <div key={cp} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#55556a] w-7">{cp}</span>
                      <span className="text-xs text-[#8888a8]">{label}</span>
                    </div>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                      val === true  ? 'bg-[#4ade8020] text-[#4ade80]' :
                      val === false ? 'bg-[#f8717120] text-[#f87171]' :
                                     'bg-[#ffffff08] text-[#55556a]')}>
                      {val === true ? '✓ Pass' : val === false ? '✗ Fail' : '— N/A'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI metadata */}
          <div className="p-4 border-b border-[#1e1e2a]">
            <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-3">AI Results</p>
            <div className="space-y-2 text-xs">
              {row.ai_result?.packaging_status && (
                <div className="flex justify-between">
                  <span className="text-[#55556a]">Packaging</span>
                  <span className={cn('font-mono px-1.5 py-0.5 rounded text-[10px]',
                    row.ai_result.packaging_status === 'ok' ? 'text-[#4ade80] bg-[#4ade8015]' : 'text-[#fbbf24] bg-[#fbbf2415]')}>
                    {row.ai_result.packaging_status}
                  </span>
                </div>
              )}
              {(row.ai_result?.package_count ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#55556a]">Packages</span>
                  <span className="text-[#f0f0f5] font-mono">{row.ai_result.package_count}</span>
                </div>
              )}
              {(row.ai_result?.tracking_codes?.length ?? 0) > 0 && (
                <div>
                  <span className="text-[#55556a]">Tracking codes</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.ai_result.tracking_codes!.map(c => (
                      <span key={c} className="font-mono text-[10px] bg-[#1a1a28] text-[#a89bff] px-1.5 py-0.5 rounded">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {row.ai_result?.notes && (
                <p className="text-[10px] text-[#55556a] italic">{row.ai_result.notes}</p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4">
            <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-3">Summary</p>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {[['pending','#a89bff',counts.pending],['approved','#4ade80',counts.approved],['rejected','#f87171',counts.rejected]].map(([label,color,count]) => (
                <div key={String(label)} className="bg-[#1a1a28] rounded p-2 text-center">
                  <div className="text-lg font-bold" style={{ color: String(color) }}>{count}</div>
                  <div className="text-[9px] text-[#55556a]">{String(label)}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {[...new Set(boxes.map(b => b.label))].map(label => {
                const b = boxes.find(x => x.label === label)!
                return (
                  <span key={label} className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{ backgroundColor: `${b.color}20`, color: b.color }}>
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-[#1e1e2a] bg-[#0d0d14] flex-shrink-0">
        <div className="flex gap-2 items-center">
          <button onClick={approveAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16a34a20] text-[#4ade80] text-sm font-medium hover:bg-[#16a34a40] transition-colors">
            <Check className="w-4 h-4" /> Approve All
          </button>
          <button onClick={rejectAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dc262620] text-[#f87171] text-sm font-medium hover:bg-[#dc262640] transition-colors">
            <X className="w-4 h-4" /> Reject All
          </button>

          <div className="w-px h-6 bg-[#1e1e2a] mx-1" />

          {/* Text only toggle */}
          <button
            onClick={() => setTextOnly(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border',
              textOnly
                ? 'bg-[#38bdf820] text-[#38bdf8] border-[#38bdf840]'
                : 'bg-[#ffffff08] text-[#55556a] border-[#ffffff10] hover:text-[#8888a8]'
            )}
            title="Chỉ trích xuất text — không detect object"
          >
            T
          </button>

          {/* Re-analyze */}
          <button
            onClick={reanalyze}
            disabled={reanalyzing}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              cropRect
                ? 'bg-[#fbbf2420] text-[#fbbf24] border border-[#fbbf2440] hover:bg-[#fbbf2430]'
                : textOnly
                ? 'bg-[#38bdf820] text-[#38bdf8] border border-[#38bdf840] hover:bg-[#38bdf830]'
                : 'bg-[#7c6af720] text-[#a89bff] border border-[#7c6af740] hover:bg-[#7c6af730]'
            )}
          >
            {reanalyzing
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            {cropRect ? 'Re-analyze vùng' : textOnly ? 'Extract Text' : 'Re-analyze AI'}
          </button>
          {reanalyzeError && (
            <span className="text-[11px] text-[#f87171] truncate max-w-40" title={reanalyzeError}>
              {reanalyzeError}
            </span>
          )}
          {extractedText.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#38bdf810] border border-[#38bdf820] max-w-xs overflow-x-auto">
              <span className="text-[10px] text-[#38bdf8] font-medium flex-shrink-0">Text:</span>
              <span className="text-[11px] text-[#e0f2fe] font-mono whitespace-nowrap">{extractedText.join(' · ')}</span>
              <button onClick={() => setExtractedText([])} className="text-[#38bdf860] hover:text-[#38bdf8] flex-shrink-0 ml-1">✕</button>
            </div>
          )}
        </div>
        <button
          onClick={() => saveMut.mutate({ boxes, allApproved: counts.pending === 0 && counts.rejected === 0 })}
          disabled={saveMut.isPending}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#7c6af7] text-white text-sm font-medium hover:bg-[#6b5ce7] disabled:opacity-50 transition-colors">
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saveMut.isSuccess ? 'Saved ✓' : `Save (${boxes.length})`}
        </button>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: BoxStatus }) {
  const colors: Record<BoxStatus, string> = {
    pending: '#a89bff', approved: '#4ade80', rejected: '#f87171',
  }
  return <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[status] }} />
}

function BoxLabel({ b, isSelected }: { b: AnnotationBox; isSelected: boolean }) {
  const tagY = b.y > 6 ? b.y - 5 : b.y + b.height + 1
  const maxW = Math.max(b.label.length * 1.15 + 2, 14)
  return (
    <g>
      <rect x={`${b.x}%`} y={`${tagY}%`} width={`${maxW}%`} height="4.5%"
        fill={STATUS_STYLE[b.status].border} rx={2} opacity={b.status === 'rejected' ? 0.5 : 1} />
      <text x={`${b.x + 0.7}%`} y={`${tagY + 3}%`} fill="white" fontSize={9} fontFamily="monospace"
        fontWeight={isSelected ? 'bold' : 'normal'}>
        {b.label} {b.source === 'ai' ? `${Math.round(b.confidence * 100)}%` : '✎'}
      </text>
    </g>
  )
}

function BoxActions({ b, onApprove, onReject, onDelete }: {
  b: AnnotationBox; onApprove: () => void; onReject: () => void; onDelete: () => void
}) {
  const rx = b.x + b.width
  const ry = b.y > 6 ? b.y - 5 : b.y
  return (
    <g style={{ pointerEvents: 'all' }}>
      {/* ✓ Approve */}
      <g onClick={e => { e.stopPropagation(); onApprove() }} style={{ cursor: 'pointer' }}>
        <rect x={`${rx - 7}%`} y={`${ry}%`} width="3.2%" height="4.5%" fill="#16a34a" rx={2} />
        <text x={`${rx - 5.4}%`} y={`${ry + 3}%`} fill="white" fontSize={9} textAnchor="middle" fontFamily="monospace">✓</text>
      </g>
      {/* ✕ Reject */}
      <g onClick={e => { e.stopPropagation(); onReject() }} style={{ cursor: 'pointer' }}>
        <rect x={`${rx - 3.5}%`} y={`${ry}%`} width="3.2%" height="4.5%" fill="#dc2626" rx={2} />
        <text x={`${rx - 1.9}%`} y={`${ry + 3}%`} fill="white" fontSize={9} textAnchor="middle" fontFamily="monospace">✕</text>
      </g>
      {/* 🗑 Delete */}
      <g onClick={e => { e.stopPropagation(); onDelete() }} style={{ cursor: 'pointer' }}>
        <rect x={`${rx}%`} y={`${ry}%`} width="3.2%" height="4.5%" fill="#374151" rx={2} />
        <text x={`${rx + 1.6}%`} y={`${ry + 3}%`} fill="#9ca3af" fontSize={9} textAnchor="middle" fontFamily="monospace">⌫</text>
      </g>
    </g>
  )
}

const LabelPicker = forwardRef<HTMLDivElement, {
  pending: Omit<AnnotationBox, 'label' | 'color'>
  pickerLabel: string; setPickerLabel: (l: string) => void
  customLabel: string; setCustomLabel: (l: string) => void
  onConfirm: () => void; onCancel: () => void
}>(({ pending, pickerLabel, setPickerLabel, customLabel, setCustomLabel, onConfirm, onCancel }, ref) => {
  const presets = pending.type === 'text' ? TEXT_LABELS : OBJECT_LABELS
  return (
    <div ref={ref}
      className="absolute z-50 bg-[#16162a] border border-[#2e2e4a] rounded-xl shadow-2xl p-3 w-56"
      style={{ left: `calc(${pending.x}% + 4px)`, top: `calc(${pending.y + pending.height}% + 6px)` }}
      onMouseDown={e => e.stopPropagation()}>
      <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-2">
        {pending.type === 'text' ? 'Text label' : 'Object label'}
      </p>
      <div className="flex flex-wrap gap-1 mb-2 max-h-24 overflow-y-auto">
        {presets.map(l => (
          <button key={l} onClick={() => { setPickerLabel(l); setCustomLabel('') }}
            className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors',
              pickerLabel === l && !customLabel
                ? pending.type === 'text' ? 'bg-[#38bdf8] text-[#0a0a10]' : 'bg-[#7c6af7] text-white'
                : 'bg-[#1e1e2a] text-[#8888a8] hover:text-[#f0f0f5]')}>
            {l}
          </button>
        ))}
      </div>
      <input autoFocus value={customLabel} onChange={e => setCustomLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') onCancel() }}
        placeholder="or type custom label…"
        className="w-full bg-[#0d0d14] border border-[#2e2e4a] rounded px-2 py-1.5 text-xs text-[#f0f0f5] font-mono focus:outline-none focus:border-[#7c6af7] placeholder:text-[#3e3e52] mb-2" />
      <div className="flex gap-1.5">
        <button onClick={onConfirm} className="flex-1 py-1.5 rounded text-xs font-medium bg-[#7c6af7] text-white hover:bg-[#6b5ce7] transition-colors">Add</button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded text-xs text-[#55556a] hover:text-[#f0f0f5] hover:bg-[#1e1e2a] transition-colors">Cancel</button>
      </div>
    </div>
  )
})
LabelPicker.displayName = 'LabelPicker'
