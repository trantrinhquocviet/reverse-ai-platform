import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Film, Monitor, Calendar, Tag, Warehouse, Play, ScanLine, Barcode, Package, ShoppingCart, Star, CheckSquare, Pencil, Check, X, Loader2, Images } from 'lucide-react'
import { useVideo, useUpdateVideo } from '@/hooks/useVideos'
import { VideoStatusBadge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { formatDateTime } from '@/utils/formatters'
import { useProcessing } from '@/contexts/ProcessingContext'
import { supabase } from '@/services/api'
import type { LucideIcon } from 'lucide-react'

interface KeyFrame {
  id: string
  file_path: string
  frame_timestamp: number
  image_name: string
  ai_result: {
    label_text?: string[]
    tracking_codes?: string[]
    barcodes?: string[]
    objects?: { label: string; confidence: number }[]
    event_type?: string
  } | null
}

function useVideoFrames(videoId: string, refetchSignal: number) {
  const [frames, setFrames] = useState<KeyFrame[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!videoId) return
    setLoading(true)
    supabase
      .from('dataset_images')
      .select('id, file_path, frame_timestamp, image_name, ai_result')
      .eq('video_id', videoId)
      .order('frame_timestamp', { ascending: true })
      .then(({ data }) => {
        setFrames((data as KeyFrame[]) ?? [])
        setLoading(false)
      })
  }, [videoId, refetchSignal])

  return { frames, loading }
}

function KeyFrameGrid({ videoId, refetchSignal }: { videoId: string; refetchSignal: number }) {
  const { frames, loading } = useVideoFrames(videoId, refetchSignal)
  const [selected, setSelected] = useState<KeyFrame | null>(null)

  if (loading) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-video skeleton rounded-[10px]" />)}
    </div>
  )

  if (frames.length === 0) return (
    <div className="flex flex-col items-center justify-center py-10 text-[#55556a]">
      <Images className="w-8 h-8 mb-2 opacity-40" />
      <p className="text-xs">Chưa có frame nào — chạy AI Processing để bắt đầu</p>
    </div>
  )

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {frames.map((f) => {
          const codes = [...(f.ai_result?.tracking_codes ?? []), ...(f.ai_result?.barcodes ?? [])]
          const text = f.ai_result?.label_text?.slice(0, 6) ?? []
          const event = f.ai_result?.event_type
          return (
            <button
              key={f.id}
              onClick={() => setSelected(f)}
              className="group relative rounded-[10px] overflow-hidden border border-[#1e1e2a] hover:border-[#7c6af760] transition-colors text-left"
            >
              <img
                src={f.file_path}
                alt={f.image_name}
                className="w-full aspect-video object-cover bg-[#0a0a10]"
                loading="lazy"
              />
              {/* timestamp badge */}
              <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                {f.frame_timestamp.toFixed(1)}s
              </div>
              {/* event badge */}
              {event && (
                <div className="absolute top-1.5 right-1.5 bg-[#7c6af7cc] text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                  {event.replace(/_/g, ' ')}
                </div>
              )}
              {/* bottom info */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                {codes.length > 0 ? (
                  <p className="text-[9px] font-mono text-[#a89bff] truncate">{codes[0]}</p>
                ) : text.length > 0 ? (
                  <p className="text-[9px] text-[#8888a8] truncate">{text.slice(0, 3).join(' · ')}</p>
                ) : (
                  <p className="text-[9px] text-[#44445a] italic">no text</p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[#0d0d14] border border-[#2a2a38] rounded-[16px] overflow-hidden max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2a]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#f0f0f5]">t = {selected.frame_timestamp.toFixed(1)}s</span>
                {selected.ai_result?.event_type && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#7c6af720] text-[#a89bff] uppercase tracking-wide">
                    {selected.ai_result.event_type.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-[#55556a] hover:text-[#f0f0f5] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <img src={selected.file_path} alt="" className="w-full object-contain max-h-64 bg-black" />

            <div className="p-4 space-y-3">
              {/* Tracking / Barcode */}
              {[...(selected.ai_result?.tracking_codes ?? []), ...(selected.ai_result?.barcodes ?? [])].length > 0 && (
                <div>
                  <p className="text-[9px] text-[#55556a] uppercase tracking-wider mb-1.5">Tracking / Barcode</p>
                  <div className="space-y-1">
                    {[...(selected.ai_result?.tracking_codes ?? []), ...(selected.ai_result?.barcodes ?? [])].map((c, i) => (
                      <p key={i} className="text-xs font-mono text-[#a89bff] bg-[#7c6af710] px-2 py-1 rounded">{c}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* OCR text */}
              {(selected.ai_result?.label_text ?? []).length > 0 && (
                <div>
                  <p className="text-[9px] text-[#55556a] uppercase tracking-wider mb-1.5">OCR Text</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.ai_result!.label_text!.map((t, i) => (
                      <span key={i} className="text-[10px] text-[#8888a8] bg-[#ffffff08] px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Objects */}
              {(selected.ai_result?.objects ?? []).length > 0 && (
                <div>
                  <p className="text-[9px] text-[#55556a] uppercase tracking-wider mb-1.5">Detected Objects</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.ai_result!.objects!.map((o, i) => (
                      <span key={i} className="text-[10px] text-[#f0f0f5] bg-[#ffffff08] px-1.5 py-0.5 rounded">
                        {o.label.replace(/_/g, ' ')} <span className="text-[#44445a]">{Math.round(o.confidence * 100)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty */}
              {!selected.ai_result?.tracking_codes?.length && !selected.ai_result?.barcodes?.length &&
               !selected.ai_result?.label_text?.length && !selected.ai_result?.objects?.length && (
                <p className="text-xs text-[#44445a] italic text-center py-2">Không có dữ liệu OCR</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface DetectedObject {
  label: string
  confidence: number
  region?: string
}

interface AiResult {
  objects?: DetectedObject[]
  tracking_codes?: string[]
  barcodes?: string[]
  packaging_status?: string
  package_count?: number
  label_text?: string[]
  confidence?: number
  notes?: string
}

const OBJECT_EMOJI: Record<string, string> = {
  cardboard_box: '📦', shipping_label: '🏷️', barcode_1d: '📊', qr_code: '🔲',
  hand: '✋', tape_roll: '🧵', barcode_scanner: '📠', label_printer: '🖨️',
  knife_cutter: '🔪', keyboard: '⌨️', mouse: '🖱️', plastic_bag: '🟢',
  envelope: '✉️', package: '📦', default: '🔍',
}

function FrameResultDetail({ ai }: { ai: AiResult }) {
  const trackingCodes = ai.tracking_codes?.filter(Boolean) ?? []
  const barcodes = ai.barcodes?.filter(Boolean) ?? []
  const objects = ai.objects ?? []

  return (
    <div className="space-y-2 mt-1">
      {/* Objects */}
      {objects.length > 0 && (
        <div>
          <p className="text-[9px] text-[#55556a] uppercase tracking-wider mb-1">Detected Objects</p>
          <div className="flex flex-wrap gap-1">
            {objects.map((obj, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#ffffff08] text-[10px] text-[#f0f0f5]"
                title={`${obj.region ?? ''} · ${Math.round((obj.confidence ?? 0) * 100)}%`}
              >
                <span>{OBJECT_EMOJI[obj.label] ?? OBJECT_EMOJI.default}</span>
                <span className="text-[#8888a8]">{obj.label.replace(/_/g, ' ')}</span>
                <span className="text-[#44445a]">{Math.round((obj.confidence ?? 0) * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Tracking codes */}
      {trackingCodes.length > 0 && (
        <div className="bg-[#1a1a24] rounded-[6px] px-2 py-1.5">
          <p className="text-[9px] text-[#55556a] mb-0.5">Tracking</p>
          {trackingCodes.map((c, i) => <p key={i} className="text-[10px] text-[#a89bff] font-mono truncate">{c}</p>)}
        </div>
      )}
      {/* Barcodes */}
      {barcodes.length > 0 && (
        <div className="bg-[#1a1a24] rounded-[6px] px-2 py-1.5">
          <p className="text-[9px] text-[#55556a] mb-0.5">Barcode</p>
          {barcodes.map((c, i) => <p key={i} className="text-[10px] text-[#f0f0f5] font-mono truncate">{c}</p>)}
        </div>
      )}
      {/* Packaging + count */}
      <div className="flex gap-3 text-[10px]">
        {ai.packaging_status && (
          <span>
            <span className="text-[#55556a]">Packaging: </span>
            <span className={ai.packaging_status === 'ok' ? 'text-green-400' : ai.packaging_status === 'damaged' ? 'text-red-400' : 'text-yellow-400'}>
              {ai.packaging_status}
            </span>
          </span>
        )}
        {ai.package_count !== undefined && (
          <span className="text-[#55556a]">Packages: <span className="text-[#f0f0f5]">{ai.package_count}</span></span>
        )}
        {ai.confidence !== undefined && (
          <span className="text-[#55556a]">Conf: <span className="text-[#f0f0f5]">{Math.round(ai.confidence * 100)}%</span></span>
        )}
      </div>
      {ai.notes && ai.notes !== 'parse_error' && (
        <p className="text-[10px] text-[#55556a] italic truncate">{ai.notes}</p>
      )}
    </div>
  )
}

const aiSections: { type: string; icon: LucideIcon; description: string }[] = [
  { type: 'Tracking Code', icon: ScanLine, description: 'Scan & extract tracking codes from packages' },
  { type: 'Barcode', icon: Barcode, description: 'Detect and decode barcodes in video frames' },
  { type: 'SKU', icon: Tag, description: 'Identify product SKU codes from labels' },
  { type: 'OCR', icon: Film, description: 'Extract text from product labels and packaging' },
  { type: 'Packaging', icon: Package, description: 'Analyze packaging type and condition' },
  { type: 'Product', icon: ShoppingCart, description: 'Classify and identify products' },
  { type: 'Quality', icon: CheckSquare, description: 'Detect defects and quality issues' },
]

function useElapsed(startedAt: number | undefined, running: boolean): string {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!running || !startedAt) { setSecs(0); return }
    setSecs(Math.floor((Date.now() - startedAt) / 1000))
    const id = setInterval(() => setSecs(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [running, startedAt])
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`
}

export function VideoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: video, isLoading } = useVideo(id ?? '')
  const updateVideo = useUpdateVideo()

  const videoRef = useRef<HTMLVideoElement>(null)
  const { job, paused, startProcessing, pauseJob, resumeJob, cancelJob } = useProcessing()
  const isMyJob = job?.videoId === id

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', warehouse: '', brand: '' })
  const [refetchSignal, setRefetchSignal] = useState(0)

  const elapsed = useElapsed(job?.startedAt, !!(isMyJob && job?.status === 'running'))

  // Refetch frames when job finishes
  useEffect(() => {
    if (isMyJob && job?.status === 'done') setRefetchSignal(v => v + 1)
  }, [isMyJob, job?.status])

  const startEdit = () => {
    if (!video) return
    setForm({ name: video.name, warehouse: video.warehouse, brand: video.brand })
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const saveEdit = async () => {
    if (!id) return
    await updateVideo.mutateAsync({ id, data: form })
    setEditing(false)
  }

  const handleStartProcessing = () => {
    if (!video || !id || !videoRef.current?.src) return
    startProcessing(id, video.name, videoRef.current)
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-5 animate-fade-in">
        <div className="h-8 skeleton rounded w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-96 skeleton rounded-[14px]" />
          <div className="h-96 skeleton rounded-[14px]" />
        </div>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-96">
        <Star className="w-12 h-12 text-[#55556a] mb-4" />
        <p className="text-[#f0f0f5] font-medium">Video not found</p>
        <Button variant="ghost" onClick={() => navigate('/videos')} className="mt-3">
          Back to Video Center
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <button
        onClick={() => navigate('/videos')}
        className="flex items-center gap-2 text-sm text-[#8888a8] hover:text-[#f0f0f5] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Video Center
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: player + AI */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[14px] bg-[#111118] border border-[#1e1e2a] overflow-hidden">
            <div className="relative bg-black aspect-video">
              {video.filePath ? (
                <video
                  ref={videoRef}
                  src={video.filePath}
                  controls
                  className="w-full h-full"
                  preload="metadata"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-10 h-10 text-[#55556a]" />
                </div>
              )}
              <div className="absolute top-3 right-3">
                <VideoStatusBadge status={video.status} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#f0f0f5] mb-3">AI Analysis</h3>
            {isMyJob && job && job.results.length > 0 ? (
              <div className="space-y-2">
                {job.results.map((r) => (
                  <div key={r.timestamp} className="rounded-[10px] bg-[#111118] border border-[#1e1e2a] p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-medium text-[#8888a8]">
                        t={r.timestamp}s
                      </span>
                      {r.status === 'ok'
                        ? <span className="text-[10px] text-green-400">✓ OK</span>
                        : <span className="text-[10px] text-red-400">✗ Lỗi</span>}
                    </div>
                    {r.status === 'ok' && r.detectedText && r.detectedText.length > 0 && (
                      <p className="text-[10px] text-gray-400 truncate">{r.detectedText.join(', ')}</p>
                    )}
                    {r.status === 'error' && (
                      <p className="text-[10px] text-red-400 truncate">{r.error}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {aiSections.map(({ type, icon: Icon, description }) => (
                  <div key={type} className="rounded-[12px] bg-[#111118] border border-[#1e1e2a] p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-[8px] bg-[#ffffff08]">
                        <Icon className="w-3.5 h-3.5 text-[#55556a]" />
                      </div>
                      <span className="text-xs font-medium text-[#f0f0f5]">{type}</span>
                    </div>
                    <p className="text-[10px] text-[#55556a] leading-snug">{description}</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#55556a]" />
                      <span className="text-[10px] text-[#55556a] italic">Waiting for AI Analysis</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Key Frames */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#f0f0f5]">Key Frames</h3>
            <button
              onClick={() => setRefetchSignal(v => v + 1)}
              className="text-[10px] text-[#55556a] hover:text-[#a89bff] transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
          <KeyFrameGrid videoId={id ?? ''} refetchSignal={refetchSignal} />
        </div>

        {/* Right: metadata + actions */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#f0f0f5]">Video Information</h3>
              {!editing ? (
                <button onClick={startEdit} className="p-1 rounded hover:bg-[#ffffff10] transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-[#8888a8]" />
                </button>
              ) : (
                <div className="flex gap-1">
                  <button onClick={saveEdit} disabled={updateVideo.isPending} className="p-1 rounded hover:bg-[#ffffff10] transition-colors">
                    <Check className="w-3.5 h-3.5 text-[#7c6af7]" />
                  </button>
                  <button onClick={cancelEdit} className="p-1 rounded hover:bg-[#ffffff10] transition-colors">
                    <X className="w-3.5 h-3.5 text-[#8888a8]" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {/* Editable: Name */}
              <div className="flex gap-3 items-start">
                <Film className="w-3.5 h-3.5 text-[#55556a] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#55556a]">File Name</p>
                  {editing ? (
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 text-xs h-7 px-2" />
                  ) : (
                    <p className="text-xs text-[#f0f0f5] break-all mt-0.5">{video.name}</p>
                  )}
                </div>
              </div>

              {/* Editable: Warehouse */}
              <div className="flex gap-3 items-start">
                <Warehouse className="w-3.5 h-3.5 text-[#55556a] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#55556a]">Warehouse</p>
                  {editing ? (
                    <Input value={form.warehouse} onChange={e => setForm(f => ({ ...f, warehouse: e.target.value }))} className="mt-1 text-xs h-7 px-2" />
                  ) : (
                    <p className="text-xs text-[#f0f0f5] break-all mt-0.5">{video.warehouse || '—'}</p>
                  )}
                </div>
              </div>

              {/* Editable: Brand */}
              <div className="flex gap-3 items-start">
                <Tag className="w-3.5 h-3.5 text-[#55556a] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#55556a]">Brand</p>
                  {editing ? (
                    <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className="mt-1 text-xs h-7 px-2" />
                  ) : (
                    <p className="text-xs text-[#f0f0f5] break-all mt-0.5">{video.brand || '—'}</p>
                  )}
                </div>
              </div>

              {/* Read-only fields */}
              {[
                { icon: Clock, label: 'Duration', value: video.duration },
                { icon: Monitor, label: 'Resolution', value: video.resolution },
                { icon: Calendar, label: 'Upload Time', value: formatDateTime(video.uploadTime) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex gap-3 items-start">
                  <Icon className="w-3.5 h-3.5 text-[#55556a] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-[#55556a]">{label}</p>
                    <p className="text-xs text-[#f0f0f5] break-all mt-0.5">{value}</p>
                  </div>
                </div>
              ))}

              <div className="flex gap-3 items-start">
                <div className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#55556a]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#55556a]">Status</p>
                  <div className="mt-0.5"><VideoStatusBadge status={video.status} /></div>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#55556a]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#55556a]">File Size</p>
                  <p className="text-xs text-[#f0f0f5] mt-0.5">{video.fileSize}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-[#f0f0f5] mb-3">Actions</h3>
            <div className="space-y-2">
              {isMyJob && job?.status === 'running' ? (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-[#8888a8]">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin text-[#a89bff]" />
                        {paused ? 'Đã tạm dừng' : 'Đang xử lý...'}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[#7c6af7]">{elapsed}</span>
                        <span>{job.current}/{job.total}</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#1e1e2a]">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${paused ? 'bg-[#fbbf24]' : 'bg-[#7c6af7]'}`}
                        style={{ width: `${job.total ? (job.current / job.total) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex gap-2 text-[10px]">
                      <span className="text-green-400">✓ {job.results.filter(r => r.status === 'ok').length} ok</span>
                      <span className="text-red-400">✗ {job.results.filter(r => r.status === 'error').length} lỗi</span>
                    </div>
                  </div>
                  {job.message && <p className="text-[10px] text-[#8888a8] text-center">{job.message}</p>}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => paused ? resumeJob() : pauseJob()}
                    >
                      {paused ? '▶ Resume' : '⏸ Pause'}
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => cancelJob()}
                    >
                      ⏹ Stop
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleStartProcessing}
                >
                  Start AI Processing
                </Button>
              )}
              <Button variant="ghost" className="w-full" disabled>
                Download Video
              </Button>
              <Button variant="danger" className="w-full" disabled>
                Delete Video
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
