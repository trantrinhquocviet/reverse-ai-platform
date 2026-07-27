import type { Video, DatasetImage, Warehouse, Brand, AIModel, Activity, UserProfile } from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

// ── Token helpers ─────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('access_token')
const setToken = (token: string) => localStorage.setItem('access_token', token)
const clearToken = () => localStorage.removeItem('access_token')

// ── HTTP client ───────────────────────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  // Don't set Content-Type for FormData — browser must set it with the multipart boundary
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' }
  Object.assign(headers, options.headers as Record<string, string>)

  if (authenticated) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body: unknown, auth = true) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) }, auth)
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })

// ── API surface ───────────────────────────────────────────────────────────────
export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const res = await post<{ access_token: string; token_type: string }>(
        '/auth/login',
        { email, password },
        false,
      )
      setToken(res.access_token)
      return res
    },
    me: () => get<{ id: string; email: string; full_name: string; role: string }>('/auth/me'),
    logout: () => {
      clearToken()
      window.location.href = '/login'
    },
  },

  dashboard: {
    getStats: async () => {
      const res = await get<{
        total_videos: number
        processing_videos: number
        pending_review: number
        total_dataset_images: number
        total_models: number
        storage_used_gb: number
        storage_total_gb: number
      }>('/analytics/dashboard')
      return {
        uploadedVideos: res.total_videos,
        processingVideos: res.processing_videos,
        needReview: res.pending_review,
        totalDataset: res.total_dataset_images,
        aiModels: res.total_models,
        storageUsed: `${res.storage_used_gb.toFixed(1)} GB`,
        storageTotal: `${res.storage_total_gb} GB`,
        storagePercent: Math.round((res.storage_used_gb / res.storage_total_gb) * 100),
      }
    },
    getRecentVideos: async () => {
      const res = await get<{ items: BackendVideo[] }>('/videos?limit=4&sort=-created_at')
      return res.items.map(mapVideo)
    },
    getActivities: () =>
      get<{ items: Activity[] }>('/analytics/activities').then((r) => r.items),
  },

  videos: {
    getAll: async (filters?: { search?: string; status?: string; warehouse?: string; brand?: string }) => {
      const params = new URLSearchParams()
      if (filters?.search) params.set('search', filters.search)
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status.toLowerCase())
      if (filters?.warehouse && filters.warehouse !== 'all') params.set('warehouse', filters.warehouse)
      if (filters?.brand && filters.brand !== 'all') params.set('brand', filters.brand)
      const res = await get<{ items: BackendVideo[] }>(`/videos?${params}`)
      return res.items.map(mapVideo)
    },
    getById: async (id: string) => {
      const res = await get<BackendVideo>(`/videos/${id}`)
      return mapVideo(res)
    },
    delete: async (id: string) => {
      await del(`/videos/${id}`)
      return { success: true, id }
    },
    upload: async (file: File, meta: { warehouse: string; brand: string }) => {
      const form = new FormData()
      form.append('file', file)
      const params = new URLSearchParams({ warehouse: meta.warehouse, brand: meta.brand })
      const res = await request<{ video_id: string; job_id: string; message: string }>(
        `/videos/upload?${params}`,
        { method: 'POST', body: form, headers: {} },
      )
      return res
    },
    importFromUrl: async (payload: { url: string; name?: string; warehouse: string; brand: string }) => {
      const res = await post<{ video_id: string; job_id: string; message: string }>(
        '/videos/import-url',
        payload,
      )
      return res
    },
  },

  dataset: {
    getStats: async () => {
      const res = await get<{ total_images: number; training_images: number; validation_images: number }>(
        '/datasets/stats',
      )
      return {
        totalImages: res.total_images,
        trainingImages: res.training_images,
        validationImages: res.validation_images,
      }
    },
    getImages: async () => {
      const res = await get<{ items: BackendDatasetImage[] }>('/datasets/images')
      return res.items.map(mapDatasetImage)
    },
  },

  models: {
    getAll: async (): Promise<AIModel[]> => {
      const res = await get<{ items: BackendTrainingJob[] }>('/training')
      return res.items.map(mapTrainingJobToModel)
    },
  },

  settings: {
    getWarehouses: () => get<Warehouse[]>('/inspector/warehouses'),
    addWarehouse: (data: Omit<Warehouse, 'id' | 'createdAt'>) =>
      post<Warehouse>('/inspector/warehouses', data),
    deleteWarehouse: async (id: string) => {
      await del(`/inspector/warehouses/${id}`)
      return { success: true, id }
    },
    getBrands: () => get<Brand[]>('/inspector/brands'),
    addBrand: (data: Omit<Brand, 'id' | 'createdAt'>) =>
      post<Brand>('/inspector/brands', data),
    deleteBrand: async (id: string) => {
      await del(`/inspector/brands/${id}`)
      return { success: true, id }
    },
    getUser: (): Promise<UserProfile> =>
      get<{ id: string; email: string; full_name: string; role: string }>('/auth/me').then((u) => ({
        id: u.id,
        name: u.full_name,
        email: u.email,
        role: u.role,
        avatar: '',
      })),
  },

  filters: {
    getWarehouses: async () => {
      const items = await get<Warehouse[]>('/inspector/warehouses')
      return items.map((w) => w.name)
    },
    getBrands: async () => {
      const items = await get<Brand[]>('/inspector/brands')
      return items.map((b) => b.name)
    },
  },

  // kept for backward compat — use videos.upload instead
  upload: {
    uploadVideo: (file: File, meta: { warehouse: string; brand: string }) =>
      api.videos.upload(file, meta),
  },
}

// ── Backend response shapes ───────────────────────────────────────────────────
interface BackendVideo {
  id: string
  name: string
  thumbnail_path: string
  warehouse: string
  brand: string
  created_at: string
  duration: number | null
  resolution: string
  status: string
  file_size: number | null
}

interface BackendTrainingJob {
  id: string
  name: string
  model_template: string
  status: string
  accuracy: number | null
  created_at: string
  map50: number | null
}

interface BackendDatasetImage {
  id: string
  image_name: string
  file_path: string
  split_type: string
  status: string
  created_at: string
}

// ── Mappers ───────────────────────────────────────────────────────────────────
function mapVideo(v: BackendVideo): Video {
  return {
    id: v.id,
    name: v.name,
    thumbnail: v.thumbnail_path || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=225&fit=crop',
    warehouse: v.warehouse,
    brand: v.brand,
    uploadTime: v.created_at,
    duration: v.duration ? formatDuration(v.duration) : '0:00',
    resolution: v.resolution || 'Unknown',
    status: mapVideoStatus(v.status),
    fileSize: v.file_size ? `${(v.file_size / 1024 / 1024).toFixed(1)} MB` : '—',
  }
}

function mapDatasetImage(d: BackendDatasetImage): DatasetImage {
  return {
    id: d.id,
    name: d.image_name ?? d.file_path.split('/').pop() ?? d.id,
    preview: d.file_path,
    sourceVideo: '',
    status: d.split_type === 'train' ? 'Training' : d.split_type === 'val' ? 'Validation' : 'Pending',
    createdDate: d.created_at,
  }
}

function mapVideoStatus(s: string): Video['status'] {
  const map: Record<string, Video['status']> = {
    pending: 'Uploaded',
    processing: 'Processing',
    ready: 'Ready',
    failed: 'Failed',
  }
  return map[s.toLowerCase()] ?? 'Uploaded'
}

function mapTrainingJobToModel(j: BackendTrainingJob): AIModel {
  const statusMap: Record<string, AIModel['status']> = {
    queued: 'Not Trained',
    running: 'Training',
    completed: 'Trained',
    failed: 'Not Trained',
    cancelled: 'Not Trained',
  }
  return {
    id: j.id,
    name: j.name,
    type: 'YOLO',
    description: `Model: ${j.model_template}`,
    status: statusMap[j.status] ?? 'Not Trained',
    version: 'v1',
    lastUpdated: j.created_at,
    accuracy: j.accuracy ?? undefined,
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
