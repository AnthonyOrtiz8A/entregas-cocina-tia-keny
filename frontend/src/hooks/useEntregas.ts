import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { marcarCambioPropio } from '../lib/avisos'
import type { Configuracion, Entrega, EntregaInput, EstadoPago, ResumenDia } from '../types'

export const claves = {
  entregas: ['entregas'] as const,
  dia: (fecha: string) => ['entregas', 'dia', fecha] as const,
  dias: (desde: string) => ['entregas', 'dias', desde] as const,
  detalle: (id: number) => ['entregas', 'detalle', id] as const,
  configuracion: ['configuracion'] as const,
}

export function useEntregasDelDia(fecha: string) {
  return useQuery({
    queryKey: claves.dia(fecha),
    queryFn: async () => (await api.get<Entrega[]>('/entregas', { params: { fecha } })).data,
    // Mantiene sincronizados a varios usuarios trabajando al mismo tiempo
    refetchInterval: 60_000,
  })
}

export function useResumenDias(desde: string) {
  return useQuery({
    queryKey: claves.dias(desde),
    queryFn: async () => (await api.get<ResumenDia[]>('/entregas/dias', { params: { desde } })).data,
    refetchInterval: 60_000,
  })
}

export function useEntrega(id: number | undefined) {
  return useQuery({
    queryKey: claves.detalle(id ?? 0),
    queryFn: async () => (await api.get<Entrega>(`/entregas/${id}`)).data,
    enabled: !!id,
  })
}

export function useGuardarEntrega() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, datos }: { id?: number; datos: EntregaInput }) =>
      id
        ? (await api.put<Entrega>(`/entregas/${id}`, datos)).data
        : (await api.post<Entrega>('/entregas', datos)).data,
    onSuccess: (entrega) => {
      marcarCambioPropio(entrega.id)
      return qc.invalidateQueries({ queryKey: claves.entregas })
    },
  })
}

export function useCambiarEstado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...cambios }: { id: number; entregado?: boolean; estadoPago?: EstadoPago }) =>
      (await api.patch<Entrega>(`/entregas/${id}/estado`, cambios)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.entregas }),
  })
}

export function useEliminarEntrega() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/entregas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.entregas }),
  })
}

export function useConfiguracion() {
  return useQuery({
    queryKey: claves.configuracion,
    queryFn: async () => (await api.get<Configuracion>('/configuracion')).data,
    staleTime: 5 * 60_000,
  })
}

export function useGuardarConfiguracion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (datos: Configuracion) => (await api.put<Configuracion>('/configuracion', datos)).data,
    onSuccess: (data) => qc.setQueryData(claves.configuracion, data),
  })
}
