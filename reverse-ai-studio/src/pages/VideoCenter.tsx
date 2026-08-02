import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Upload, Search, Trash2, Video, LayoutGrid, List, Filter, Link2, CheckCircle2, AlertCircle, X as XIcon, Cpu, CheckSquare, Square, Loader2, FileText, ClipboardList } from 'lucide-react'
import { useVideos, useDeleteVideo, useFilterOptions, useUploadVideo, useImportVideoFromUrl } from '@/hooks/useVideos'
import { Button } from '@/components/Button'
import { Input, Select } from '@/components/Input'
import { VideoStatusBadge } from '@/components/Badge'
import { Pagination } from '@/components/Pagination'
import { EmptyState } from '@/components/EmptyState'
import { Modal } from '@/components/Modal'
import { cn } from '@/utils/cn'
import { formatRelativeTime } from '@/utils/formatters'
import { useProcessing, VISION_MODELS } from '@/contexts/ProcessingContext'
import type { Video as VideoType } from '@/types'

const ITEMS_PER_PAGE = 6

export function VideoCenter() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [warehouse, setWarehouse] = useState('all')
  const [brand, setBrand] = useState('all')
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [deleteTarget, setDeleteTarget] = useState<VideoType | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  const { data: videos, isLoading } = useVideos({ search, status, warehouse, brand })
  const { warehouses, brands } = useFilterOptions()
  const deleteMutation = useDeleteVideo()
  const { addToQueue, queue, job } = useProcessing()

  const totalPages = Math.ceil((videos?.length ?? 0) / ITEMS_PER_PAGE)
  const paginated = videos?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!paginated) return
    const allIds = paginated.map(v => v.id)
    const allSelected = allIds.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      allIds.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  const handleProcessSelected = () => {
    const toQueue = (videos ?? [])
      .filter(v => selected.has(v.id) && v.filePath)
      .map(v => ({ id: v.id, name: v.name, filePath: v.filePath }))
    if (toQueue.length === 0) return
    addToQueue(toQueue)
    setSelected(new Set())
    setSelectMode(false)
  }

  const queuedIds = new Set(queue.map(v => v.id))
  const activeJobId = job?.status === 'running' ? job.videoId : null

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f5]">Video Center</h1>
          <p className="text-sm text-[#8888a8] mt-0.5">
            {videos?.length ?? 0} videos total
            {(queue.length > 0 || activeJobId) && (
              <span className="ml-2 text-[#a89bff]">
                · {activeJobId ? '1 đang xử lý' : ''}{queue.length > 0 ? ` · ${queue.length} trong hàng chờ` : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <span className="text-xs text-[#8888a8]">{selected.size} đã chọn</span>
              <Button
                variant="outline"
                leftIcon={<Cpu className="w-4 h-4" />}
                disabled={selected.size === 0}
                onClick={handleProcessSelected}
              >
                Process {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
              <Button variant="ghost" onClick={() => { setSelectMode(false); setSelected(new Set()) }}>
                Huỷ
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" leftIcon={<CheckSquare className="w-4 h-4" />} onClick={() => setSelectMode(true)}>
                Select
              </Button>
              <Button variant="primary" leftIcon={<Upload className="w-4 h-4" />} onClick={() => setUploadOpen(true)}>
                Upload Video
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Input
            leftIcon={<Search className="w-3.5 h-3.5" />}
            placeholder="Search videos..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-[#55556a]" />
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="w-36"
          >
            <option value="all">All Status</option>
            <option value="Uploaded">Uploaded</option>
            <option value="Processing">Processing</option>
            <option value="Ready">Ready</option>
            <option value="Failed">Failed</option>
          </Select>
          <Select
            value={warehouse}
            onChange={(e) => { setWarehouse(e.target.value); setPage(1) }}
            className="w-36"
          >
            <option value="all">All Warehouses</option>
            {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
          </Select>
          <Select
            value={brand}
            onChange={(e) => { setBrand(e.target.value); setPage(1) }}
            className="w-32"
          >
            <option value="all">All Brands</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-1 bg-[#111118] border border-[#1e1e2a] rounded-[8px] p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={cn('p-1.5 rounded-[6px] transition-colors', viewMode === 'grid' ? 'bg-[#7c6af720] text-[#a89bff]' : 'text-[#55556a] hover:text-[#f0f0f5]')}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn('p-1.5 rounded-[6px] transition-colors', viewMode === 'list' ? 'bg-[#7c6af720] text-[#a89bff]' : 'text-[#55556a] hover:text-[#f0f0f5]')}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className={cn('gap-4', viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn('rounded-[14px] skeleton', viewMode === 'grid' ? 'h-48' : 'h-20')} />
          ))}
        </div>
      ) : !paginated?.length ? (
        <EmptyState
          icon={Video}
          title="No videos found"
          description="Try adjusting your filters or upload a new video."
          action={
            <Button variant="primary" leftIcon={<Upload className="w-4 h-4" />} onClick={() => setUploadOpen(true)}>
              Upload Video
            </Button>
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginated.map((video) => (
            <VideoGridCard
              key={video.id}
              video={video}
              onOpen={() => !selectMode && navigate(`/videos/${video.id}`)}
              onDelete={() => setDeleteTarget(video)}
              selectMode={selectMode}
              selected={selected.has(video.id)}
              onToggleSelect={() => toggleSelect(video.id)}
              isProcessing={activeJobId === video.id}
              isQueued={queuedIds.has(video.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-[#1e1e2a] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2a] bg-[#111118]">
                {selectMode && (
                  <th className="px-4 py-3 w-8">
                    <button onClick={toggleSelectAll}>
                      {paginated?.every(v => selected.has(v.id))
                        ? <CheckSquare className="w-4 h-4 text-[#a89bff]" />
                        : <Square className="w-4 h-4 text-[#55556a]" />}
                    </button>
                  </th>
                )}
                {['Video', 'Warehouse', 'Brand', 'Duration', 'Uploaded', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#8888a8]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((video, i) => (
                <tr
                  key={video.id}
                  className={cn(
                    'border-b border-[#1e1e2a] hover:bg-[#ffffff04] transition-colors cursor-pointer',
                    i === paginated.length - 1 && 'border-b-0',
                    selected.has(video.id) && 'bg-[#7c6af708]'
                  )}
                  onClick={() => selectMode ? toggleSelect(video.id) : navigate(`/videos/${video.id}`)}
                >
                  {selectMode && (
                    <td className="px-4 py-3 w-8">
                      {selected.has(video.id)
                        ? <CheckSquare className="w-4 h-4 text-[#a89bff]" />
                        : <Square className="w-4 h-4 text-[#55556a]" />}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img src={video.thumbnail} alt="" className="w-14 h-9 object-cover rounded-[6px]" />
                        {activeJobId === video.id && (
                          <div className="absolute inset-0 rounded-[6px] bg-[#7c6af740] flex items-center justify-center">
                            <Cpu className="w-3 h-3 text-[#a89bff] animate-pulse" />
                          </div>
                        )}
                        {queuedIds.has(video.id) && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#7c6af7] flex items-center justify-center">
                            <span className="text-[7px] text-white font-bold">{Array.from(queuedIds).indexOf(video.id) + 1}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-[#f0f0f5] max-w-[160px] truncate">{video.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8888a8]">{video.warehouse}</td>
                  <td className="px-4 py-3 text-xs text-[#8888a8]">{video.brand}</td>
                  <td className="px-4 py-3 text-xs text-[#8888a8]">{video.duration}</td>
                  <td className="px-4 py-3 text-xs text-[#8888a8]">{formatRelativeTime(video.uploadTime)}</td>
                  <td className="px-4 py-3"><VideoStatusBadge status={video.status} /></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(video) }}
                      className="p-1.5 rounded-[6px] text-[#55556a] hover:text-[#f87171] hover:bg-[#ef444415] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && (videos?.length ?? 0) > ITEMS_PER_PAGE && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={videos?.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Video"
        description="This action cannot be undone."
        size="sm"
      >
        <p className="text-sm text-[#8888a8] mb-5">
          Are you sure you want to delete <span className="text-[#f0f0f5] font-medium">{deleteTarget?.name}</span>?
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      {/* Upload modal */}
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} warehouses={warehouses} brands={brands} />
    </div>
  )
}

function VideoGridCard({ video, onOpen, onDelete, selectMode, selected, onToggleSelect, isProcessing, isQueued }: {
  video: VideoType
  onOpen: () => void
  onDelete: () => void
  selectMode: boolean
  selected: boolean
  onToggleSelect: () => void
  isProcessing: boolean
  isQueued: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-[14px] bg-[#111118] border overflow-hidden transition-all duration-200 group',
        selected ? 'border-[#7c6af7]' : 'border-[#1e1e2a] hover:border-[#2a2a38]',
        selectMode && 'cursor-pointer'
      )}
      onClick={selectMode ? onToggleSelect : undefined}
    >
      <div className="relative" onClick={!selectMode ? onOpen : undefined} style={{ cursor: selectMode ? undefined : 'pointer' }}>
        <img src={video.thumbnail} alt={video.name} className="w-full h-36 object-cover" />
        {/* Overlay */}
        {!selectMode && (
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
        {/* Select checkbox */}
        {selectMode && (
          <div className="absolute top-2 left-2">
            {selected
              ? <CheckSquare className="w-5 h-5 text-[#a89bff] drop-shadow" />
              : <Square className="w-5 h-5 text-white/70 drop-shadow" />}
          </div>
        )}
        {/* Processing indicator */}
        {isProcessing && (
          <div className="absolute inset-0 bg-[#7c6af730] flex items-center justify-center">
            <div className="flex items-center gap-1.5 bg-[#0d0d14cc] px-2.5 py-1.5 rounded-full">
              <Cpu className="w-3.5 h-3.5 text-[#a89bff] animate-pulse" />
              <span className="text-[10px] text-[#a89bff] font-medium">Processing...</span>
            </div>
          </div>
        )}
        {/* Queue badge */}
        {isQueued && !isProcessing && (
          <div className="absolute top-2 right-2 bg-[#7c6af7] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            In queue
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
          {video.duration}
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-[#f0f0f5] truncate flex-1">{video.name}</p>
          {!selectMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="p-1 rounded-[5px] text-[#55556a] hover:text-[#f87171] hover:bg-[#ef444415] transition-colors flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-[#8888a8]">{video.warehouse} · {video.brand}</p>
          <VideoStatusBadge status={video.status} />
        </div>
        <p className="text-[10px] text-[#55556a] mt-1">{formatRelativeTime(video.uploadTime)}</p>
      </div>
    </div>
  )
}

function UploadModal({ open, onClose, warehouses, brands }: { open: boolean; onClose: () => void; warehouses: string[]; brands: string[] }) {
  const [tab, setTab] = useState<'file' | 'url'>('file')

  const handleClose = () => { setTab('file'); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="Add Video" description="Upload a file or import from a URL">
      {/* Tabs */}
      <div className="flex gap-1 bg-[#0a0a10] border border-[#1e1e2a] rounded-[10px] p-1 mb-4">
        <button
          onClick={() => setTab('file')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-[8px] transition-colors',
            tab === 'file' ? 'bg-[#7c6af720] text-[#a89bff]' : 'text-[#55556a] hover:text-[#f0f0f5]'
          )}
        >
          <Upload className="w-3.5 h-3.5" /> Upload File
        </button>
        <button
          onClick={() => setTab('url')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-[8px] transition-colors',
            tab === 'url' ? 'bg-[#7c6af720] text-[#a89bff]' : 'text-[#55556a] hover:text-[#f0f0f5]'
          )}
        >
          <Link2 className="w-3.5 h-3.5" /> Import from URL
        </button>
      </div>

      {tab === 'file' ? (
        <UploadFileTab warehouses={warehouses} brands={brands} onClose={handleClose} />
      ) : (
        <ImportUrlTab warehouses={warehouses} brands={brands} onClose={handleClose} />
      )}
    </Modal>
  )
}

interface FileItem {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

function UploadFileTab({ warehouses, brands, onClose }: { warehouses: string[]; brands: string[]; onClose: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [warehouse, setWarehouse] = useState('')
  const [brand, setBrand] = useState('')
  const [uploading, setUploading] = useState(false)
  const queryClient = useQueryClient()

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const newItems: FileItem[] = Array.from(incoming)
      .filter(f => f.type.startsWith('video/'))
      .map(f => ({ file: f, progress: 0, status: 'pending' }))
    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.file.name))
      return [...prev, ...newItems.filter(f => !existingNames.has(f.file.name))]
    })
  }

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (files.length === 0) return
    setUploading(true)
    for (let i = 0; i < files.length; i++) {
      const item = files[i]
      if (item.status === 'done') continue
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading', progress: 0 } : f))
      try {
        await api.videos.upload(item.file, { warehouse, brand }, (pct) => {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: pct } : f))
        })
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done', progress: 100 } : f))
      } catch (err) {
        setFiles(prev => prev.map((f, idx) => idx === i
          ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
          : f))
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['videos'] })
    setUploading(false)
    // Close only if all done
    if (files.every(f => f.status !== 'error')) onClose()
  }

  const allDone = files.length > 0 && files.every(f => f.status === 'done')
  const hasError = files.some(f => f.status === 'error')

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        className={cn(
          'border-2 border-dashed rounded-[12px] p-6 text-center transition-colors cursor-pointer',
          dragging ? 'border-[#7c6af7] bg-[#7c6af710]' : 'border-[#2a2a38] hover:border-[#3a3a4e]'
        )}
        onClick={() => !uploading && document.getElementById('video-upload-input')?.click()}
      >
        <input
          id="video-upload-input"
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <Upload className="w-7 h-7 text-[#55556a] mx-auto mb-2" />
        <p className="text-sm text-[#f0f0f5]">Drop videos here or click to browse</p>
        <p className="text-xs text-[#55556a] mt-1">MP4, MOV, AVI · có thể chọn nhiều file</p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {files.map((item, i) => (
            <div key={item.file.name} className="bg-[#111118] border border-[#1e1e2a] rounded-[8px] px-3 py-2">
              <div className="flex items-center gap-2">
                {item.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                {item.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                {(item.status === 'pending' || item.status === 'uploading') && (
                  <div className="w-3.5 h-3.5 rounded-full border border-[#55556a] flex-shrink-0" />
                )}
                <span className="text-xs text-[#f0f0f5] truncate flex-1">{item.file.name}</span>
                <span className="text-[10px] text-[#55556a] flex-shrink-0">
                  {(item.file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                {!uploading && item.status !== 'done' && (
                  <button onClick={() => removeFile(i)} className="text-[#55556a] hover:text-[#f87171] transition-colors">
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
              {item.status === 'uploading' && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#2a2a38] rounded-full overflow-hidden">
                    <div
                      className="h-1 bg-[#7c6af7] rounded-full transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#8888a8] w-8 text-right">{item.progress}%</span>
                </div>
              )}
              {item.status === 'error' && (
                <p className="text-[10px] text-red-400 mt-1 truncate">{item.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select label="Warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
          <option value="">Select warehouse...</option>
          {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
        </Select>
        <Select label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Select brand...</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
      </div>

      {allDone && <p className="text-xs text-green-400 text-center">Tất cả {files.length} video đã upload thành công!</p>}
      {hasError && <p className="text-xs text-[#f87171] text-center">Một số file upload thất bại. Đóng và thử lại.</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onClose} disabled={uploading}>
          {allDone ? 'Close' : 'Cancel'}
        </Button>
        <Button
          variant="primary"
          disabled={files.length === 0 || uploading || allDone}
          loading={uploading}
          leftIcon={<Upload className="w-4 h-4" />}
          onClick={handleSubmit}
        >
          Upload {files.length > 1 ? `${files.length} Videos` : 'Video'}
        </Button>
      </div>
    </div>
  )
}

interface UrlItem {
  url: string
  name: string
  progress: number
  stage: 'downloading' | 'uploading'
  status: 'pending' | 'importing' | 'done' | 'error'
  error?: string
  videoId?: string
  videoName?: string
  filePath?: string
}

function ImportUrlTab({ warehouses, brands, onClose }: { warehouses: string[]; brands: string[]; onClose: () => void }) {
  const [urlItems, setUrlItems] = useState<UrlItem[]>([{ url: '', name: '', progress: 0, stage: 'downloading', status: 'pending' }])
  const [warehouse, setWarehouse] = useState('')
  const [brand, setBrand] = useState('')
  const [importing, setImporting] = useState(false)
  const [addToProcessing, setAddToProcessing] = useState(true)
  const queryClient = useQueryClient()
  const { addToQueue, preferredModel, setPreferredModel } = useProcessing()
  const templateInputRef = { current: null as HTMLInputElement | null }

  const isValidUrl = (v: string) => { try { new URL(v); return true } catch { return false } }

  const makeRow = (url = '', name = ''): UrlItem => ({ url, name, progress: 0, stage: 'downloading', status: 'pending' })
  const addRow = () => setUrlItems(prev => [...prev, makeRow()])
  const removeRow = (i: number) => setUrlItems(prev => prev.filter((_, idx) => idx !== i))
  const updateRow = (i: number, patch: Partial<UrlItem>) =>
    setUrlItems(prev => prev.map((item, idx) => idx === i ? { ...item, ...patch } : item))

  // Parse multiline text → URL rows (url [TAB|,] name)
  const parseUrlText = (text: string): UrlItem[] => {
    return text.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const sep = line.includes('\t') ? '\t' : ','
        const [url, name = ''] = line.split(sep).map(s => s.trim())
        return makeRow(url, name)
      })
      .filter(r => isValidUrl(r.url))
  }

  // Paste handler — if pasting multiple lines into a URL field, expand to rows
  const handlePaste = (e: React.ClipboardEvent, rowIndex: number) => {
    const text = e.clipboardData.getData('text')
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length <= 1) return  // single URL, let browser handle normally
    e.preventDefault()
    const newRows = parseUrlText(text)
    if (!newRows.length) return
    setUrlItems(prev => {
      const updated = [...prev]
      updated.splice(rowIndex, 1, ...newRows)
      return updated
    })
  }

  // Load template file (.txt or .csv)
  const handleTemplateFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseUrlText(text)
      if (rows.length > 0) setUrlItems(rows)
    }
    reader.readAsText(file)
    e.target.value = ''  // reset so same file can be re-loaded
  }

  const validItems = urlItems.filter(item => isValidUrl(item.url))
  const allDone = urlItems.length > 0 && urlItems.every(i => i.status === 'done' || !isValidUrl(i.url))
  const hasError = urlItems.some(i => i.status === 'error')

  const handleSubmit = async () => {
    if (validItems.length === 0) return
    setImporting(true)
    const imported: { id: string; name: string; filePath: string }[] = []

    for (let i = 0; i < urlItems.length; i++) {
      const item = urlItems[i]
      if (!isValidUrl(item.url) || item.status === 'done') continue
      updateRow(i, { status: 'importing', progress: 0 })
      try {
        const result = await api.videos.importFromUrl(
          { url: item.url, name: item.name || undefined, warehouse, brand },
          (pct, s) => updateRow(i, { progress: pct, stage: s }),
        ) as { id: string; name: string; filePath?: string } | undefined
        const videoId = (result as any)?.id ?? ''
        const fallbackName = item.name || (item.url.split('/').pop() ?? 'video')
        const videoName: string = (result as any)?.name ?? fallbackName
        const filePath = (result as any)?.filePath ?? item.url
        updateRow(i, { status: 'done', progress: 100, videoId, videoName, filePath })
        if (videoId) imported.push({ id: videoId, name: videoName, filePath })
      } catch (err) {
        updateRow(i, { status: 'error', error: err instanceof Error ? err.message : 'Import thất bại' })
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['videos'] })
    if (addToProcessing && imported.length > 0) addToQueue(imported)
    setImporting(false)
  }

  const stageLabel = (s: 'downloading' | 'uploading') =>
    s === 'downloading' ? 'Downloading...' : 'Uploading...'

  return (
    <div className="space-y-4">
      {/* URL rows */}
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {urlItems.map((item, i) => (
          <div key={i} className="bg-[#111118] border border-[#1e1e2a] rounded-[10px] p-3 space-y-2">
            <div className="flex items-center gap-2">
              {item.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
              {item.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
              {item.status === 'importing' && <Loader2 className="w-3.5 h-3.5 text-[#a89bff] animate-spin flex-shrink-0" />}
              {item.status === 'pending' && <Link2 className="w-3.5 h-3.5 text-[#55556a] flex-shrink-0" />}
              <input
                type="url"
                placeholder="https://example.com/video.mp4"
                value={item.url}
                onChange={e => updateRow(i, { url: e.target.value })}
                onPaste={e => handlePaste(e, i)}
                disabled={importing || item.status === 'done'}
                className="flex-1 min-w-0 bg-transparent text-xs text-[#f0f0f5] placeholder-[#55556a] outline-none disabled:opacity-60"
              />
              {!importing && item.status !== 'done' && urlItems.length > 1 && (
                <button onClick={() => removeRow(i)} className="text-[#55556a] hover:text-[#f87171] transition-colors flex-shrink-0">
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Tên video (tuỳ chọn)"
              value={item.name}
              onChange={e => updateRow(i, { name: e.target.value })}
              disabled={importing || item.status === 'done'}
              className="w-full bg-transparent text-[11px] text-[#8888a8] placeholder-[#44445a] outline-none border-t border-[#1e1e2a] pt-2 disabled:opacity-60"
            />
            {item.status === 'importing' && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-[#2a2a38] rounded-full overflow-hidden">
                  <div className="h-1 bg-[#7c6af7] rounded-full transition-all duration-200" style={{ width: `${item.progress}%` }} />
                </div>
                <span className="text-[10px] text-[#55556a] w-20 flex-shrink-0">{stageLabel(item.stage)} {item.progress}%</span>
              </div>
            )}
            {item.status === 'error' && <p className="text-[10px] text-red-400">{item.error}</p>}
          </div>
        ))}
      </div>

      {/* Add row + import template */}
      {!importing && (
        <div className="flex gap-2">
          <button
            onClick={addRow}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-dashed border-[#2a2a38] rounded-[8px] text-xs text-[#55556a] hover:text-[#8888a8] hover:border-[#3a3a4e] transition-colors"
          >
            + Thêm URL
          </button>
          <input
            ref={el => { templateInputRef.current = el }}
            type="file"
            accept=".txt,.csv"
            className="hidden"
            onChange={handleTemplateFile}
          />
          <button
            onClick={() => templateInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-[#2a2a38] rounded-[8px] text-xs text-[#55556a] hover:text-[#a89bff] hover:border-[#7c6af740] transition-colors"
            title="Import từ file .txt hoặc .csv (mỗi dòng: URL hoặc URL,tên)"
          >
            <FileText className="w-3.5 h-3.5" />
            Template
          </button>
        </div>
      )}
      {urlItems.length === 0 && !importing && (
        <p className="text-[10px] text-[#44445a] text-center">
          Template format: mỗi dòng <code className="text-[#7c6af7]">URL</code> hoặc <code className="text-[#7c6af7]">URL,tên video</code>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select label="Warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
          <option value="">Select warehouse...</option>
          {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
        </Select>
        <Select label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Select brand...</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
      </div>

      {/* Vision AI Model picker */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-[#55556a] font-medium uppercase tracking-wider">Vision AI Model</p>
        <select
          value={preferredModel}
          onChange={e => setPreferredModel(e.target.value)}
          className="w-full bg-[#1a1a24] border border-[#2a2a38] text-[#f0f0f5] text-xs rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#a89bff] transition-colors"
        >
          {VISION_MODELS.map((m, i) => (
            <option key={m.id} value={m.id}>{i + 1}. {m.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-[#44445a]">Preferred model — auto-fallback nếu bị rate-limit</p>
      </div>

      {/* Auto-process toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          onClick={() => setAddToProcessing(v => !v)}
          className={cn(
            'w-8 h-4 rounded-full transition-colors relative flex-shrink-0',
            addToProcessing ? 'bg-[#7c6af7]' : 'bg-[#2a2a38]'
          )}
        >
          <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', addToProcessing ? 'left-[18px]' : 'left-0.5')} />
        </div>
        <span className="text-xs text-[#8888a8]">Tự động thêm vào hàng chờ AI Processing sau khi import</span>
      </label>

      {allDone && (
        <p className="text-xs text-green-400 text-center">
          Import xong! {addToProcessing ? 'Đã thêm vào hàng chờ xử lý.' : ''}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onClose} disabled={importing}>{allDone ? 'Close' : 'Cancel'}</Button>
        <Button
          variant="primary"
          disabled={validItems.length === 0 || importing || allDone}
          loading={importing}
          leftIcon={<Link2 className="w-4 h-4" />}
          onClick={handleSubmit}
        >
          Import {validItems.length > 1 ? `${validItems.length} Videos` : 'Video'}
        </Button>
      </div>
    </div>
  )
}
