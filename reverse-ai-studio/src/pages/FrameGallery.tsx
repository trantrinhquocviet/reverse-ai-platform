import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Images, Filter, Trash2, Eye, Edit3 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockFrames } from '@/services/mockData'
import type { Frame } from '@/types'

function QualityBadge({ quality }: { quality: Frame['frameQuality'] }) {
  const cfg = {
    excellent: 'bg-[#16a34a20] text-[#4ade80]',
    good: 'bg-[#2563eb20] text-[#60a5fa]',
    fair: 'bg-[#d97706 20] text-[#fbbf24]',
    poor: 'bg-[#dc262620] text-[#f87171]',
  }
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium capitalize', cfg[quality])}>
      {quality}
    </span>
  )
}

function OcrBadge({ status }: { status: Frame['ocrStatus'] }) {
  const cfg = {
    found: 'bg-[#16a34a20] text-[#4ade80]',
    not_found: 'bg-[#2a2a3a] text-[#8888a8]',
    error: 'bg-[#dc262620] text-[#f87171]',
  }
  const label = { found: 'OCR ✓', not_found: 'No OCR', error: 'OCR Err' }
  return <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', cfg[status])}>{label[status]}</span>
}

export function FrameGallery() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const [filterOcr, setFilterOcr] = useState<string>('all')
  const [filterTracking, setFilterTracking] = useState<string>('all')
  const [filterQuality, setFilterQuality] = useState<string>('all')

  const frames = mockFrames.filter(f => f.jobId === jobId)

  const filtered = frames.filter(f => {
    if (filterOcr !== 'all' && f.ocrStatus !== filterOcr) return false
    if (filterTracking === 'yes' && !f.trackingFound) return false
    if (filterTracking === 'no' && f.trackingFound) return false
    if (filterQuality !== 'all' && f.frameQuality !== filterQuality) return false
    return true
  })

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/ai-processing/${jobId}`)}
          className="p-2 rounded-[8px] text-[#55556a] hover:text-[#f0f0f5] hover:bg-[#ffffff08] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Images className="w-5 h-5 text-[#a89bff]" />
          <h1 className="text-lg font-bold text-[#f0f0f5]">Frame Gallery</h1>
        </div>
        <span className="ml-2 text-sm text-[#8888a8]">{filtered.length} frames shown</span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-[#8888a8]">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>
        <select
          value={filterOcr}
          onChange={e => setFilterOcr(e.target.value)}
          className="bg-[#1a1a24] border border-[#2a2a3a] text-[#f0f0f5] text-xs rounded-[6px] px-2.5 py-1.5 outline-none"
        >
          <option value="all">All OCR</option>
          <option value="found">Found</option>
          <option value="not_found">Not Found</option>
          <option value="error">Error</option>
        </select>
        <select
          value={filterTracking}
          onChange={e => setFilterTracking(e.target.value)}
          className="bg-[#1a1a24] border border-[#2a2a3a] text-[#f0f0f5] text-xs rounded-[6px] px-2.5 py-1.5 outline-none"
        >
          <option value="all">All Tracking</option>
          <option value="yes">Tracking Found</option>
          <option value="no">No Tracking</option>
        </select>
        <select
          value={filterQuality}
          onChange={e => setFilterQuality(e.target.value)}
          className="bg-[#1a1a24] border border-[#2a2a3a] text-[#f0f0f5] text-xs rounded-[6px] px-2.5 py-1.5 outline-none"
        >
          <option value="all">All Quality</option>
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map((frame) => (
          <FrameCard key={frame.id} frame={frame} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-[#55556a]">No frames match the selected filters.</div>
        )}
      </div>
    </div>
  )
}

function FrameCard({ frame }: { frame: Frame }) {
  const navigate = useNavigate()

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[10px] overflow-hidden group hover:border-[#7c6af7] transition-colors">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-[#1a1a24] overflow-hidden">
        <img
          src={frame.thumbnailUrl}
          alt={`Frame ${frame.id}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {frame.isDuplicate && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-[#0d0d14]/80 rounded text-[10px] text-[#fbbf24]">
            DUP
          </span>
        )}
        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button className="p-1.5 bg-[#7c6af7] rounded-[6px] hover:bg-[#6b5ae6]" title="Open">
            <Eye className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            className="p-1.5 bg-[#2563eb] rounded-[6px] hover:bg-[#1d4ed8]"
            title="Annotate"
            onClick={() => navigate(`/annotation/${frame.id}`)}
          >
            <Edit3 className="w-3.5 h-3.5 text-white" />
          </button>
          <button className="p-1.5 bg-[#dc2626] rounded-[6px] hover:bg-[#b91c1c]" title="Delete">
            <Trash2 className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1.5">
        <p className="text-[11px] text-[#8888a8] font-mono">{frame.timestamp}</p>
        <div className="flex flex-wrap gap-1">
          <OcrBadge status={frame.ocrStatus} />
          <QualityBadge quality={frame.frameQuality} />
        </div>
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded',
            frame.trackingFound ? 'bg-[#16a34a20] text-[#4ade80]' : 'bg-[#2a2a3a] text-[#55556a]'
          )}>
            {frame.trackingFound ? 'Tracked' : 'No Track'}
          </span>
          <span className="text-[10px] text-[#55556a]">Blur: {frame.blurScore}</span>
        </div>
      </div>
    </div>
  )
}
