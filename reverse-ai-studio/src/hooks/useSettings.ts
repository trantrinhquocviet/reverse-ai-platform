import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Warehouse, Brand } from '@/types'

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.settings.getWarehouses(),
  })
}

export function useAddWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Warehouse, 'id' | 'createdAt'>) => api.settings.addWarehouse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
  })
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.settings.deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
  })
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: () => api.settings.getBrands(),
  })
}

export function useAddBrand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Brand, 'id' | 'createdAt'>) => api.settings.addBrand(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
    },
  })
}

export function useDeleteBrand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.settings.deleteBrand(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
    },
  })
}

export function useUserProfile() {
  return useQuery({
    queryKey: ['user-profile'],
    queryFn: () => api.settings.getUser(),
  })
}
