import { useState } from 'react'
import { Database, Download, CheckCircle, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockDatasetRecord, mockDatasetVersions } from '@/services/mockData'
import type { DatasetFormat } from '@/types'

const exportFormats: DatasetFormat[] = ['YOLO', 'COCO', 'PascalVOC', 'JSON', 'CSV']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-[#1a1a24] border border-[#7c6af7] rounded-[10px] px-4 py-3 shadow-xl z-50 animate-in slide-in-from-bottom-4">
      <CheckCircle className="w-4 h-4 text-[#4ade80] flex-shrink-0" />
      <span className="text-sm text-[#f0f0f5]">{message}</span>
      <button onClick={onClose} className="text-[#55556a] hover:text-[#f0f0f5] ml-2">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function DatasetManager() {
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (format: string) => {
    setToast(`Export Started — ${format} format is being prepared. You'll be notified when ready.`)
    setTimeout(() => setToast(null), 4000)
  }

  const ds = mockDatasetRecord

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[#7c6af720] flex items-center justify-center">
          <Database className="w-5 h-5 text-[#a89bff]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#f0f0f5]">{ds.name}</h1>
          <p className="text-xs text-[#8888a8]">Current version: {ds.version} · Created {formatDate(ds.createdAt)}</p>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Training Images', value: ds.trainingImages.toLocaleString(), color: 'text-[#4ade80]', bg: 'bg-[#16a34a20]' },
          { label: 'Validation Images', value: ds.validationImages.toLocaleString(), color: 'text-[#60a5fa]', bg: 'bg-[#2563eb20]' },
          { label: 'Rejected', value: ds.rejectedImages.toLocaleString(), color: 'text-[#f87171]', bg: 'bg-[#dc262620]' },
          { label: 'Pending Review', value: ds.pendingReview.toLocaleString(), color: 'text-[#fbbf24]', bg: 'bg-[#d9770620]' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] p-4">
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-[#8888a8] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Dataset Versions */}
        <div className="col-span-3 bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e2a]">
            <h2 className="text-sm font-semibold text-[#f0f0f5]">Dataset Versions</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2a]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#55556a]">Version</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#55556a]">Format</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#55556a]">Exported</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#55556a]">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#55556a]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2a]">
              {mockDatasetVersions.map(ver => (
                <tr key={ver.id} className="hover:bg-[#ffffff04]">
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded bg-[#7c6af720] text-[#a89bff] text-xs font-bold">{ver.version}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-[#f0f0f5] font-mono">{ver.format}</td>
                  <td className="px-5 py-3 text-xs text-[#8888a8]">{formatDate(ver.exportedAt)}</td>
                  <td className="px-5 py-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      ver.status === 'ready' ? 'bg-[#16a34a20] text-[#4ade80]' :
                      ver.status === 'processing' ? 'bg-[#7c6af720] text-[#a89bff]' :
                      'bg-[#dc262620] text-[#f87171]'
                    )}>{ver.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <button className="flex items-center gap-1 px-2.5 py-1 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-[#8888a8] hover:text-[#f0f0f5] text-xs rounded-[6px] transition-colors">
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Changelog */}
          <div className="px-5 py-4 border-t border-[#1e1e2a] space-y-3">
            <h3 className="text-xs font-semibold text-[#f0f0f5]">Version History</h3>
            {[...mockDatasetVersions].reverse().map(ver => (
              <div key={ver.id} className="flex gap-3">
                <span className="text-xs text-[#a89bff] font-mono font-bold w-6 flex-shrink-0">{ver.version}</span>
                <p className="text-xs text-[#8888a8]">{ver.changelog}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Export section */}
        <div className="col-span-2 bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] p-5">
          <h2 className="text-sm font-semibold text-[#f0f0f5] mb-1">Export Dataset</h2>
          <p className="text-xs text-[#55556a] mb-4">Choose a format to export the current dataset version.</p>

          <div className="space-y-2">
            {exportFormats.map(fmt => (
              <button
                key={fmt}
                onClick={() => showToast(fmt)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] hover:border-[#7c6af7] rounded-[8px] transition-colors group"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-[#f0f0f5]">{fmt}</p>
                  <p className="text-[10px] text-[#55556a]">
                    {fmt === 'YOLO' && 'YOLOv8 annotation format'}
                    {fmt === 'COCO' && 'Microsoft COCO JSON format'}
                    {fmt === 'PascalVOC' && 'Pascal VOC XML format'}
                    {fmt === 'JSON' && 'Raw JSON export'}
                    {fmt === 'CSV' && 'Flat CSV spreadsheet'}
                  </p>
                </div>
                <Download className="w-4 h-4 text-[#55556a] group-hover:text-[#a89bff] transition-colors" />
              </button>
            ))}
          </div>

          {/* Summary stats */}
          <div className="mt-5 pt-4 border-t border-[#1e1e2a] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#55556a]">Total Images</span>
              <span className="text-[#f0f0f5] font-medium">{ds.totalImages.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#55556a]">Train / Val Split</span>
              <span className="text-[#f0f0f5] font-medium">80 / 20</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#55556a]">Classes</span>
              <span className="text-[#f0f0f5] font-medium">6</span>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
