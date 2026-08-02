import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, CheckCircle, XCircle, Filter, Loader2, RefreshCw, ZoomIn, X, Pencil, Save, Video, ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import { supabase } from '@/services/api'

interface DetectedObject {
  label: string
  confidence: number
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
}

const OBJECT_EMOJI: Record<string, string> = {
  cardboard_box: '📦', shipping_label: '🏷️', barcode_1d: '📊', qr_code: '🔲',
  hand: '✋', tape_roll: '🧵', barcode_scanner: '📠', label_printer: '🖨️',
  knife_cutter: '🔪', keyboard: '⌨️', mouse: '🖱️', plastic_bag: '🟢',
  envelope: '✉️', package: '📦',
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
) {
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

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-[#ffffff15] hover:bg-[#ffffff25] text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-[8px]"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

function FrameCard({ frame, reviewerId, onReviewed }: {
  frame: DatasetFrame
  reviewerId: string
  onReviewed: () => void
}) {
  const queryClient = useQueryClient()
  const [localStatus, setLocalStatus] = useState(frame.review_status)
  const [lightbox, setLightbox] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTracking, setEditTracking] = useState((frame.ai_result?.tracking_codes ?? []).join('\n'))
  const [editBarcodes, setEditBarcodes] = useState((frame.ai_result?.barcodes ?? []).join('\n'))
  const [localAi, setLocalAi] = useState(frame.ai_result)

  const review = useMutation({
    mutationFn: (status: 'approved' | 'rejected') =>
      reviewFrame(frame.id, frame.annotation_id, status, reviewerId),
    onSuccess: (_, status) => {
      setLocalStatus(status)
      queryClient.invalidateQueries({ queryKey: ['annotation-frames'] })
      onReviewed()
    },
  })

  const saveEdit = useMutation({
    mutationFn: async () => {
      const updated = {
        ...localAi,
        tracking_codes: editTracking.split('\n').map(s => s.trim()).filter(Boolean),
        barcodes: editBarcodes.split('\n').map(s => s.trim()).filter(Boolean),
      }
      const { error } = await supabase.from('dataset_images').update({ ai_result: updated }).eq('id', frame.id)
      if (error) throw new Error(error.message)
      return updated
    },
    onSuccess: (updated) => {
      setLocalAi(updated)
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
        <Lightbox src={frame.file_path} alt={frame.image_name} onClose={() => setLightbox(false)} />
      )}
    <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] overflow-hidden hover:border-[#2a2a3a] transition-colors">
      {/* Frame image */}
      <div
        className="aspect-video bg-[#1a1a24] overflow-hidden relative group cursor-zoom-in"
        onClick={() => frame.file_path && setLightbox(true)}
      >
        {frame.file_path ? (
          <img src={frame.file_path} alt={frame.image_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#55556a] text-xs">No preview</div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="absolute top-2 left-2">
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
  const queryClient = useQueryClient()
  const dropdownRef = useRef<HTMLDivElement>(null)

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
        <button
          onClick={() => refetch()}
          className="p-2 rounded-[8px] hover:bg-[#ffffff08] text-[#8888a8] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
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

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#7c6af7] animate-spin" />
        </div>
      ) : frames.length === 0 ? (
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
          {frames.map(frame => (
            <FrameCard
              key={frame.id}
              frame={frame}
              reviewerId={reviewerId}
              onReviewed={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}
