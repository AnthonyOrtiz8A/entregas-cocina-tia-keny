// Lectura de avisos en voz alta con la voz del propio teléfono o compu (solo con la app abierta)

export const vozSoportada = () => 'speechSynthesis' in window

function vozEnEspanol() {
  const voces = speechSynthesis.getVoices()
  return (
    voces.find((v) => v.lang === 'es-MX') ??
    voces.find((v) => v.lang === 'es-US') ??
    voces.find((v) => v.lang.startsWith('es-4')) ?? // español de Latinoamérica (es-419)
    voces.find((v) => v.lang.startsWith('es'))
  )
}

// Algunos navegadores cargan la lista de voces después de abrir la página
if (vozSoportada()) speechSynthesis.getVoices()

export function hablar(texto: string) {
  if (!vozSoportada()) return
  const frase = new SpeechSynthesisUtterance(texto)
  const voz = vozEnEspanol()
  if (voz) frase.voice = voz
  frase.lang = voz?.lang ?? 'es-MX'
  frase.rate = 0.95
  speechSynthesis.speak(frase)
}

// Con la app abierta en varias pestañas, cada aviso se lee una sola vez
const CLAVE = 'entregas-avisos-leidos'
export function marcarLeido(id: string) {
  try {
    const ahora = Date.now()
    const leidos = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Record<string, number>
    if (leidos[id]) return false
    for (const [k, t] of Object.entries(leidos)) if (ahora - t > 3_600_000) delete leidos[k]
    leidos[id] = ahora
    localStorage.setItem(CLAVE, JSON.stringify(leidos))
    return true
  } catch {
    return true
  }
}
