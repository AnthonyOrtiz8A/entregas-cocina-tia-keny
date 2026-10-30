import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'
import {
  type Aviso,
  avisar,
  avisoCambio,
  avisoNueva,
  avisoUrgencia,
  esCambioPropio,
  sincronizarSuscripcion,
} from '../lib/avisos'
import { hoyISO, minutosRestantes, urgenciaDe, type Urgencia } from '../lib/fechas'
import type { Entrega } from '../types'
import { useAhora } from './useAhora'
import { claves, useConfiguracion, useEntregasDelDia } from './useEntregas'

const GRAVEDAD: Record<Urgencia, number> = { entregada: 0, normal: 1, advertencia: 2, urgente: 3 }

/**
 * Vigila las entregas de hoy mientras la app está abierta y avisa (toast + notificación) cuando:
 * hay una entrega nueva, cambia de hora o de lugar, o pasa a advertencia / atrasada.
 * También recibe los avisos push que llegan del servidor.
 */
export function useAvisos() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const ahora = useAhora(20_000)
  const hoy = hoyISO()
  const { data: entregas } = useEntregasDelDia(hoy)
  const { data: config } = useConfiguracion()
  const minutosAdvertencia = config?.minutosAdvertencia ?? 30

  // Suscribe este teléfono a las notificaciones push si ya dio permiso
  useEffect(() => {
    sincronizarSuscripcion().catch(() => {})
  }, [])

  // Mensajes del service worker: aviso push con la app abierta, o toque en una notificación
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const alMensaje = (ev: MessageEvent<{ tipo: string; aviso?: Aviso; url?: string }>) => {
      if (ev.data?.tipo === 'aviso' && ev.data.aviso) {
        avisar(ev.data.aviso)
        qc.invalidateQueries({ queryKey: claves.entregas })
      } else if (ev.data?.tipo === 'ir' && ev.data.url) {
        const url = new URL(ev.data.url)
        navigate(url.pathname + url.search)
      }
    }
    navigator.serviceWorker.addEventListener('message', alMensaje)
    return () => navigator.serviceWorker.removeEventListener('message', alMensaje)
  }, [qc, navigate])

  // Le pide al servidor que revise atrasos: así llegan los avisos a los teléfonos con la app cerrada.
  // También en segundo plano, para que una compu con la app minimizada siga revisando.
  useEffect(() => {
    const revisar = () => api.post('/avisos/revisar').catch(() => {})
    revisar()
    const id = setInterval(revisar, 60_000)
    return () => clearInterval(id)
  }, [])

  // Entregas nuevas o con otra hora / lugar
  const previas = useRef<{ fecha: string; mapa: Map<number, Entrega> } | null>(null)
  useEffect(() => {
    if (!entregas) return
    const anterior = previas.current?.fecha === hoy ? previas.current.mapa : null
    if (anterior) {
      // La lista viene en orden de llegada: su posición es el número de orden del pedido
      entregas.forEach((e, i) => {
        if (esCambioPropio(e.id)) return
        const antes = anterior.get(e.id)
        const aviso = antes ? avisoCambio(antes, e, i + 1) : avisoNueva(e)
        if (aviso) avisar(aviso)
      })
    }
    previas.current = { fecha: hoy, mapa: new Map(entregas.map((e) => [e.id, e])) }
  }, [entregas, hoy])

  // Pasa a "por llegar la hora" o a "atrasada"
  const niveles = useRef(new Map<number, Urgencia>())
  useEffect(() => {
    if (!entregas) return
    for (const e of entregas) {
      const nivel = urgenciaDe(e, ahora, minutosAdvertencia)
      const antes = niveles.current.get(e.id)
      // La primera vez solo se anota: no se avisa de lo que ya estaba así al abrir la app.
      // Tampoco al deshacer una entrega (de "entregada" a pendiente).
      const subio = antes && antes !== 'entregada' && GRAVEDAD[nivel] > GRAVEDAD[antes]
      if (subio && (nivel === 'advertencia' || nivel === 'urgente')) {
        avisar(avisoUrgencia(e, nivel, minutosRestantes(e, ahora)))
      }
      niveles.current.set(e.id, nivel)
    }
  }, [entregas, ahora, minutosAdvertencia])
}
