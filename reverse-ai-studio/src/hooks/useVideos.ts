import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'

export function useVideos(filters?: { search?: string; status?: string; warehouse?: string; brand?: string }) {
  return useQuery({
    queryKey: ['videos', filters],
    queryFn: () => api.videos.getAll(filters),
  })
}

export function useVideo(id: string) {
  return useQuery({
    queryKey: ['video', id],
    queryFn: () => api.videos.getById(id),
    enabled: !!id,
  })
}

export function useUploadVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { file: File; warehouse: string; brand: string }) =>
      api.videos.upload(args.file, { warehouse: args.warehouse, brand: args.brand }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useImportVideoFromUrl() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { url: string; name?: string; warehouse: string; brand: string }) =>
      api.videos.importFromUrl(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useUpdateVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; warehouse?: string; brand?: string } }) =>
      api.videos.update(id, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['video', id] })
    },
  })
}

export function useDeleteVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.videos.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useFilterOptions() {
  const warehouses = useQuery({
    queryKey: ['filter-warehouses'],
    queryFn: () => api.filters.getWarehouses(),
  })
  const brands = useQuery({
    queryKey: ['filter-brands'],
    queryFn: () => api.filters.getBrands(),
  })
  return { warehouses: warehouses.data ?? [], brands: brands.data ?? [] }
}
