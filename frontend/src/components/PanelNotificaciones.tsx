import { useState } from 'react'
import toast from 'react-hot-toast'
import { mensajeError } from '../lib/api'
import {
  activarNotificaciones,
  esIphoneSinInstalar,
  notificacionesSoportadas,
  probarNotificaciones,
  pushSoportado,
} from '../lib/avisos'
import { hablar, vozSoportada } from '../lib/voz'
import { usePreferencias } from '../store/preferencias'

const permisoActual = () => (notificacionesSoportadas() ? Notification.permission : null)

/** Estado de las notificaciones en este teléfono, con botones para activarlas y probarlas */
export function PanelNotificaciones({ onCerrar }: { onCerrar: () => void }) {
  const [permiso, setPermiso] = useState(permisoActual)
  const [ocupado, setOcupado] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  async function activar() {
    setOcupado(true)
    try {
      setPermiso(await activarNotificaciones())
    } catch (err) {
      setResultado({ tipo: 'error', texto: `No se pudieron activar: ${mensajeError(err, (err as Error).message)}` })
    } finally {
      setOcupado(false)
    }
  }

  async function probar() {
    setOcupado(true)
    setResultado(null)
    try {
      const r = await probarNotificaciones()
      if (r.estado === 'servidor-sin-claves' || !r.configurado) {
        setResultado({
          tipo: 'error',
          texto: 'El servidor no tiene las claves de notificaciones (VAPID). Agrégalas en Vercel y haz Redeploy.',
        })
      } else if (r.telefonos === 0) {
        setResultado({ tipo: 'error', texto: 'Este teléfono no quedó registrado para recibir notificaciones.' })
      } else if (r.enviados === 0) {
        setResultado({ tipo: 'error', texto: `El envío falló: ${r.errores.join(' · ') || 'sin detalle'}` })
      } else {
        setResultado({
          tipo: 'ok',
          texto: `Enviada a ${r.enviados} ${r.enviados === 1 ? 'dispositivo' : 'dispositivos'}. Debe aparecer en unos segundos.`,
        })
      }
    } catch (err) {
      setResultado({ tipo: 'error', texto: `No se pudo probar: ${mensajeError(err, (err as Error).message)}` })
      toast.error('No se pudo enviar la prueba')
    } finally {
      setOcupado(false)
    }
  }

  let estado: { texto: string; color: string }
  if (esIphoneSinInstalar() && !pushSoportado()) estado = { texto: 'Falta instalar la app', color: 'bg-amber-400' }
  else if (!permiso || !pushSoportado()) estado = { texto: 'Este navegador no las permite', color: 'bg-stone-400' }
  else if (permiso === 'granted') estado = { texto: 'Activadas', color: 'bg-emerald-500' }
  else if (permiso === 'denied') estado = { texto: 'Bloqueadas', color: 'bg-red-500' }
  else estado = { texto: 'Sin activar', color: 'bg-amber-400' }

  return (
    <div className="border-b border-stone-200 bg-white px-4 py-3 text-sm shadow-sm">
      <div className="mx-auto max-w-5xl space-y-2">
        <div className="flex items-center gap-2">
          <p className="font-semibold">Notificaciones en este teléfono</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium">
            <span className={`size-2 rounded-full ${estado.color}`} />
            {estado.texto}
          </span>
          <button onClick={onCerrar} className="ml-auto px-2 text-stone-500" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {esIphoneSinInstalar() && !pushSoportado() ? (
          <p className="text-stone-600">
            En iPhone toca <b>Compartir</b> → <b>Agregar a pantalla de inicio</b> y abre la app desde ese ícono.
          </p>
        ) : permiso === 'denied' ? (
          <p className="text-stone-600">
            Las bloqueaste antes. Toca el <b>candado</b> (o los <b>⋮</b>) junto a la dirección → <b>Permisos</b> →{' '}
            <b>Notificaciones</b> → <b>Permitir</b>, y recarga la app. Revisa también que las notificaciones del
            navegador estén permitidas en los ajustes del teléfono.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {permiso === 'default' && (
            <button className="btn-primario py-1.5" onClick={activar} disabled={ocupado}>
              Activar
            </button>
          )}
          {permiso === 'granted' && (
            <button className="btn-secundario py-1.5" onClick={probar} disabled={ocupado}>
              {ocupado ? 'Enviando…' : 'Enviar notificación de prueba'}
            </button>
          )}
        </div>

        {resultado && (
          <p className={resultado.tipo === 'ok' ? 'text-emerald-700' : 'text-red-700'}>{resultado.texto}</p>
        )}

        <OpcionVoz />
      </div>
    </div>
  )
}

function OpcionVoz() {
  const { voz, setVoz } = usePreferencias()
  if (!vozSoportada()) return null
  return (
    <div className="space-y-1.5 border-t border-stone-200 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" className="size-4 accent-marca-700" checked={voz} onChange={(e) => setVoz(e.target.checked)} />
          🔊 Leer los avisos en voz alta
        </label>
        {voz && (
          <button
            className="btn-secundario py-1"
            onClick={() => hablar('Nueva entrega registrada para las 4 y 30 de la tarde, para la dirección Barrio El Centro')}
          >
            Probar voz
          </button>
        )}
      </div>
      <p className="text-xs text-stone-500">
        Solo funciona con la app abierta (puede estar minimizada). Después de abrirla, toca la pantalla una vez para que el
        navegador permita la voz.
      </p>
    </div>
  )
}
