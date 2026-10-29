import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Rol, Usuario } from '../types'

const clave = ['usuarios'] as const

export function useUsuarios() {
  return useQuery({
    queryKey: clave,
    queryFn: async () => (await api.get<Usuario[]>('/usuarios')).data,
  })
}

export function useCrearUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (datos: { nombre: string; usuario: string; password: string; rol: Rol }) =>
      (await api.post<Usuario>('/usuarios', datos)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: clave }),
  })
}

export function useEditarUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...datos }: { id: number; rol?: Rol; activo?: boolean; password?: string }) =>
      (await api.patch<Usuario>(`/usuarios/${id}`, datos)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: clave }),
  })
}
