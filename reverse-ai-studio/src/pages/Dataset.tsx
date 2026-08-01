import { useState } from 'react'
import { Database, Layers, Download, Shuffle, CheckCircle, Loader2, Image as ImageIcon } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StatCard } from '@/components/StatCard'
import { DatasetStatusBadge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { formatDate } from '@/utils/formatters'
import { supabase } from '@/services/api'
import JSZip from 'jszip'
import { cn } from '@/utils/cn'

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchStats() {
  const [total, train, val] = await Promise.all([
    supabase.from('dataset_images').select('*', { count: 'exact', head: true }),
    supabase.from('dataset_images').select('*', { count: 'exact', head: true }).eq('split_type', 'train'),
    supabase.from('dataset_images').select('*', { count: 'exact', head: true }).eq('split_type', 'val'),
  ])
  return {
    totalImages: total.count ?? 0,
    trainingImages: train.count ?? 0,
    validationImages: val.count ?? 0,
  }
}

async function fetchImages() {
  const { data } = await supabase
    .from('dataset_images')
    .select('*, annotations(status)')
    .order('created_at', { ascending: false })
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.image_name,
    preview: row.file_path,
    splitType: row.split_type,
    aiResult: row.ai_result,
    reviewStatus: row.annotations?.[0]?.status ?? 'pending',
    createdDate: row.created_at,
  }))
}

// ── Split train/val 80/20 ─────────────────────────────────────────────────────
async function splitDataset() {
  const { data, error } = await supabase
    .from('dataset_images')
    .select('id, annotations(status)')
  if (error) throw new Error(error.message)

  const approved = (data ?? []).filter((r: any) => r.annotations?.[0]?.status === 'approved')
  const shuffled = [...approved].sort(() => Math.random() - 0.5)
  const splitIdx = Math.floor(shuffled.length * 0.8)
  const trainIds = shuffled.slice(0, splitIdx).map((r: any) => r.id)
  const valIds = shuffled.slice(splitIdx).map((r: any) => r.id)

  await Promise.all([
    trainIds.length && supabase.from('dataset_images').update({ split_type: 'train' }).in('id', trainIds),
    valIds.length && supabase.from('dataset_images').update({ split_type: 'val' }).in('id', valIds),
  ])
  return { train: trainIds.length, val: valIds.length }
}

// ── Export YOLO classification format ────────────────────────────────────────
async function exportYOLO(onProgress: (p: number, msg: string) => void) {
  onProgress(5, 'Fetching approved frames...')
  const { data, error } = await supabase
    .from('dataset_images')
    .select('id, file_path, image_name, ai_result, split_type, annotations(status)')
  if (error) throw new Error(error.message)

  const approved = (data ?? []).filter((r: any) => r.annotations?.[0]?.status === 'approved')
  if (approved.length === 0) throw new Error('Không có frame nào được approve')

  const zip = new JSZip()
  const classes = ['ok', 'damaged', 'unknown']

  // classes.txt
  zip.file('classes.txt', classes.join('\n'))

  // dataset.yaml for YOLOv8
  zip.file('dataset.yaml', `
path: ./dataset
train: train
val: val

nc: 3
names: ['ok', 'damaged', 'unknown']
`.trim())

  let done = 0
  for (const row of approved) {
    const label = (row.ai_result as any)?.packaging_status ?? 'unknown'
    const split = row.split_type ?? 'train'
    const folder = `${split}/${label}`

    try {
      onProgress(5 + Math.round((done / approved.length) * 85), `Downloading ${done + 1}/${approved.length}...`)
      const res = await fetch(row.file_path)
      if (!res.ok) { done++; continue }
      const blob = await res.blob()
      const ext = row.image_name.endsWith('.jpg') ? 'jpg' : 'jpeg'
      zip.folder(folder)?.file(`${row.id}.${ext}`, blob)
    } catch { /* skip failed */ }
    done++
  }

  onProgress(92, 'Generating zip...')
  const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  onProgress(100, 'Done!')

  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = `warehouse-dataset-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Dataset() {
  const queryClient = useQueryClient()
  const [exportState, setExportState] = useState<{ loading: boolean; percent: number; msg: string }>
    ({ loading: false, percent: 0, msg: '' })
  const [splitResult, setSplitResult] = useState<{ train: number; val: number } | null>(null)

  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['dataset-stats'], queryFn: fetchStats })
  const { data: images, isLoading: imagesLoading } = useQuery({ queryKey: ['dataset-images'], queryFn: fetchImages })

  const splitMutation = useMutation({
    mutationFn: splitDataset,
    onSuccess: (result) => {
      setSplitResult(result)
      queryClient.invalidateQueries({ queryKey: ['dataset-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dataset-images'] })
    },
  })

  const handleExport = async () => {
    setExportState({ loading: true, percent: 0, msg: 'Starting...' })
    try {
      await exportYOLO((percent, msg) => setExportState({ loading: true, percent, msg }))
    } catch (e) {
      setExportState({ loading: false, percent: 0, msg: e instanceof Error ? e.message : 'Export failed' })
      return
    }
    setExportState({ loading: false, percent: 100, msg: 'Download started!' })
  }

  const approvedCount = images?.filter(i => i.reviewStatus === 'approved').length ?? 0

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f5]">Warehouse Training Set</h1>
          <p className="text-sm text-[#8888a8] mt-0.5">{approvedCount} approved frames sẵn sàng cho training</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            leftIcon={splitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
            onClick={() => { setSplitResult(null); splitMutation.mutate() }}
            disabled={splitMutation.isPending || approvedCount === 0}
          >
            Split 80/20
          </Button>
          <Button
            variant="outline"
            leftIcon={exportState.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            onClick={handleExport}
            disabled={exportState.loading || approvedCount === 0}
          >
            Export YOLO
          </Button>
        </div>
      </div>

      {/* Split result */}
      {splitResult && (
        <div className="flex items-center gap-2 bg-[#16a34a15] border border-[#16a34a30] rounded-[10px] px-4 py-3">
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          <p className="text-xs text-green-400">
            Split xong: <strong>{splitResult.train}</strong> train · <strong>{splitResult.val}</strong> val
          </p>
        </div>
      )}

      {/* Export progress */}
      {(exportState.loading || exportState.percent === 100) && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-[#8888a8]">{exportState.msg}</span>
            <span className="text-[#f0f0f5]">{exportState.percent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#1e1e2a]">
            <div
              className="h-1.5 rounded-full bg-[#7c6af7] transition-all duration-300"
              style={{ width: `${exportState.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 skeleton rounded-[14px]" />)
        ) : stats ? (
          <>
            <StatCard title="Total Frames" value={stats.totalImages.toLocaleString()}
              icon={Database} iconColor="text-[#a89bff]" iconBg="bg-[#7c6af720]" />
            <StatCard
              title="Training" value={stats.trainingImages.toLocaleString()}
              subtitle={stats.totalImages ? `${Math.round((stats.trainingImages / stats.totalImages) * 100)}% of total` : '—'}
              icon={Layers} iconColor="text-[#4ade80]" iconBg="bg-[#22c55e20]"
              progress={stats.totalImages ? (stats.trainingImages / stats.totalImages) * 100 : 0}
            />
            <StatCard
              title="Validation" value={stats.validationImages.toLocaleString()}
              subtitle={stats.totalImages ? `${Math.round((stats.validationImages / stats.totalImages) * 100)}% of total` : '—'}
              icon={Layers} iconColor="text-[#60a5fa]" iconBg="bg-[#3b82f620]"
              progress={stats.totalImages ? (stats.validationImages / stats.totalImages) * 100 : 0}
            />
          </>
        ) : null}
      </div>

      {/* Images table */}
      <div className="rounded-[14px] border border-[#1e1e2a] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e2a] bg-[#111118] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#f0f0f5]">Frames</h3>
          <span className="text-xs text-[#55556a]">{images?.length ?? 0} total</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2a] bg-[#0d0d14]">
              {['Preview', 'Frame', 'Packaging', 'Split', 'Review', 'Date'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#8888a8]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {imagesLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-[#1e1e2a]">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 skeleton rounded w-3/4" /></td>
                  ))}
                </tr>
              ))
            ) : images?.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-[#55556a]">
                Chưa có frames — chạy AI Processing trên video trước
              </td></tr>
            ) : images?.map((img, i) => (
              <tr key={img.id}
                className={cn('border-b border-[#1e1e2a] hover:bg-[#ffffff03] transition-colors',
                  i === (images?.length ?? 0) - 1 && 'border-b-0')}
              >
                <td className="px-4 py-3">
                  {img.preview ? (
                    <img src={img.preview} alt={img.name} className="w-14 h-10 object-cover rounded-[6px]" />
                  ) : (
                    <div className="w-14 h-10 bg-[#1e1e2a] rounded-[6px] flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-[#55556a]" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-[#f0f0f5]">{img.name}</span>
                  {img.aiResult?.tracking_codes?.length > 0 && (
                    <p className="text-[10px] text-[#a89bff] font-mono truncate max-w-[180px]">
                      {img.aiResult.tracking_codes[0]}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs capitalize', {
                    'text-green-400': img.aiResult?.packaging_status === 'ok',
                    'text-red-400': img.aiResult?.packaging_status === 'damaged',
                    'text-[#55556a]': !img.aiResult?.packaging_status || img.aiResult?.packaging_status === 'unknown',
                  })}>
                    {img.aiResult?.packaging_status ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium capitalize', {
                    'bg-[#22c55e20] text-[#4ade80]': img.splitType === 'train',
                    'bg-[#3b82f620] text-[#60a5fa]': img.splitType === 'val',
                    'bg-[#1e1e2a] text-[#55556a]': img.splitType === 'test',
                  })}>
                    {img.splitType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <DatasetStatusBadge status={
                    img.reviewStatus === 'approved' ? 'Training'
                    : img.reviewStatus === 'rejected' ? 'Pending'
                    : 'Pending'
                  } />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-[#55556a]">{formatDate(img.createdDate)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
