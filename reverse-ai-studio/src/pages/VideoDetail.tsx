import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Film, Monitor, Calendar, Tag, Warehouse, Play, ScanLine, Barcode, Package, ShoppingCart, Star, CheckSquare } from 'lucide-react'
import { useVideo } from '@/hooks/useVideos'
import { VideoStatusBadge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { formatDateTime } from '@/utils/formatters'
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
      {/* Back button */}
      <button
        onClick={() => navigate('/videos')}
        className="flex items-center gap-2 text-sm text-[#8888a8] hover:text-[#f0f0f5] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Video Center
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: player + timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Player */}
          <div className="rounded-[14px] bg-[#111118] border border-[#1e1e2a] overflow-hidden">
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <img
                src={video.thumbnail}
                alt={video.name}
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <button className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Play className="w-7 h-7 text-white ml-1" />
                </button>
              </div>
              <div className="absolute top-3 right-3">
                <VideoStatusBadge status={video.status} />
              </div>
            </div>
            {/* Timeline */}
            <div className="p-4 border-t border-[#1e1e2a]">
              <p className="text-xs text-[#55556a] mb-2">Timeline</p>
              <div className="w-full h-1.5 bg-[#1a1a24] rounded-full overflow-hidden">
                <div className="h-full w-0 bg-[#7c6af7] rounded-full" />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-[#55556a] font-mono">0:00</span>
                <span className="text-[10px] text-[#55556a] font-mono">{video.duration}</span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button className="flex items-center gap-1.5 text-[10px] text-[#8888a8] hover:text-[#f0f0f5] transition-colors">
                  <Play className="w-3 h-3" /> Play
                </button>
              </div>
            </div>
          </div>

          {/* AI Analysis */}
          <div>
            <h3 className="text-sm font-semibold text-[#f0f0f5] mb-3">AI Analysis</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {aiSections.map(({ type, icon: Icon, description }) => (
                <div
                  key={type}
                  className="rounded-[12px] bg-[#111118] border border-[#1e1e2a] p-4 space-y-3"
                >
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

        {/* Right: metadata */}
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-[#f0f0f5] mb-4">Video Information</h3>
            <div className="space-y-3">
              {[
                { icon: Film, label: 'File Name', value: video.name },
                { icon: Warehouse, label: 'Warehouse', value: video.warehouse },
                { icon: Tag, label: 'Brand', value: video.brand },
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
                  <div className="mt-0.5">
                    <VideoStatusBadge status={video.status} />
                  </div>
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
              <Button variant="outline" className="w-full" disabled>
                Start AI Processing
              </Button>
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
