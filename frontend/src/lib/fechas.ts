import type { Entrega } from '../types'

// Fecha local en formato AAAA-MM-DD (en-CA usa ese formato)
export const fechaISO = (d: Date) => d.toLocaleDateString('en-CA')

export const hoyISO = () => fechaISO(new Date())

export function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return fechaISO(d)
}

export function nombreDia(fecha: string) {
  const hoy = hoyISO()
  if (fecha === hoy) return 'Hoy'
  if (fecha === sumarDias(hoy, 1)) return 'Mañana'
  if (fecha === sumarDias(hoy, -1)) return 'Ayer'
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-GT', { weekday: 'long' })
}

export const fechaLarga = (fecha: string) =>
  new Date(`${fecha}T12:00:00`).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })

export const fechaCorta = (fecha: string) =>
  new Date(`${fecha}T12:00:00`).toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })

export function hora12(hora: string | null) {
  if (!hora) return 'Sin hora'
  const [h = 0, m = 0] = hora.split(':').map(Number)
  const sufijo = h >= 12 ? 'p. m.' : 'a. m.'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${sufijo}`
}

export type Urgencia = 'urgente' | 'advertencia' | 'normal' | 'entregada'

/** Minutos que faltan para la hora de entrega (negativo si ya pasó); null si no tiene hora */
export function minutosRestantes(e: Pick<Entrega, 'fecha' | 'hora'>, ahora: number) {
  if (!e.hora) return null
  return Math.round((new Date(`${e.fecha}T${e.hora}:00`).getTime() - ahora) / 60_000)
}

// Sin hora definida no hay urgencia: siempre "normal" hasta que se entregue
export function urgenciaDe(e: Entrega, ahora: number, minutosAdvertencia: number): Urgencia {
  if (e.entregado) return 'entregada'
  const min = minutosRestantes(e, ahora)
  if (min === null) return 'normal'
  if (min < 0) return 'urgente'
  if (min <= minutosAdvertencia) return 'advertencia'
  return 'normal'
}

export function describirTiempo(minutos: number) {
  const abs = Math.abs(minutos)
  if (abs < 1) return 'justo ahora'
  let texto: string
  if (abs < 60) texto = `${abs} min`
  else if (abs < 1440) texto = abs % 60 ? `${Math.floor(abs / 60)} h ${abs % 60} min` : `${abs / 60} h`
  else texto = `${Math.floor(abs / 1440)} d`
  return minutos < 0 ? `atrasada ${texto}` : `en ${texto}`
}

export const quetzales = (n: number) =>
  `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
