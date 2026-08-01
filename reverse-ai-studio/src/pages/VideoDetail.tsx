import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Film, Monitor, Calendar, Tag, Warehouse, Play, ScanLine, Barcode, Package, ShoppingCart, Star, CheckSquare, Pencil, Check, X } from 'lucide-react'
import { useVideo, useUpdateVideo } from '@/hooks/useVideos'
import { VideoStatusBadge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input, Select } from '@/components/Input'
import { formatDateTime } from '@/utils/formatters'
import { supabase } from '@/services/api'
import type { AIAnalysisResult } from '@/types'
import type { LucideIcon } from 'lucide-react'

const aiSections: { type: AIAnalysisResult['type']; icon: LucideIcon; description: string }[] = [
  { type: 'Tracking Code', icon: ScanLine, description: 'Scan & extract tracking codes from packages' },
  { type: 'Barcode', icon: Barcode, description: 'Detect and decode barcodes in video frames' },
  { type: 'SKU', icon: Tag, description: 'Identify product SKU codes from labels' },
  { type: 'OCR', icon: Film, description: 'Extract text from product labels and packaging' },
  { type: 'Packaging', icon: Package, description: 'Analyze packaging type and condition' },
  { type: 'Product', icon: ShoppingCart, description: 'Classify and identify products' },
  { type: 'Quality', icon: CheckSquare, description: 'Detect defects and quality issues' },
]

export function VideoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: video, isLoading } = useVideo(id ?? '')
  const updateVideo = useUpdateVideo()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', warehouse: '', brand: '' })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<string | null>(null)

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

  const startAiProcessing = async () => {
    if (!video || !id) return
    setAiLoading(true)
    setAiStatus(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/v1/videos/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ status: 'processing' }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      await supabase.from('videos').update({ status: 'processing' }).eq('id', id)
      setAiStatus('Đã gửi yêu cầu xử lý AI')
    } catch (e) {
      setAiStatus(`Lỗi: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setAiLoading(false)
    }
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
                  src={video.filePath}
                  controls
                  className="w-full h-full"
                  preload="metadata"
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
              <Button
                variant="outline"
                className="w-full"
                onClick={startAiProcessing}
                disabled={aiLoading || video.status === 'Processing'}
              >
                {aiLoading ? 'Đang gửi...' : 'Start AI Processing'}
              </Button>
              {aiStatus && (
                <p className="text-[10px] text-[#8888a8] text-center">{aiStatus}</p>
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
