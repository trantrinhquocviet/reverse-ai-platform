import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Save, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockFrames, mockAnnotations, mockOCRResults } from '@/services/mockData'

const labelColors: Record<string, string> = {
  'Tracking Label': '#a89bff',
  'Barcode': '#fbbf24',
  'QR': '#34d399',
  'Product': '#60a5fa',
  'Packaging': '#f97316',
  'Quality': '#f472b6',
}

export function AnnotationTool() {
  const { frameId } = useParams<{ frameId: string }>()
  const navigate = useNavigate()

  const frame = mockFrames.find(f => f.id === frameId)
  const annotation = mockAnnotations.find(a => a.frameId === frameId)
  const ocr = mockOCRResults.find(o => o.frameId === frameId)

  const allLabels = ['Tracking Label', 'Barcode', 'QR', 'Product', 'Packaging', 'Quality']
  const [visibleLabels, setVisibleLabels] = useState<Set<string>>(new Set(allLabels))
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState<'idle' | 'approved' | 'rejected'>('idle')

  const toggleLabel = (label: string) => {
    setVisibleLabels(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!frame) {
    return (
      <div className="p-6 text-center text-[#8888a8]">
        Frame not found.{' '}
        <button onClick={() => navigate('/annotation-queue')} className="text-[#a89bff] underline">Back</button>
      </div>
    )
  }

  const boxes = annotation?.boundingBoxes ?? []

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Left: Image area */}
      <div className="flex-1 flex flex-col bg-[#0a0a0f]">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e2a]">
          <button
            onClick={() => navigate('/annotation-queue')}
            className="p-1.5 rounded-[6px] text-[#55556a] hover:text-[#f0f0f5] hover:bg-[#ffffff08] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-[#f0f0f5]">Annotation Tool</span>
          <span className="text-xs text-[#55556a] font-mono">{frame.id}</span>
          <div className="ml-auto flex items-center gap-2 text-[10px] text-[#55556a]">
            <kbd className="px-1.5 py-0.5 bg-[#1a1a24] border border-[#2a2a3a] rounded text-[#8888a8]">A</kbd> Approve
            <kbd className="px-1.5 py-0.5 bg-[#1a1a24] border border-[#2a2a3a] rounded text-[#8888a8]">R</kbd> Reject
            <kbd className="px-1.5 py-0.5 bg-[#1a1a24] border border-[#2a2a3a] rounded text-[#8888a8]">S</kbd> Save
            <kbd className="px-1.5 py-0.5 bg-[#1a1a24] border border-[#2a2a3a] rounded text-[#8888a8]">Esc</kbd> Back
          </div>
        </div>

        {/* Image with bounding boxes */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          <div className="relative max-w-[700px] w-full">
            <img
              src={frame.thumbnailUrl}
              alt="Frame"
              className="w-full rounded-[8px] select-none"
              draggable={false}
            />
            {/* SVG overlay for bounding boxes */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {boxes.map(box => {
                const label = box.label
                if (!visibleLabels.has(label)) return null
                const color = labelColors[label] ?? '#ffffff'
                // Normalize coordinates to percentage (assuming 640x360 frame)
                const x = (box.x / 640) * 100
                const y = (box.y / 360) * 100
                const w = (box.width / 640) * 100
                const h = (box.height / 360) * 100
                return (
                  <g key={box.id}>
                    <rect
                      x={x} y={y} width={w} height={h}
                      fill="transparent"
                      stroke={color}
                      strokeWidth="0.5"
                      strokeDasharray="2 1"
                    />
                    <rect
                      x={x} y={y - 4} width={w} height={4}
                      fill={color}
                      opacity={0.8}
                    />
                    <text
                      x={x + 0.5}
                      y={y - 0.8}
                      fontSize="2.5"
                      fill="#000"
                      fontWeight="bold"
                    >
                      {label.slice(0, 8)} {Math.round(box.confidence * 100)}%
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-72 bg-[#0d0d14] border-l border-[#1e1e2a] flex flex-col overflow-y-auto">
        {/* Detected Objects */}
        <div className="p-4 border-b border-[#1e1e2a]">
          <h3 className="text-xs font-semibold text-[#f0f0f5] mb-3">Detected Objects</h3>
          <div className="space-y-1.5">
            {allLabels.map(label => {
              const box = boxes.find(b => b.label === label)
              const isVisible = visibleLabels.has(label)
              const color = labelColors[label] ?? '#ffffff'
              return (
                <button
                  key={label}
                  onClick={() => toggleLabel(label)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] text-left transition-colors',
                    isVisible ? 'bg-[#1a1a24]' : 'opacity-40'
                  )}
                >
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="flex-1 text-xs text-[#f0f0f5]">{label}</span>
                  {box && <span className="text-[10px] text-[#8888a8]">{Math.round(box.confidence * 100)}%</span>}
                  {isVisible ? (
                    <Eye className="w-3 h-3 text-[#55556a]" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-[#55556a]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* OCR Result */}
        <div className="p-4 border-b border-[#1e1e2a]">
          <h3 className="text-xs font-semibold text-[#f0f0f5] mb-3">OCR Result</h3>
          {ocr ? (
            <div className="space-y-2">
              <div className="bg-[#1a1a24] rounded-[6px] p-2.5">
                <p className="text-[11px] text-[#c0c0d0] font-mono whitespace-pre-line">{ocr.detectedText}</p>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#55556a]">Confidence</span>
                <span className="text-[#4ade80] font-medium">{ocr.confidence}%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#55556a]">Status</span>
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px]',
                  ocr.status === 'verified' ? 'bg-[#16a34a20] text-[#4ade80]' :
                  ocr.status === 'failed' ? 'bg-[#dc262620] text-[#f87171]' :
                  'bg-[#f59e0b20] text-[#fbbf24]'
                )}>{ocr.status}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#55556a]">No OCR result for this frame.</p>
          )}
        </div>

        {/* Tracking */}
        <div className="p-4 border-b border-[#1e1e2a]">
          <h3 className="text-xs font-semibold text-[#f0f0f5] mb-3">Tracking Code</h3>
          {ocr?.trackingCode ? (
            <div className="space-y-2">
              <span className="px-2 py-0.5 rounded bg-[#7c6af720] text-[#a89bff] text-xs font-bold">{ocr.carrier}</span>
              <p className="text-sm text-[#f0f0f5] font-mono mt-1">{ocr.trackingCode}</p>
            </div>
          ) : (
            <p className="text-xs text-[#55556a]">No tracking code detected.</p>
          )}
        </div>

        {/* Bounding box coords */}
        {boxes.length > 0 && (
          <div className="p-4 border-b border-[#1e1e2a]">
            <h3 className="text-xs font-semibold text-[#f0f0f5] mb-3">Bounding Boxes</h3>
            <div className="space-y-1.5">
              {boxes.map(box => (
                <div key={box.id} className="bg-[#1a1a24] rounded-[6px] px-2.5 py-1.5">
                  <p className="text-[10px] font-medium text-[#a89bff]">{box.label}</p>
                  <p className="text-[10px] text-[#55556a] font-mono">
                    x:{box.x} y:{box.y} w:{box.width} h:{box.height}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 mt-auto space-y-2">
          <button
            onClick={handleSave}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2 rounded-[8px] text-sm font-medium transition-colors',
              saved
                ? 'bg-[#4ade80] text-[#0d0d14]'
                : 'bg-[#1a1a24] border border-[#2a2a3a] text-[#f0f0f5] hover:bg-[#2a2a3a]'
            )}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setStatus('approved')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-sm font-medium transition-colors',
                status === 'approved'
                  ? 'bg-[#16a34a] text-white'
                  : 'bg-[#16a34a20] text-[#4ade80] hover:bg-[#16a34a40]'
              )}
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => setStatus('rejected')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-sm font-medium transition-colors',
                status === 'rejected'
                  ? 'bg-[#dc2626] text-white'
                  : 'bg-[#dc262620] text-[#f87171] hover:bg-[#dc262640]'
              )}
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
