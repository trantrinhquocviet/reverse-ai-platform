import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'

export function useDatasetStats() {
  return useQuery({
    queryKey: ['dataset-stats'],
    queryFn: () => api.dataset.getStats(),
  })
}

export function useDatasetImages() {
  return useQuery({
    queryKey: ['dataset-images'],
    queryFn: () => api.dataset.getImages(),
  })
}
