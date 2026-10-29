import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Posicion {
  lat: number
  lng: number
  precision: number | null
  fecha: number
}

interface UbicacionState {
  // Preferencia del repartidor (se recuerda en el dispositivo)
  compartir: boolean
  miUbicacion: Posicion | null
  error: string | null
  setCompartir: (v: boolean) => void
  setMiUbicacion: (p: Posicion | null) => void
  setError: (e: string | null) => void
}

export const useUbicacion = create<UbicacionState>()(
  persist(
    (set) => ({
      compartir: true,
      miUbicacion: null,
      error: null,
      setCompartir: (compartir) => set({ compartir, ...(!compartir && { miUbicacion: null, error: null }) }),
      setMiUbicacion: (miUbicacion) => set({ miUbicacion, error: null }),
      setError: (error) => set({ error }),
    }),
    { name: 'entregas-ubicacion', partialize: (s) => ({ compartir: s.compartir }) },
  ),
)
