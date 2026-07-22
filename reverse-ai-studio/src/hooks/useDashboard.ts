import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.dashboard.getStats(),
  })
}

export function useRecentVideos() {
  return useQuery({
    queryKey: ['dashboard-recent-videos'],
    queryFn: () => api.dashboard.getRecentVideos(),
  })
}

export function useActivities() {
  return useQuery({
    queryKey: ['dashboard-activities'],
    queryFn: () => api.dashboard.getActivities(),
  })
}
