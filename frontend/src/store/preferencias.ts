import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreferenciasState {
  // Leer los avisos en voz alta en este dispositivo
  voz: boolean
  setVoz: (v: boolean) => void
}

export const usePreferencias = create<PreferenciasState>()(
  persist((set) => ({ voz: true, setVoz: (voz) => set({ voz }) }), { name: 'entregas-preferencias' }),
)
