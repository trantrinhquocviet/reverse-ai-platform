import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAutoTrain } from '@/hooks/useAutoTrain'
import { Tag, CheckCircle, XCircle, Filter, Loader2, RefreshCw, ZoomIn, X, Pencil, Save, Video, ChevronDown, Square, CheckSquare } from 'lucide-react'
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

interface AIResult {
  objects?: DetectedObject[]
  tracking_codes?: string[]
  barcodes?: string[]
  packaging_status?: 'ok' | 'damaged' | 'unknown'
  package_count?: number
  label_text?: string[]
  confidence?: number
  notes?: string
  checkpoint_product_correct?:  boolean | null
  checkpoint_film_wrapped?:     boolean | null
  checkpoint_awb_attached?:     boolean | null
  checkpoint_barcode_readable?: boolean | null
}

interface Checkpoints {
  productCorrect:  boolean | null
  filmWrapped:     boolean | null
  awbAttached:     boolean | null
  barcodeReadable: boolean | null
}

function extractCheckpoints(ai: AIResult | null): Checkpoints {
  return {
    productCorrect:  ai?.checkpoint_product_correct  ?? null,
    filmWrapped:     ai?.checkpoint_film_wrapped      ?? null,
    awbAttached:     ai?.checkpoint_awb_attached      ?? null,
    barcodeReadable: ai?.checkpoint_barcode_readable  ?? null,
  }
}

const CP_META = [
  { key: 'productCorrect',  label: 'Đúng SP',  icon: '📦' },
  { key: 'filmWrapped',     label: 'Quấn kéo', icon: '🎁' },
  { key: 'awbAttached',     label: 'Dán AWB',  icon: '🏷️' },
  { key: 'barcodeReadable', label: 'Mã rõ',    icon: '📊' },
] as const

function CheckpointBadges({ checkpoints }: { checkpoints: Checkpoints }) {
  const vals = [
    checkpoints.productCorrect,
    checkpoints.filmWrapped,
    checkpoints.awbAttached,
    checkpoints.barcodeReadable,
  ]
  if (vals.every(v => v === null)) return null
  return (
    <div className="flex gap-1 flex-wrap">
      {CP_META.map((cp, i) => {
        const val = vals[i]
        return (
          <span
            key={cp.key}
            title={cp.label}
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[4px] text-[9px] font-semibold border',
              val === true  && 'bg-[#16a34a20] text-[#4ade80] border-[#16a34a40]',
              val === false && 'bg-[#dc262620] text-[#f87171] border-[#dc262640]',
              val === null  && 'bg-[#1e1e2a] text-[#44445a] border-[#2a2a3a]',
            )}
          >
            {cp.icon} {val === true ? '✓' : val === false ? '✗' : '–'}
          </span>
        )
      })}
    </div>
  )
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

const OBJECT_EMOJI: Record<string, string> = {
  cardboard_box: '📦', shipping_label: '🏷️', barcode_1d: '📊', qr_code: '🔲',
  hand: '✋', tape_roll: '🧵', barcode_scanner: '📠', label_printer: '🖨️',
  knife_cutter: '🔪', keyboard: '⌨️', mouse: '🖱️', plastic_bag: '🟢',
  envelope: '✉️', package: '📦', stretch_film: '🎁', bubble_wrap: '🫧',
  awb_label: '🏷️', product_item: '🛍️', sku_label: '🔖', package_surface: '📦',
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

function PackagingBadge({ status }: { status?: string }) {
  if (!status) return null
  const cfg: Record<string, string> = {
    ok: 'bg-[#16a34a20] text-[#4ade80]',
    damaged: 'bg-[#dc262620] text-[#f87171]',
    unknown: 'bg-[#55556a20] text-[#8888a8]',
  }
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', cfg[status] ?? cfg.unknown)}>
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
  const [localAi, setLocalAi] = useState(frame.ai_result)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [editCheckpoints, setEditCheckpoints] = useState<Checkpoints>(() => extractCheckpoints(frame.ai_result))

  // Sync when AI result updates after re-analyze refetch
  useEffect(() => {
    setLocalAi(frame.ai_result)
    setEditCheckpoints(extractCheckpoints(frame.ai_result))
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
        checkpoint_product_correct:  editCheckpoints.productCorrect,
        checkpoint_film_wrapped:     editCheckpoints.filmWrapped,
        checkpoint_awb_attached:     editCheckpoints.awbAttached,
        checkpoint_barcode_readable: editCheckpoints.barcodeReadable,
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

        {/* Toggle boxes button */}
        {ai?.objects && ai.objects.some(o => o.x != null) && (
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
        {ai?.packaging_status && (
          <div className="absolute top-2 right-2">
            <PackagingBadge status={ai.packaging_status} />
          </div>
        )}
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
            {/* Checkpoint override toggles */}
            <div>
              <p className="text-[9px] text-[#55556a] mb-1.5">Checkpoints QC</p>
              <div className="space-y-1">
                {CP_META.map(cp => {
                  const val = editCheckpoints[cp.key]
                  return (
                    <div key={cp.key} className="flex items-center justify-between">
                      <span className="text-[9px] text-[#8888a8]">{cp.icon} {cp.label}</span>
                      <div className="flex gap-1">
                        {([true, false, null] as const).map(v => (
                          <button
                            key={String(v)}
                            onClick={() => setEditCheckpoints(prev => ({ ...prev, [cp.key]: v }))}
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-colors',
                              val === v
                                ? v === true  ? 'bg-[#16a34a] text-white border-[#16a34a]'
                                : v === false ? 'bg-[#dc2626] text-white border-[#dc2626]'
                                :               'bg-[#55556a] text-white border-[#55556a]'
                                : 'bg-transparent text-[#44445a] border-[#2a2a3a] hover:border-[#55556a]'
                            )}
                          >
                            {v === true ? '✓' : v === false ? '✗' : '–'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
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
            {/* Checkpoint badges — view mode */}
            <CheckpointBadges checkpoints={extractCheckpoints(localAi)} />
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

            {ai?.package_count !== undefined && (
              <p className="text-[10px] text-[#8888a8]">
                <span className="text-[#55556a]">Packages:</span> {ai.package_count}
                {ai.confidence !== undefined && (
                  <span className="ml-2 text-[#55556a]">conf: {Math.round(ai.confidence * 100)}%</span>
                )}
              </p>
            )}

            {/* Detected objects */}
            {ai?.objects && ai.objects.length > 0 && (
              <div>
                <p className="text-[9px] text-[#55556a] uppercase tracking-wider mb-1">Objects</p>
                <div className="flex flex-wrap gap-1">
                  {ai.objects.slice(0, 6).map((obj, i) => (
                    <span
                      key={i}
                      title={`${obj.region ?? ''} · ${Math.round((obj.confidence ?? 0) * 100)}%`}
                      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-[4px] bg-[#ffffff08] text-[9px] text-[#8888a8]"
                    >
                      {OBJECT_EMOJI[obj.label] ?? '🔍'} {obj.label.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {ai.objects.length > 6 && (
                    <span className="text-[9px] text-[#44445a]">+{ai.objects.length - 6}</span>
                  )}
                </div>
              </div>
            )}

            {!ai && <p className="text-[10px] text-[#55556a] italic">No AI result</p>}
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

  // Checkpoint stats across all loaded frames
  const cpStats = CP_META.map(cp => {
    const fieldMap: Record<string, keyof AIResult> = {
      productCorrect:  'checkpoint_product_correct',
      filmWrapped:     'checkpoint_film_wrapped',
      awbAttached:     'checkpoint_awb_attached',
      barcodeReadable: 'checkpoint_barcode_readable',
    }
    const field = fieldMap[cp.key]
    const withData = frames.filter(f => f.ai_result?.[field] !== null && f.ai_result?.[field] !== undefined)
    const passed   = frames.filter(f => f.ai_result?.[field] === true).length
    const failed   = frames.filter(f => f.ai_result?.[field] === false).length
    return { ...cp, passed, failed, total: withData.length }
  })

  // CP Failures filter applied client-side
  const displayFrames = filterStatus === 'cp_failures'
    ? frames.filter(f => {
        const ai = f.ai_result
        return [
          ai?.checkpoint_product_correct,
          ai?.checkpoint_film_wrapped,
          ai?.checkpoint_awb_attached,
          ai?.checkpoint_barcode_readable,
        ].some(v => v === false)
      })
    : frames

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

      {/* Checkpoint QC stats strip */}
      {cpStats.some(c => c.total > 0) && (
        <div className="grid grid-cols-4 gap-2">
          {cpStats.map(cp => {
            const passRate = cp.total > 0 ? Math.round(cp.passed / cp.total * 100) : null
            return (
              <div key={cp.key} className={cn(
                'rounded-[8px] p-2 text-center border',
                passRate === null ? 'bg-[#1a1a24] border-[#1e1e2a]' :
                passRate >= 90 ? 'bg-[#16a34a10] border-[#16a34a30]' :
                passRate >= 70 ? 'bg-[#f59e0b10] border-[#f59e0b30]' :
                                 'bg-[#dc262610] border-[#dc262630]'
              )}>
                <p className="text-sm">{cp.icon}</p>
                <p className={cn('text-sm font-bold',
                  passRate === null ? 'text-[#44445a]' :
                  passRate >= 90 ? 'text-[#4ade80]' :
                  passRate >= 70 ? 'text-[#fbbf24]' : 'text-[#f87171]'
                )}>
                  {passRate !== null ? `${passRate}%` : '–'}
                </p>
                <p className="text-[8px] text-[#55556a]">{cp.label}</p>
                {cp.failed > 0 && (
                  <p className="text-[8px] text-[#f87171]">{cp.failed} fail</p>
                )}
              </div>
            )
          })}
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
          <button
            onClick={() => setFilterStatus('cp_failures')}
            className={cn(
              'px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors',
              filterStatus === 'cp_failures'
                ? 'bg-[#dc2626] text-white'
                : 'bg-[#dc262615] text-[#f87171] hover:bg-[#dc262625]'
            )}
          >
            ✗ CP Failures
          </button>
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
            {filterStatus === 'cp_failures'
              ? 'Không có frame nào bị fail checkpoint QC'
              : filterStatus === 'all' && filterVideo === 'all'
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
