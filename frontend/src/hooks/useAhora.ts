import { useEffect, useState } from 'react'

// Hora actual que se actualiza sola para recalcular urgencias
export function useAhora(intervaloMs = 30_000) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return ahora
}
