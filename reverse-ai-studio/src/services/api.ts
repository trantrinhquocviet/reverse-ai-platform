import { createClient } from '@supabase/supabase-js'
import type { Video, DatasetImage, Warehouse, Brand, AIModel, Activity, UserProfile } from '@/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      return { access_token: data.session!.access_token, token_type: 'bearer' }
    },
    me: async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) throw new Error('Not authenticated')
      return {
        id: user.id,
        email: user.email!,
        full_name: (user.user_metadata?.full_name as string) ?? '',
        role: (user.user_metadata?.role as string) ?? 'viewer',
      }
    },
    logout: async () => {
      await supabase.auth.signOut()
      window.location.href = '/login'
    },
  },

  // ── Dashboard ───────────────────────────────────────────────────────────────
  dashboard: {
    getStats: async () => {
      const [total, processing, images, models] = await Promise.all([
        supabase.from('videos').select('*', { count: 'exact', head: true }),
        supabase.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
        supabase.from('dataset_images').select('*', { count: 'exact', head: true }),
        supabase.from('training_jobs').select('*', { count: 'exact', head: true }),
      ])
      return {
        uploadedVideos: total.count ?? 0,
        processingVideos: processing.count ?? 0,
        needReview: 0,
        totalDataset: images.count ?? 0,
        aiModels: models.count ?? 0,
        storageUsed: '0.0 GB',
        storageTotal: '10 GB',
        storagePercent: 0,
      }
    },
    getRecentVideos: async () => {
      const { data } = await supabase
        .from('videos').select('*')
        .order('created_at', { ascending: false })
        .limit(4)
      return (data ?? []).map(mapVideo)
    },
    getActivities: async (): Promise<Activity[]> => [],
  },

  // ── Videos ──────────────────────────────────────────────────────────────────
  videos: {
    getAll: async (filters?: { search?: string; status?: string; warehouse?: string; brand?: string }) => {
      let q = supabase.from('videos').select('*').order('created_at', { ascending: false })
      if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status.toLowerCase())
      if (filters?.warehouse && filters.warehouse !== 'all') q = q.eq('warehouse', filters.warehouse)
      if (filters?.brand && filters.brand !== 'all') q = q.eq('brand', filters.brand)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      let results = (data ?? []).map(mapVideo)
      // Client-side search covers name + file_path (handles null name rows)
      if (filters?.search) {
        const q2 = filters.search.toLowerCase()
        results = results.filter(v =>
          v.name?.toLowerCase().includes(q2) ||
          v.filePath?.toLowerCase().includes(q2)
        )
      }
      return results
    },

    getById: async (id: string) => {
      const { data, error } = await supabase.from('videos').select('*').eq('id', id).single()
      if (error) throw new Error(error.message)
      return mapVideo(data)
    },

    update: async (id: string, data: { name?: string; warehouse?: string; brand?: string }) => {
      const { data: row, error } = await supabase.from('videos').update(data).eq('id', id).select().single()
      if (error) throw new Error(error.message)
      return mapVideo(row)
    },

    delete: async (id: string) => {
      const { error } = await supabase.from('videos').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return { success: true, id }
    },

    upload: async (file: File, meta: { warehouse: string; brand: string }, onProgress?: (percent: number) => void) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')

      // Extract metadata + thumbnail frame in parallel
      const [{ duration, resolution }, thumbnailBlob] = await Promise.all([
        getVideoMeta(file),
        extractVideoThumbnail(file),
      ])

      const videoId = crypto.randomUUID()
      const storagePath = `${videoId}/${file.name}`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploadOptions: any = { upsert: false }
      if (onProgress) uploadOptions.onUploadProgress = (e: { loaded: number; total: number }) => onProgress(Math.round((e.loaded / e.total) * 100))

      const { error: storageError } = await supabase.storage
        .from('videos')
        .upload(storagePath, file, uploadOptions)
      if (storageError) throw new Error(storageError.message)

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/videos/${storagePath}`

      // Upload thumbnail if extracted successfully
      let thumbnailUrl: string | null = null
      if (thumbnailBlob) {
        const thumbPath = `${videoId}/thumbnail.jpg`
        const { error: thumbErr } = await supabase.storage.from('videos').upload(thumbPath, thumbnailBlob, { contentType: 'image/jpeg', upsert: false })
        if (!thumbErr) thumbnailUrl = `${SUPABASE_URL}/storage/v1/object/public/videos/${thumbPath}`
      }

      const { data, error } = await supabase.from('videos').insert({
        name: file.name,
        warehouse: meta.warehouse,
        brand: meta.brand,
        file_path: publicUrl,
        file_size: file.size,
        duration: duration ?? null,
        resolution: resolution || null,
        thumbnail_path: thumbnailUrl,
        status: 'pending',
      }).select().single()
      if (error) throw new Error(error.message)
      return mapVideo(data)
    },

    importFromUrl: async (
      payload: { url: string; name?: string; warehouse: string; brand: string },
      onProgress?: (percent: number, stage: 'downloading' | 'uploading') => void,
    ) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')

      const driveMatch = payload.url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
      const defaultName = driveMatch ? `gdrive-${driveMatch[1].slice(0, 8)}.mp4` : (payload.url.split('/').pop()?.split('?')[0] || 'imported-video.mp4')
      const fileName = payload.name || defaultName

      // Proxy qua Vercel serverless function để tránh CORS
      onProgress?.(10, 'downloading')
      const res = await fetch('/api/import-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          url: payload.url,
          fileName,
          warehouse: payload.warehouse,
          brand: payload.brand,
          userId: session.user.id,
        }),
      })
      onProgress?.(90, 'uploading')
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? `Import failed: ${res.status}`)
      }
      onProgress?.(100, 'uploading')
      const data = await res.json() as { id: string; name: string; file_path: string }

      // Best-effort: extract duration from the public URL and persist it
      if (data.id && data.file_path) {
        getDurationFromUrl(data.file_path).then((dur) => {
          if (dur) supabase.from('videos').update({ duration: dur }).eq('id', data.id).then(() => {})
        })
      }

      return { id: data.id, name: data.name, file_path: data.file_path } as unknown as ReturnType<typeof mapVideo>
    },
  },

  // ── Dataset ─────────────────────────────────────────────────────────────────
  dataset: {
    getStats: async () => {
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
    },
    getImages: async () => {
      const { data } = await supabase
        .from('dataset_images').select('*')
        .order('created_at', { ascending: false })
      return (data ?? []).map(mapDatasetImage)
    },
  },

  // ── Models ──────────────────────────────────────────────────────────────────
  models: {
    getAll: async (): Promise<AIModel[]> => {
      const { data } = await supabase
        .from('training_jobs').select('*')
        .order('created_at', { ascending: false })
      return (data ?? []).map(mapTrainingJob)
    },
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  settings: {
    getWarehouses: async (): Promise<Warehouse[]> => {
      const { data, error } = await supabase.from('warehouses').select('*').eq('active', true).order('name')
      if (error) throw new Error(error.message)
      return (data ?? []).map(mapWarehouse)
    },
    addWarehouse: async (input: Omit<Warehouse, 'id' | 'createdAt'>): Promise<Warehouse> => {
      const { data, error } = await supabase.from('warehouses').insert({ name: input.name, location: input.location ?? '' }).select().single()
      if (error) throw new Error(error.message)
      return mapWarehouse(data)
    },
    deleteWarehouse: async (id: string) => {
      const { error } = await supabase.from('warehouses').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return { success: true, id }
    },
    getBrands: async (): Promise<Brand[]> => {
      const { data, error } = await supabase.from('brands').select('*').eq('active', true).order('name')
      if (error) throw new Error(error.message)
      return (data ?? []).map(mapBrand)
    },
    addBrand: async (input: Omit<Brand, 'id' | 'createdAt'>): Promise<Brand> => {
      const { data, error } = await supabase.from('brands').insert({ name: input.name }).select().single()
      if (error) throw new Error(error.message)
      return mapBrand(data)
    },
    deleteBrand: async (id: string) => {
      const { error } = await supabase.from('brands').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return { success: true, id }
    },
    getUser: async (): Promise<UserProfile> => {
      const { data: { user } } = await supabase.auth.getUser()
      return {
        id: user?.id ?? '',
        name: (user?.user_metadata?.full_name as string) ?? user?.email ?? '',
        email: user?.email ?? '',
        role: (user?.user_metadata?.role as string) ?? 'viewer',
        avatar: '',
      }
    },
  },

  // ── Filters ─────────────────────────────────────────────────────────────────
  filters: {
    getWarehouses: async () => {
      const { data } = await supabase.from('warehouses').select('name').eq('active', true).order('name')
      return (data ?? []).map((w) => w.name as string)
    },
    getBrands: async () => {
      const { data } = await supabase.from('brands').select('name').eq('active', true).order('name')
      return (data ?? []).map((b) => b.name as string)
    },
  },

  // kept for backward compat
  upload: {
    uploadVideo: (file: File, meta: { warehouse: string; brand: string }) =>
      api.videos.upload(file, meta),
  },
}

// ── Row mappers ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVideo(row: any): Video {
  return {
    id: row.id,
    name: row.name,
    thumbnail: row.thumbnail_path || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=225&fit=crop',
    filePath: row.file_path ?? '',
    warehouse: row.warehouse ?? '',
    brand: row.brand ?? '',
    uploadTime: row.created_at,
    duration: row.duration ? formatDuration(row.duration) : '—',
    resolution: row.resolution || '—',
    status: mapVideoStatus(row.status),
    fileSize: row.file_size ? `${(row.file_size / 1024 / 1024).toFixed(1)} MB` : '—',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDatasetImage(row: any): DatasetImage {
  return {
    id: row.id,
    name: row.image_name ?? row.file_path?.split('/').pop() ?? row.id,
    preview: row.file_path,
    sourceVideo: '',
    status: row.split_type === 'train' ? 'Training' : row.split_type === 'val' ? 'Validation' : 'Pending',
    createdDate: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTrainingJob(row: any): AIModel {
  const statusMap: Record<string, AIModel['status']> = {
    queued: 'Not Trained', running: 'Training', completed: 'Trained',
    failed: 'Not Trained', cancelled: 'Not Trained',
  }
  return {
    id: row.id,
    name: row.name,
    type: 'YOLO',
    description: `Model: ${row.model_template}`,
    status: statusMap[row.status] ?? 'Not Trained',
    version: 'v1',
    lastUpdated: row.created_at,
    accuracy: row.accuracy ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWarehouse(row: any): Warehouse {
  return { id: row.id, name: row.name, location: row.location ?? '', createdAt: row.created_at }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBrand(row: any): Brand {
  return { id: row.id, name: row.name, code: row.code ?? '', createdAt: row.created_at }
}

function mapVideoStatus(s: string): Video['status'] {
  const map: Record<string, Video['status']> = {
    pending: 'Uploaded', processing: 'Processing', ready: 'Ready', failed: 'Failed',
  }
  return map[s?.toLowerCase()] ?? 'Uploaded'
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getVideoMeta(file: File): Promise<{ duration: number | null; resolution: string }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const url = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const duration = isFinite(video.duration) ? video.duration : null
      const resolution = video.videoWidth && video.videoHeight
        ? `${video.videoWidth}x${video.videoHeight}`
        : ''
      resolve({ duration, resolution })
    }
    video.onerror = () => { URL.revokeObjectURL(url); resolve({ duration: null, resolution: '' }) }
    video.src = url
  })
}

function extractVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    const url = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      // Seek to 1s (or 10% of duration) to avoid black opening frame
      video.currentTime = Math.min(1, video.duration * 0.1)
    }
    video.onseeked = () => {
      URL.revokeObjectURL(url)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = Math.round(640 * (video.videoHeight / video.videoWidth))
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
      } catch {
        resolve(null)
      }
    }
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    video.src = url
  })
}

function getDurationFromUrl(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'
    video.onloadedmetadata = () => resolve(isFinite(video.duration) ? video.duration : null)
    video.onerror = () => resolve(null)
    video.src = url
    setTimeout(() => resolve(null), 10000)
  })
}
