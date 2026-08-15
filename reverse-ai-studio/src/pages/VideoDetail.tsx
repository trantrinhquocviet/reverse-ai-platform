import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Film, Monitor, Calendar, Tag, Warehouse, Play, ScanLine, Barcode, Package, ShoppingCart, Star, CheckSquare, Pencil, Check, X, Loader2, Images, ShieldCheck, ShieldAlert, AlertCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useVideo, useUpdateVideo } from '@/hooks/useVideos'
import { VideoStatusBadge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { formatDateTime } from '@/utils/formatters'
import { useProcessing } from '@/contexts/ProcessingContext'
import { supabase } from '@/services/api'
import type { LucideIcon } from 'lucide-react'
import type { VideoAudit } from '@/types'

interface ProcessingLogEntry {
  job_id?: string
  model?: string
  step?: string
  status?: string
  timestamp?: string
  notes?: string
}

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
    confidence?: number
    notes?: string
  } | null
  processing_log?: ProcessingLogEntry[] | null
}

interface AnalysisRun {
  job_id: string
  timestamp: string
  frameCount: number
  okCount: number
  model: string
}

function aggregateRuns(frames: KeyFrame[]): AnalysisRun[] {
  const runs = new Map<string, AnalysisRun>()
  for (const f of frames) {
    for (const entry of f.processing_log ?? []) {
      const key = entry.job_id || entry.timestamp?.slice(0, 10) || 'unknown'
      const existing = runs.get(key)
      if (!existing) {
        runs.set(key, {
          job_id: key,
          timestamp: entry.timestamp ?? '',
          frameCount: 1,
          okCount: entry.status === 'ok' ? 1 : 0,
          model: (entry.model ?? '').split('/').pop()?.replace(':free', '') ?? '',
        })
      } else {
        existing.frameCount++
        if (entry.status === 'ok') existing.okCount++
        if (!existing.timestamp || entry.timestamp! > existing.timestamp) existing.timestamp = entry.timestamp ?? ''
      }
    }
  }
  return [...runs.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

function useVideoFrames(videoId: string, refetchSignal: number) {
  const [frames, setFrames] = useState<KeyFrame[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!videoId) return
    setLoading(true)
    supabase
      .from('dataset_images')
      .select('id, file_path, frame_timestamp, image_name, ai_result, processing_log')
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

  const jumpToFrame = (code: string) => {
    const frame = frames.find(f =>
      f.ai_result?.tracking_codes?.includes(code) ||
      f.ai_result?.barcodes?.includes(code) ||
      f.ai_result?.label_text?.includes(code)
    )
    if (frame) setSelected(frame)
  }

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

  // Aggregate tracking codes across all frames for summary
  const allCodes = [...new Set(frames.flatMap(f => [...(f.ai_result?.tracking_codes ?? []), ...(f.ai_result?.barcodes ?? [])]))]

  return (
    <>
      {/* Tracking codes summary strip */}
      {allCodes.length > 0 && (
        <div className="mb-3 p-2.5 bg-[#7c6af710] border border-[#7c6af730] rounded-[8px] flex flex-wrap gap-1.5 items-center">
          <span className="text-[9px] text-[#7c6af7] uppercase tracking-wider font-semibold mr-1">Tracking codes ({allCodes.length})</span>
          {allCodes.map((c, i) => (
            <button key={i} onClick={() => jumpToFrame(c)} className="text-[10px] font-mono text-[#a89bff] bg-[#7c6af720] hover:bg-[#7c6af740] px-1.5 py-0.5 rounded transition-colors cursor-pointer">{c}</button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {frames.map((f) => {
          const codes = [...(f.ai_result?.tracking_codes ?? []), ...(f.ai_result?.barcodes ?? [])]
          const text = f.ai_result?.label_text?.slice(0, 6) ?? []
          const event = f.ai_result?.event_type
          const conf = f.ai_result?.confidence
          const confColor = conf == null ? '' : conf >= 0.75 ? '#4ade80' : conf >= 0.5 ? '#fcd34d' : '#f87171'
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
              {/* confidence dot */}
              {conf != null && (
                <div className="absolute bottom-6 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: confColor }} title={`AI confidence: ${Math.round(conf * 100)}%`} />
              )}
              {/* bottom info */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                {codes.length > 0 ? (
                  <p className="text-[9px] font-mono text-[#a89bff] truncate">{codes[0]}{codes.length > 1 ? ` +${codes.length - 1}` : ''}</p>
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#f0f0f5]">t = {selected.frame_timestamp.toFixed(1)}s</span>
                {selected.ai_result?.event_type && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#7c6af720] text-[#a89bff] uppercase tracking-wide">
                    {selected.ai_result.event_type.replace(/_/g, ' ')}
                  </span>
                )}
                {selected.ai_result?.confidence != null && (
                  <span className="text-[9px] px-2 py-0.5 rounded bg-[#ffffff08] text-[#8888a8]">
                    conf {Math.round(selected.ai_result.confidence * 100)}%
                  </span>
                )}
                {/* Show model used from processing_log */}
                {selected.processing_log && selected.processing_log.length > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded bg-[#ffffff05] text-[#55556a] font-mono truncate max-w-[160px]">
                    {(selected.processing_log[selected.processing_log.length - 1].model ?? '').split('/').pop()?.replace(':free', '')}
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

              {/* Processing log */}
              {selected.processing_log && selected.processing_log.length > 0 && (
                <div>
                  <p className="text-[9px] text-[#55556a] uppercase tracking-wider mb-1.5">Processing Log</p>
                  <div className="space-y-1">
                    {selected.processing_log.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 text-[9px]">
                        <span className={entry.status === 'ok' ? 'text-[#4ade80]' : 'text-[#f87171]'}>●</span>
                        <span className="text-[#55556a] uppercase">{entry.step}</span>
                        <span className="font-mono text-[#44445a] truncate flex-1">{(entry.model ?? '').split('/').pop()?.replace(':free', '')}</span>
                      </div>
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

const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: typeof ShieldCheck }> = {
  PASS:                   { label: 'PASS', color: '#4ade80', bg: '#14532d20', border: '#4ade8040', Icon: ShieldCheck },
  PASS_WITH_WARNING:      { label: 'PASS (có cảnh báo)', color: '#fcd34d', bg: '#78350f20', border: '#fcd34d40', Icon: ShieldAlert },
  HUMAN_REVIEW_REQUIRED:  { label: 'CẦN REVIEW THỦ CÔNG', color: '#f59e0b', bg: '#78350f20', border: '#f59e0b40', Icon: HelpCircle },
  WH_PROCESS_FAIL:        { label: 'QUY TRÌNH THẤT BẠI', color: '#f87171', bg: '#450a0a20', border: '#f8717140', Icon: AlertCircle },
}

const CHECKLIST_LABELS: Record<string, string> = {
  active_parcel: 'Parcel nhận diện', awb_visible: 'AWB nhìn thấy', awb_readable: 'AWB đọc được',
  opening: 'Mở hộp', product_emergence: 'Sản phẩm xuất hiện', product_removed: 'Sản phẩm lấy ra',
  product_full_view: 'Sản phẩm nhìn đủ', barcode: 'Barcode quét được', product_text: 'Text sản phẩm',
  quantity: 'Số lượng xác nhận', process_completed: 'Quy trình hoàn tất',
}

function AuditVerdictPanel({ audit, videoType }: { audit: VideoAudit; videoType?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = VERDICT_CONFIG[audit.case_status] ?? VERDICT_CONFIG.HUMAN_REVIEW_REQUIRED
  const { Icon } = cfg

  const checklistPairs = Object.entries(audit.event_audit ?? {})
  const qualityEntries = Object.entries(audit.quality_components ?? {})

  return (
    <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: cfg.border, background: cfg.bg }}>
      {/* Header — verdict */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 flex-shrink-0" style={{ color: cfg.color }} />
          <div>
            <p className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
            <p className="text-[10px] text-[#55556a]">
              Score: <span style={{ color: cfg.color }}>{audit.video_evidence_score}/100</span>
              {videoType && <> · <span className="text-[#8888a8]">{videoType.replace('_', ' ')}</span></>}
              {' '}· {audit.frame_count} frames analysed
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-[#55556a] hover:text-[#f0f0f5] transition-colors p-1"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: cfg.border }}>
          {/* WH Errors */}
          {audit.wh_errors.length > 0 && (
            <div className="pt-3">
              <p className="text-[9px] text-[#55556a] uppercase tracking-wider mb-2">Lỗi phát hiện ({audit.wh_errors.length})</p>
              <div className="space-y-1.5">
                {audit.wh_errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px]">
                    <span className={err.severity === 'CRITICAL' ? 'text-[#f87171]' : 'text-[#fcd34d]'} style={{ flexShrink: 0 }}>
                      {err.severity === 'CRITICAL' ? '🔴' : '🟡'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-[#f0f0f5]">{err.error_code}</span>
                      <span className="text-[#55556a] ml-1.5">({err.source})</span>
                      {err.description && <p className="text-[#8888a8] mt-0.5 leading-snug">{err.description}</p>}
                    </div>
                    <span className="text-[#44445a] flex-shrink-0">{Math.round(err.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event checklist */}
          {checklistPairs.length > 0 && (
            <div>
              <p className="text-[9px] text-[#55556a] uppercase tracking-wider mb-2">Evidence Checklist</p>
              <div className="grid grid-cols-2 gap-1">
                {checklistPairs.map(([key, val]) => {
                  const isPass = val === 'PASS' || val === 'NOT_REQUIRED'
                  const isFail = val === 'FAIL'
                  return (
                    <div key={key} className="flex items-center gap-1.5 text-[9px]">
                      <span className={isPass ? 'text-[#4ade80]' : isFail ? 'text-[#f87171]' : 'text-[#55556a]'}>
                        {isPass ? '✓' : isFail ? '✗' : '?'}
                      </span>
                      <span className="text-[#8888a8] truncate">{CHECKLIST_LABELS[key] ?? key}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quality components bar chart */}
          {qualityEntries.length > 0 && (
            <div>
              <p className="text-[9px] text-[#55556a] uppercase tracking-wider mb-2">Quality Components</p>
              <div className="space-y-1.5">
                {qualityEntries.map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-[#8888a8]">{k.replace(/_/g, ' ')}</span>
                      <span style={{ color: v >= 0.7 ? '#4ade80' : v >= 0.4 ? '#fcd34d' : '#f87171' }}>{Math.round(v * 100)}%</span>
                    </div>
                    <div className="h-1 bg-[#0a0a10] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${v * 100}%`,
                          backgroundColor: v >= 0.7 ? '#4ade80' : v >= 0.4 ? '#fcd34d' : '#f87171',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
        <div className="lg:col-span-2 space-y-4" style={{ minWidth: 0 }}>
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
                {job.results.map((r) => {
                  const matchedFrame = frames.find(f => Math.abs(f.frame_timestamp - r.timestamp) < 0.5)
                  return (
                    <div
                      key={r.timestamp}
                      className={`rounded-[10px] bg-[#111118] border border-[#1e1e2a] p-3 ${matchedFrame ? 'cursor-pointer hover:border-[#7c6af760]' : ''} transition-colors`}
                      onClick={() => matchedFrame && setSelected(matchedFrame)}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-medium text-[#8888a8]">
                          t={r.timestamp}s {matchedFrame && <span className="text-[#7c6af7]">↗</span>}
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
                  )
                })}
              </div>
            ) : (() => {
              const runs = aggregateRuns(frames)
              if (runs.length === 0) return (
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
              )
              return (
                <div className="space-y-2">
                  {runs.map((run) => (
                    <div key={run.job_id} className="rounded-[10px] bg-[#111118] border border-[#1e1e2a] p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-[#55556a]">
                          {run.timestamp ? new Date(run.timestamp).toLocaleString('vi-VN') : run.job_id}
                        </span>
                        <span className="text-[10px] text-[#4ade80]">{run.okCount}/{run.frameCount} frames OK</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-[#7c6af7] bg-[#7c6af710] px-1.5 py-0.5 rounded">{run.model || 'unknown model'}</span>
                        {run.okCount < run.frameCount && (
                          <span className="text-[9px] text-[#f87171]">{run.frameCount - run.okCount} lỗi</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
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

      {/* Audit Verdict Panel — full width */}
      {video.videoAudit && (
        <div>
          <h3 className="text-sm font-semibold text-[#f0f0f5] mb-3">Kết luận Video</h3>
          <AuditVerdictPanel audit={video.videoAudit} videoType={video.videoType} />
        </div>
      )}

      {/* Key Frames — full width below */}
      <div>
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
    </div>
  )
}
