import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Sesion, Usuario } from '../types'

interface AuthState {
  usuario: Usuario | null
  accessToken: string | null
  refreshToken: string | null
  setSesion: (s: Sesion) => void
  setUsuario: (u: Usuario) => void
  cerrarSesion: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      accessToken: null,
      refreshToken: null,
      setSesion: ({ usuario, accessToken, refreshToken }) => set({ usuario, accessToken, refreshToken }),
      setUsuario: (usuario) => set({ usuario }),
      cerrarSesion: () => set({ usuario: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'entregas-sesion' },
  ),
)

export const useEsAdmin = () => useAuth((s) => s.usuario?.rol === 'admin')
