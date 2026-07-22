import { useState } from 'react'
import { BarChart2, Filter } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockFeatures, mockFrames } from '@/services/mockData'
import type { Feature } from '@/types'

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span className={cn(
      'px-1.5 py-0.5 rounded text-[10px] font-medium',
      value ? 'bg-[#16a34a20] text-[#4ade80]' : 'bg-[#2a2a3a] text-[#8888a8]'
    )}>
      {value ? 'YES' : 'NO'}
    </span>
  )
}

function QualityBadge({ quality }: { quality: Feature['frameQuality'] }) {
  const cfg = {
    excellent: 'bg-[#16a34a20] text-[#4ade80]',
    good: 'bg-[#2563eb20] text-[#60a5fa]',
    fair: 'bg-[#d9770620] text-[#fbbf24]',
    poor: 'bg-[#dc262620] text-[#f87171]',
  }
  return <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium capitalize', cfg[quality])}>{quality}</span>
}

const comingSoon = ['Damage', 'Leak', 'Dent', 'Scratch', 'Seal']

export function FeatureExplorer() {
  const [filterTracking, setFilterTracking] = useState<string>('all')
  const [filterQuality, setFilterQuality] = useState<string>('all')
  const [filterBlurMax, setFilterBlurMax] = useState<number>(100)

  const filtered = mockFeatures.filter(f => {
    if (filterTracking === 'yes' && !f.trackingFound) return false
    if (filterTracking === 'no' && f.trackingFound) return false
    if (filterQuality !== 'all' && f.frameQuality !== filterQuality) return false
    if (f.blurScore > filterBlurMax) return false
    return true
  })

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[#7c6af720] flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-[#a89bff]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#f0f0f5]">Feature Explorer</h1>
          <p className="text-xs text-[#8888a8]">{filtered.length} frames with feature data</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-[#8888a8]" />
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8888a8]">Max Blur:</span>
          <input
            type="range"
            min={0}
            max={100}
            value={filterBlurMax}
            onChange={e => setFilterBlurMax(Number(e.target.value))}
            className="w-24 accent-[#7c6af7]"
          />
          <span className="text-xs text-[#f0f0f5] w-6">{filterBlurMax}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(feat => {
          const frame = mockFrames.find(f => f.id === feat.frameId)
          return <FeatureCard key={feat.id} feature={feat} thumbUrl={frame?.thumbnailUrl} />
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-[#55556a]">No features match selected filters.</div>
        )}
      </div>

      {/* Coming soon section */}
      <div className="pt-4">
        <h2 className="text-sm font-semibold text-[#55556a] mb-3">Future Features (Coming Soon)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {comingSoon.map(name => (
            <div
              key={name}
              className="bg-[#0d0d14] border border-dashed border-[#2a2a3a] rounded-[10px] p-4 flex flex-col items-center gap-2 opacity-50"
            >
              <div className="w-8 h-8 rounded-full bg-[#2a2a3a] flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-[#55556a]" />
              </div>
              <span className="text-xs text-[#55556a] font-medium">{name}</span>
              <span className="text-[10px] text-[#3a3a4a] bg-[#1a1a24] px-2 py-0.5 rounded-full">Soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ feature, thumbUrl }: { feature: Feature; thumbUrl?: string }) {
  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] overflow-hidden hover:border-[#2a2a3a] transition-colors">
      {/* Thumbnail */}
      <div className="aspect-video bg-[#1a1a24] overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt="frame" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#1a1a24]" />
        )}
      </div>

      {/* Feature grid */}
      <div className="p-3 grid grid-cols-2 gap-x-3 gap-y-2">
        <FeatureRow label="Tracking" value={<YesNoBadge value={feature.trackingFound} />} />
        <FeatureRow label="Barcode" value={<YesNoBadge value={feature.barcodeFound} />} />
        <FeatureRow label="Packaging" value={<span className="text-[10px] text-[#c0c0d0]">{feature.packagingType}</span>} />
        <FeatureRow label="OCR Conf" value={<span className="text-[10px] text-[#f0f0f5]">{feature.ocrConfidence}%</span>} />
        <FeatureRow label="Blur" value={<span className="text-[10px] text-[#f0f0f5]">{feature.blurScore}%</span>} />
        <FeatureRow label="Brightness" value={<span className="text-[10px] capitalize text-[#c0c0d0]">{feature.brightness}</span>} />
        <FeatureRow label="Quality" value={<QualityBadge quality={feature.frameQuality} />} />
        <FeatureRow label="Rotation" value={<span className="text-[10px] text-[#c0c0d0]">{feature.rotation}°</span>} />
        <FeatureRow label="Duplicate" value={<YesNoBadge value={feature.isDuplicate} />} />
      </div>
    </div>
  )
}

function FeatureRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wide text-[#55556a]">{label}</span>
      <div>{value}</div>
    </div>
  )
}
