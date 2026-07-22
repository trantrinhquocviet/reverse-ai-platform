import { useState } from 'react'
import { Search, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockAIAnnotationSuggestions, mockDatasetQualityScore } from '@/services/mockData'

// Build synthetic dataset records from suggestions
const WAREHOUSES = ['WH-Central','WH-North','WH-South','WH-East','WH-West']
const BRANDS     = ['Nike','Adidas','Puma','New Balance','Under Armour','Reebok']
const PACKAGING  = ['Carton Box','Poly Bag','Blister Pack','Envelope','Tube']
const REVIEWERS  = ['Viet Tran','Lan Nguyen','Minh Le']

interface ExplorerRecord {
  frameId: string
  trackingCode: string
  warehouse: string
  brand: string
  packaging: string
  ocrSnippet: string
  confidence: number
  reviewer: string
  date: string
  suggestionCount: number
}

const records: ExplorerRecord[] = Array.from({ length: 20 }, (_, i) => {
  const frameId = `f${i + 1}`
  const suggestions = mockAIAnnotationSuggestions.filter(s => s.frameId === frameId)
  const avgConf = suggestions.length
    ? Math.round(suggestions.reduce((a, s) => a + s.confidence, 0) / suggestions.length)
    : Math.floor(60 + Math.random() * 40)
  return {
    frameId,
    trackingCode: `SPX00${String(i + 1).padStart(10, '0')}`,
    warehouse:    WAREHOUSES[i % WAREHOUSES.length],
    brand:        BRANDS[i % BRANDS.length],
    packaging:    PACKAGING[i % PACKAGING.length],
    ocrSnippet:   `SPXVN0${String(12345678 + i * 7)}`,
    confidence:   avgConf,
    reviewer:     REVIEWERS[i % REVIEWERS.length],
    date:         `2026-07-${String(15 + (i % 7)).padStart(2, '0')}`,
    suggestionCount: suggestions.length || 1,
  }
})

export function DatasetExplorer() {
  const [searchCode,  setSearchCode]  = useState('')
  const [searchOCR,   setSearchOCR]   = useState('')
  const [warehouseF,  setWarehouseF]  = useState('all')
  const [brandF,      setBrandF]      = useState('all')
  const [packagingF,  setPackagingF]  = useState('all')
  const [reviewerF,   setReviewerF]   = useState('all')
  const [sortBy,      setSortBy]      = useState<'confidence' | 'date' | 'quality'>('confidence')
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [confMin,     setConfMin]     = useState(0)

  const quality = mockDatasetQualityScore

  const filtered = records.filter(r => {
    if (searchCode   && !r.trackingCode.toLowerCase().includes(searchCode.toLowerCase())) return false
    if (searchOCR    && !r.ocrSnippet.toLowerCase().includes(searchOCR.toLowerCase())) return false
    if (warehouseF !== 'all' && r.warehouse !== warehouseF) return false
    if (brandF     !== 'all' && r.brand     !== brandF)     return false
    if (packagingF !== 'all' && r.packaging !== packagingF) return false
    if (reviewerF  !== 'all' && r.reviewer  !== reviewerF)  return false
    if (r.confidence < confMin) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'confidence') return b.confidence - a.confidence
    if (sortBy === 'date') return b.date.localeCompare(a.date)
    return b.confidence - a.confidence
  })

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar filter */}
      <div className="w-56 flex-shrink-0 border-r border-[#1e1e2a] bg-[#0d0d14] p-4 overflow-y-auto space-y-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#55556a]" />
          <span className="text-xs font-semibold text-[#8888a8] uppercase tracking-wider">Filters</span>
        </div>
        <div>
          <label className="text-[10px] text-[#55556a] block mb-1">Tracking Code</label>
          <input value={searchCode} onChange={e => setSearchCode(e.target.value)}
            className="w-full bg-[#12121c] border border-[#1e1e2a] rounded px-2 py-1.5 text-xs text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]" placeholder="SPX..." />
        </div>
        <div>
          <label className="text-[10px] text-[#55556a] block mb-1">OCR Text</label>
          <input value={searchOCR} onChange={e => setSearchOCR(e.target.value)}
            className="w-full bg-[#12121c] border border-[#1e1e2a] rounded px-2 py-1.5 text-xs text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]" placeholder="Search OCR..." />
        </div>
        {[
          { label: 'Warehouse', value: warehouseF, set: setWarehouseF, opts: WAREHOUSES },
          { label: 'Brand',     value: brandF,     set: setBrandF,     opts: BRANDS     },
          { label: 'Packaging', value: packagingF, set: setPackagingF, opts: PACKAGING  },
          { label: 'Reviewer',  value: reviewerF,  set: setReviewerF,  opts: REVIEWERS  },
        ].map(f => (
          <div key={f.label}>
            <label className="text-[10px] text-[#55556a] block mb-1">{f.label}</label>
            <select value={f.value} onChange={e => f.set(e.target.value)}
              className="w-full bg-[#12121c] border border-[#1e1e2a] rounded px-2 py-1.5 text-xs text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]">
              <option value="all">All</option>
              {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div>
          <label className="text-[10px] text-[#55556a] block mb-1">Min Confidence: {confMin}%</label>
          <input type="range" min={0} max={100} value={confMin} onChange={e => setConfMin(+e.target.value)}
            className="w-full accent-[#7c6af7]" />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Quality score bar */}
        <div className="flex items-center gap-6 px-6 py-3 border-b border-[#1e1e2a] bg-[#0d0d14]">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#a89bff]" />
            <span className="text-sm font-bold text-[#f0f0f5]">Dataset Explorer</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {[
              { label: 'Images',    value: quality.totalImages.toLocaleString() },
              { label: 'Blur %',    value: `${quality.blurPercent}%` },
              { label: 'Dupes %',   value: `${quality.duplicatesPercent}%` },
              { label: 'Score',     value: `${quality.overallScore}`, color: quality.overallScore >= 90 ? 'text-[#4ade80]' : 'text-[#fbbf24]' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 text-[#55556a]">
                {s.label}: <span className={cn('font-semibold text-[#f0f0f5]', s.color)}>{s.value}</span>
              </div>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-[#55556a]">{filtered.length} results · Sort by:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="bg-[#12121c] border border-[#1e1e2a] rounded px-2 py-1 text-xs text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]">
              <option value="confidence">Confidence</option>
              <option value="date">Date</option>
              <option value="quality">Quality</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(record => {
              const expanded = expandedId === record.frameId
              return (
                <div
                  key={record.frameId}
                  className={cn('bg-[#12121c] border rounded-xl overflow-hidden transition-all cursor-pointer', expanded ? 'border-[#7c6af7]' : 'border-[#1e1e2a] hover:border-[#2e2e3a]')}
                  onClick={() => setExpandedId(expanded ? null : record.frameId)}
                >
                  {/* Thumbnail */}
                  <div className="w-full aspect-video bg-[#1a1a28] flex items-center justify-center relative group">
                    <span className="text-[10px] text-[#2e2e3a] font-mono">{record.frameId}</span>
                    <div className={cn('absolute inset-0 bg-[#7c6af710] flex items-center justify-center transition-opacity', expanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                      {expanded ? <ChevronUp className="w-5 h-5 text-[#a89bff]" /> : <ChevronDown className="w-5 h-5 text-[#a89bff]" />}
                    </div>
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#a89bff] truncate">{record.trackingCode}</span>
                      <span className={cn('text-[10px] font-bold', record.confidence >= 90 ? 'text-[#4ade80]' : record.confidence >= 70 ? 'text-[#fbbf24]' : 'text-[#f87171]')}>
                        {record.confidence}%
                      </span>
                    </div>
                    <div className="text-[10px] text-[#55556a] font-mono truncate">{record.ocrSnippet}</div>
                    <div className="text-[10px] text-[#55556a] truncate">{record.reviewer} · {record.date}</div>

                    {/* Expanded details */}
                    {expanded && (
                      <div className="mt-2 pt-2 border-t border-[#1e1e2a] space-y-1.5">
                        {[
                          { l: 'Warehouse', v: record.warehouse },
                          { l: 'Brand',     v: record.brand },
                          { l: 'Packaging', v: record.packaging },
                          { l: 'AI Suggestions', v: record.suggestionCount },
                        ].map(r => (
                          <div key={r.l} className="flex items-center justify-between text-[10px]">
                            <span className="text-[#55556a]">{r.l}</span>
                            <span className="text-[#f0f0f5]">{r.v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="w-10 h-10 text-[#2e2e3a] mb-3" />
              <p className="text-[#55556a]">No results match your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
