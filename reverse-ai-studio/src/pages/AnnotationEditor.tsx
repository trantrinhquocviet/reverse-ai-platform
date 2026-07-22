import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Square, Hexagon, ZoomIn, ZoomOut, Move, RotateCcw, Sun, Contrast,
  Grid3X3, Undo2, Redo2, Save, Check, X, RotateCcw as Rollback, ChevronRight,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockAIAnnotationSuggestions, mockAnnotationHistory } from '@/services/mockData'
import type { TrackingLabelType } from '@/types'

const LABEL_COLORS: Record<TrackingLabelType, string> = {
  TrackingLabel:  '#a89bff',
  Barcode:        '#60a5fa',
  QRCode:         '#34d399',
  ProductRegion:  '#f59e0b',
  Packaging:      '#f97316',
  PossibleDamage: '#f87171',
  OCRRegion:      '#e879f9',
}

const ALL_LABELS: TrackingLabelType[] = ['TrackingLabel','Barcode','QRCode','ProductRegion','Packaging','PossibleDamage','OCRRegion']

export function AnnotationEditor() {
  const { frameId } = useParams<{ frameId: string }>()
  const navigate = useNavigate()
  const suggestions = mockAIAnnotationSuggestions.filter(s => s.frameId === frameId)
  const history = mockAnnotationHistory.filter(h => h.frameId === frameId).slice(0, 3)

  const [selectedId, setSelectedId] = useState<string | null>(suggestions[0]?.id ?? null)
  const [showGrid, setShowGrid] = useState(false)
  const [ocrText, setOcrText] = useState('SPXVN0123456789')
  const [activeTool, setActiveTool] = useState<string>('bbox')
  const [filterLabel, setFilterLabel] = useState<TrackingLabelType | null>(null)

  const selected = suggestions.find(s => s.id === selectedId)
  const visibleSuggestions = filterLabel ? suggestions.filter(s => s.label === filterLabel) : suggestions

  const CANVAS_W = 600
  const CANVAS_H = 400

  return (
    <div className="flex flex-col h-full bg-[#0a0a10] overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#1e1e2a] bg-[#0d0d14] flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded text-[#55556a] hover:text-[#f0f0f5] hover:bg-[#1e1e2a] mr-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-[#f0f0f5] mr-4">Frame: {frameId}</span>

        {/* Tool buttons */}
        {[
          { id: 'bbox', icon: Square,    label: 'Bounding Box (B)' },
          { id: 'poly', icon: Hexagon,   label: 'Polygon (P)' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)} title={t.label}
            className={cn('p-1.5 rounded transition-colors', activeTool === t.id ? 'bg-[#7c6af7] text-white' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
            <t.icon className="w-4 h-4" />
          </button>
        ))}
        <div className="w-px h-5 bg-[#1e1e2a] mx-1" />
        {[
          { id: 'zoom-in',  icon: ZoomIn,    label: 'Zoom In (+)' },
          { id: 'zoom-out', icon: ZoomOut,   label: 'Zoom Out (-)' },
          { id: 'pan',      icon: Move,      label: 'Pan (Space)' },
          { id: 'rotate',   icon: RotateCcw, label: 'Rotate (R)' },
          { id: 'bright',   icon: Sun,       label: 'Brightness' },
          { id: 'contrast', icon: Contrast,  label: 'Contrast' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)} title={t.label}
            className={cn('p-1.5 rounded transition-colors', activeTool === t.id ? 'bg-[#7c6af7] text-white' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
            <t.icon className="w-4 h-4" />
          </button>
        ))}
        <div className="w-px h-5 bg-[#1e1e2a] mx-1" />
        <button onClick={() => setShowGrid(g => !g)} title="Toggle Grid (G)"
          className={cn('p-1.5 rounded transition-colors', showGrid ? 'bg-[#7c6af7] text-white' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}>
          <Grid3X3 className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
        <button className="p-1.5 rounded text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]" title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#4ade80] flex items-center gap-1"><Save className="w-3 h-3" /> Auto Save ON</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — labels */}
        <div className="w-40 flex-shrink-0 border-r border-[#1e1e2a] bg-[#0d0d14] p-3 space-y-1 overflow-y-auto">
          <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-2">Labels</p>
          <button
            onClick={() => setFilterLabel(null)}
            className={cn('w-full text-left px-2 py-1.5 rounded text-xs transition-colors', filterLabel === null ? 'bg-[#7c6af720] text-[#a89bff]' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}
          >
            All Labels
          </button>
          {ALL_LABELS.map(label => (
            <button
              key={label}
              onClick={() => setFilterLabel(l => l === label ? null : label)}
              className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors', filterLabel === label ? 'bg-[#1e1e2a] text-[#f0f0f5]' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#1e1e2a]')}
            >
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: LABEL_COLORS[label] }} />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* Center — canvas */}
        <div className="flex-1 flex items-center justify-center bg-[#060609] overflow-hidden relative">
          <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
            {/* Gray placeholder frame */}
            <div className="w-full h-full bg-[#1a1a28] rounded-lg flex items-center justify-center">
              <span className="text-[#2e2e3a] text-sm font-mono">Frame {frameId} · 1920×1080</span>
            </div>

            {/* Grid overlay */}
            {showGrid && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                {Array.from({ length: 10 }, (_, i) => (
                  <line key={`v${i}`} x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="#a89bff" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 7 }, (_, i) => (
                  <line key={`h${i}`} x1="0" y1={`${i * 14.28}%`} x2="100%" y2={`${i * 14.28}%`} stroke="#a89bff" strokeWidth="0.5" />
                ))}
              </svg>
            )}

            {/* Bounding boxes */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {visibleSuggestions.map(s => {
                const scaleX = CANVAS_W / 500
                const scaleY = CANVAS_H / 350
                const x = s.boundingBox.x * scaleX
                const y = s.boundingBox.y * scaleY
                const w = s.boundingBox.width  * scaleX
                const h = s.boundingBox.height * scaleY
                const color = LABEL_COLORS[s.label]
                const isSelected = s.id === selectedId
                return (
                  <g key={s.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => setSelectedId(s.id)}>
                    <rect
                      x={x} y={y} width={w} height={h}
                      fill={`${color}15`}
                      stroke={color}
                      strokeWidth={isSelected ? 2 : 1}
                      strokeDasharray={isSelected ? undefined : '4 2'}
                    />
                    <rect x={x} y={y - 16} width={Math.max(w, 80)} height={16} fill={color} rx={2} />
                    <text x={x + 4} y={y - 4} fill="white" fontSize={10} fontFamily="monospace">
                      {s.label} {s.confidence}%
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 flex-shrink-0 border-l border-[#1e1e2a] bg-[#0d0d14] overflow-y-auto flex flex-col">
          {/* Selected annotation details */}
          <div className="p-4 border-b border-[#1e1e2a]">
            <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-3">Selected Annotation</p>
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8888a8]">Label</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: `${LABEL_COLORS[selected.label]}20`, color: LABEL_COLORS[selected.label] }}>
                    {selected.label}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-[#8888a8] mb-1">
                    <span>Confidence</span><span className="text-[#f0f0f5] font-mono">{selected.confidence}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1e1e2a]">
                    <div className="h-full rounded-full bg-[#7c6af7]" style={{ width: `${selected.confidence}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-[#55556a] mb-1">AI Reason</p>
                  <p className="text-xs text-[#8888a8] leading-relaxed">{selected.reason}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#55556a]">Click a bounding box to select</p>
            )}
          </div>

          {/* OCR Editor */}
          <div className="p-4 border-b border-[#1e1e2a]">
            <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-3">OCR Editor</p>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-[#55556a] mb-1">Original OCR</p>
                <div className="font-mono text-xs bg-[#1a1a28] rounded px-2 py-1.5 text-[#a89bff]">
                  SPXVN01<span className="bg-[#f59e0b30] text-[#fbbf24]">2</span>3456789
                </div>
              </div>
              <div>
                <p className="text-[10px] text-[#55556a] mb-1">Edit</p>
                <input
                  value={ocrText}
                  onChange={e => setOcrText(e.target.value)}
                  className="w-full bg-[#0d0d14] border border-[#1e1e2a] rounded px-2 py-1.5 text-xs text-[#f0f0f5] font-mono focus:outline-none focus:border-[#7c6af7]"
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#55556a]">
                <span>OCR Confidence: <span className="text-[#fbbf24]">74%</span></span>
                <button className="text-[#a89bff] hover:underline">Save OCR</button>
              </div>
            </div>
          </div>

          {/* AI Explainability */}
          <div className="p-4 border-b border-[#1e1e2a]">
            <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-3">AI Explainability</p>
            <ul className="space-y-2">
              {[
                'High-contrast region consistent with label printing',
                'Font metrics match known carrier template (SPX v3)',
                'Spatial context: adjacent barcode increases confidence',
              ].map((point, i) => (
                <li key={i} className="flex gap-2 text-xs text-[#8888a8]">
                  <ChevronRight className="w-3 h-3 text-[#7c6af7] flex-shrink-0 mt-0.5" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Annotation History */}
          <div className="p-4 flex-1">
            <p className="text-[10px] text-[#55556a] uppercase tracking-wider mb-3">Annotation History</p>
            {history.length === 0 ? (
              <p className="text-xs text-[#55556a]">No history for this frame.</p>
            ) : (
              <div className="space-y-3">
                {history.map(h => (
                  <div key={h.id} className="flex gap-2 text-xs">
                    <div className="flex flex-col items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] mt-1" />
                      <div className="w-px flex-1 bg-[#1e1e2a] mt-1" />
                    </div>
                    <div className="pb-2">
                      <span className="capitalize text-[#f0f0f5] font-medium">{h.action}</span>
                      <span className="text-[#55556a]"> by {h.reviewer}</span>
                      <p className="text-[10px] text-[#55556a] mt-0.5">{new Date(h.timestamp).toLocaleString()}</p>
                      <button className="mt-1 flex items-center gap-1 text-[10px] text-[#a89bff] hover:underline">
                        <Rollback className="w-2.5 h-2.5" /> Rollback
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-[#1e1e2a] bg-[#0d0d14] flex-shrink-0">
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16a34a20] text-[#4ade80] text-sm font-medium hover:bg-[#16a34a40] transition-colors">
            <Check className="w-4 h-4" /> Approve All
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dc262620] text-[#f87171] text-sm font-medium hover:bg-[#dc262640] transition-colors">
            <X className="w-4 h-4" /> Reject All
          </button>
        </div>
        <button className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#7c6af7] text-white text-sm font-medium hover:bg-[#6b5ce7] transition-colors">
          <Save className="w-4 h-4" /> Save
        </button>
      </div>
    </div>
  )
}
