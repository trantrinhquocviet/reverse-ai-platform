import { Database, Layers, Download, Upload } from 'lucide-react'
import { useDatasetStats, useDatasetImages } from '@/hooks/useDataset'
import { StatCard } from '@/components/StatCard'
import { DatasetStatusBadge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { formatDate } from '@/utils/formatters'

export function Dataset() {
  const { data: stats, isLoading: statsLoading } = useDatasetStats()
  const { data: images, isLoading: imagesLoading } = useDatasetImages()

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f5]">Dataset</h1>
          <p className="text-sm text-[#8888a8] mt-0.5">Manage your training and validation images</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" leftIcon={<Upload className="w-4 h-4" />}>Import</Button>
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>Export</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-[14px]" />
          ))
        ) : stats ? (
          <>
            <StatCard
              title="Total Images"
              value={stats.totalImages.toLocaleString()}
              icon={Database}
              iconColor="text-[#a89bff]"
              iconBg="bg-[#7c6af720]"
            />
            <StatCard
              title="Training Images"
              value={stats.trainingImages.toLocaleString()}
              subtitle={`${Math.round((stats.trainingImages / stats.totalImages) * 100)}% of total`}
              icon={Layers}
              iconColor="text-[#4ade80]"
              iconBg="bg-[#22c55e20]"
              progress={(stats.trainingImages / stats.totalImages) * 100}
            />
            <StatCard
              title="Validation Images"
              value={stats.validationImages.toLocaleString()}
              subtitle={`${Math.round((stats.validationImages / stats.totalImages) * 100)}% of total`}
              icon={Layers}
              iconColor="text-[#60a5fa]"
              iconBg="bg-[#3b82f620]"
              progress={(stats.validationImages / stats.totalImages) * 100}
            />
          </>
        ) : null}
      </div>

      {/* Images table */}
      <div className="rounded-[14px] border border-[#1e1e2a] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e2a] bg-[#111118] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#f0f0f5]">Images</h3>
          <span className="text-xs text-[#55556a]">{images?.length ?? 0} items</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2a] bg-[#0d0d14]">
              {['Preview', 'Image Name', 'Source Video', 'Status', 'Created Date'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#8888a8]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {imagesLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-[#1e1e2a]">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 skeleton rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : images?.map((image, i) => (
              <tr
                key={image.id}
                className={`border-b border-[#1e1e2a] hover:bg-[#ffffff03] transition-colors ${i === images.length - 1 ? 'border-b-0' : ''}`}
              >
                <td className="px-4 py-3">
                  <img
                    src={image.preview}
                    alt={image.name}
                    className="w-14 h-10 object-cover rounded-[6px]"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-[#f0f0f5]">{image.name}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-[#8888a8] max-w-[200px] truncate block">{image.sourceVideo}</span>
                </td>
                <td className="px-4 py-3">
                  <DatasetStatusBadge status={image.status} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-[#8888a8]">{formatDate(image.createdDate)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
