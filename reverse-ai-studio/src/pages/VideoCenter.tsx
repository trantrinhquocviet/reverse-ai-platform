import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Upload, Search, Trash2, Video, LayoutGrid, List, Filter, Link2 } from 'lucide-react'
import { useVideos, useDeleteVideo, useFilterOptions, useUploadVideo, useImportVideoFromUrl } from '@/hooks/useVideos'
import { Button } from '@/components/Button'
import { Input, Select } from '@/components/Input'
import { VideoStatusBadge } from '@/components/Badge'
import { Pagination } from '@/components/Pagination'
import { EmptyState } from '@/components/EmptyState'
import { Modal } from '@/components/Modal'
import { cn } from '@/utils/cn'
import { formatRelativeTime } from '@/utils/formatters'
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

  const { data: videos, isLoading } = useVideos({ search, status, warehouse, brand })
  const { warehouses, brands } = useFilterOptions()
  const deleteMutation = useDeleteVideo()

  const totalPages = Math.ceil((videos?.length ?? 0) / ITEMS_PER_PAGE)
  const paginated = videos?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f5]">Video Center</h1>
          <p className="text-sm text-[#8888a8] mt-0.5">{videos?.length ?? 0} videos total</p>
        </div>
        <Button variant="primary" leftIcon={<Upload className="w-4 h-4" />} onClick={() => setUploadOpen(true)}>
          Upload Video
        </Button>
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
              onOpen={() => navigate(`/videos/${video.id}`)}
              onDelete={() => setDeleteTarget(video)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-[#1e1e2a] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2a] bg-[#111118]">
                {['Video', 'Warehouse', 'Brand', 'Duration', 'Uploaded', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#8888a8]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((video, i) => (
                <tr
                  key={video.id}
                  className={cn('border-b border-[#1e1e2a] hover:bg-[#ffffff04] transition-colors cursor-pointer', i === paginated.length - 1 && 'border-b-0')}
                  onClick={() => navigate(`/videos/${video.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={video.thumbnail} alt="" className="w-14 h-9 object-cover rounded-[6px]" />
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

function VideoGridCard({ video, onOpen, onDelete }: { video: VideoType; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-[14px] bg-[#111118] border border-[#1e1e2a] overflow-hidden hover:border-[#2a2a38] transition-all duration-200 group">
      <div className="relative cursor-pointer" onClick={onOpen}>
        <img src={video.thumbnail} alt={video.name} className="w-full h-36 object-cover" />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Video className="w-4 h-4 text-white" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
          {video.duration}
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-xs font-medium text-[#f0f0f5] truncate cursor-pointer hover:text-[#a89bff] transition-colors flex-1"
            onClick={onOpen}
          >
            {video.name}
          </p>
          <button
            onClick={onDelete}
            className="p-1 rounded-[5px] text-[#55556a] hover:text-[#f87171] hover:bg-[#ef444415] transition-colors flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
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

function UploadFileTab({ warehouses, brands, onClose }: { warehouses: string[]; brands: string[]; onClose: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [warehouse, setWarehouse] = useState('')
  const [brand, setBrand] = useState('')
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const handleSubmit = async () => {
    if (!file) return
    setError('')
    setUploading(true)
    setProgress(0)
    try {
      await api.videos.upload(file, { warehouse, brand }, setProgress)
      await queryClient.invalidateQueries({ queryKey: ['videos'] })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
        className={cn(
          'border-2 border-dashed rounded-[12px] p-8 text-center transition-colors cursor-pointer',
          dragging ? 'border-[#7c6af7] bg-[#7c6af710]' : 'border-[#2a2a38] hover:border-[#3a3a4e]'
        )}
        onClick={() => !uploading && document.getElementById('video-upload-input')?.click()}
      >
        <input
          id="video-upload-input"
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f) }}
        />
        <Upload className="w-8 h-8 text-[#55556a] mx-auto mb-3" />
        {file ? (
          <p className="text-sm text-[#a89bff] font-medium break-all leading-snug px-2" title={file.name}>{file.name}</p>
        ) : (
          <>
            <p className="text-sm text-[#f0f0f5]">Drop video here or click to browse</p>
            <p className="text-xs text-[#55556a] mt-1">MP4, MOV, AVI up to 4GB</p>
          </>
        )}
      </div>

      {uploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-[#8888a8]">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-[#2a2a38] rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-[#7c6af7] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <Select label="Warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
        <option value="">Select warehouse...</option>
        {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
      </Select>
      <Select label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
        <option value="">Select brand...</option>
        {brands.map((b) => <option key={b} value={b}>{b}</option>)}
      </Select>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="ghost" onClick={onClose} disabled={uploading}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!file || uploading}
          loading={uploading}
          leftIcon={<Upload className="w-4 h-4" />}
          onClick={handleSubmit}
        >
          Upload
        </Button>
      </div>
    </div>
  )
}

function ImportUrlTab({ warehouses, brands, onClose }: { warehouses: string[]; brands: string[]; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [brand, setBrand] = useState('')
  const [error, setError] = useState('')
  const importMutation = useImportVideoFromUrl()

  const isValidUrl = (v: string) => { try { new URL(v); return true } catch { return false } }

  const handleSubmit = async () => {
    if (!isValidUrl(url)) { setError('Please enter a valid URL'); return }
    setError('')
    await importMutation.mutateAsync({ url, name: name || undefined, warehouse, brand })
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#8888a8]">Video URL</label>
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#55556a]" />
          <input
            type="url"
            placeholder="https://example.com/video.mp4"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError('') }}
            className="w-full bg-[#111118] border border-[#1e1e2a] rounded-[8px] pl-9 pr-3 py-2 text-sm text-[#f0f0f5] placeholder-[#55556a] outline-none focus:border-[#7c6af7] transition-colors"
          />
        </div>
        {error && <p className="text-xs text-[#f87171]">{error}</p>}
        <p className="text-[11px] text-[#55556a]">Direct link to MP4, MOV, AVI file. The system will download it automatically.</p>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-[#8888a8]">Video Name <span className="text-[#55556a]">(optional)</span></label>
        <input
          type="text"
          placeholder="Leave blank to use filename from URL"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#111118] border border-[#1e1e2a] rounded-[8px] px-3 py-2 text-sm text-[#f0f0f5] placeholder-[#55556a] outline-none focus:border-[#7c6af7] transition-colors"
        />
      </div>
      <Select label="Warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
        <option value="">Select warehouse...</option>
        {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
      </Select>
      <Select label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
        <option value="">Select brand...</option>
        {brands.map((b) => <option key={b} value={b}>{b}</option>)}
      </Select>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!url}
          loading={importMutation.isPending}
          leftIcon={<Link2 className="w-4 h-4" />}
          onClick={handleSubmit}
        >
          Import
        </Button>
      </div>
    </div>
  )
}
