import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'

// Lugares conocidos de la zona (negocios, iglesias, escuelas…), generados con herramientas/lugares
export interface Lugar {
  n: string // nombre
  c: string | null // categoría (Overture Maps)
  d: string | null // dirección
  p: number // confianza (0 a 1)
  lat: number
  lng: number
}

export function useLugares() {
  return useQuery({
    queryKey: ['lugares'],
    // Archivo de la propia app: no cambia hasta que se publique otra versión
    queryFn: async () => ((await (await fetch('/lugares.json')).json()) as { lugares: Lugar[] }).lugares,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

interface Tipo {
  icono: string
  nombre: string
}

const TIPOS: Record<string, Tipo> = {
  restaurant: { icono: '🍽️', nombre: 'Restaurante' },
  casual_eatery: { icono: '🍽️', nombre: 'Comedor' },
  food_service: { icono: '🍽️', nombre: 'Comida' },
  food_and_drink: { icono: '🍽️', nombre: 'Comida y bebida' },
  fast_food_restaurant: { icono: '🍔', nombre: 'Comida rápida' },
  cafe: { icono: '☕', nombre: 'Cafetería' },
  coffee_shop: { icono: '☕', nombre: 'Cafetería' },
  bar: { icono: '🍺', nombre: 'Bar' },
  hotel: { icono: '🏨', nombre: 'Hotel' },
  lodging: { icono: '🏨', nombre: 'Hospedaje' },
  private_lodging: { icono: '🏨', nombre: 'Hospedaje' },
  campground: { icono: '🏕️', nombre: 'Área de camping' },
  convenience_store: { icono: '🏪', nombre: 'Tienda' },
  food_and_beverage_store: { icono: '🛒', nombre: 'Tienda de alimentos' },
  shopping: { icono: '🛍️', nombre: 'Comercio' },
  fashion_and_apparel_store: { icono: '👕', nombre: 'Tienda de ropa' },
  second_hand_store: { icono: '🛍️', nombre: 'Venta de segunda mano' },
  electronics_store: { icono: '📱', nombre: 'Electrónica' },
  books_music_and_video_store: { icono: '📚', nombre: 'Librería' },
  hardware_home_and_garden_store: { icono: '🔨', nombre: 'Ferretería' },
  christian_place_of_worship: { icono: '⛪', nombre: 'Iglesia' },
  religious_organization: { icono: '⛪', nombre: 'Iglesia' },
  place_of_learning: { icono: '🏫', nombre: 'Escuela' },
  education: { icono: '🏫', nombre: 'Educación' },
  elementary_school: { icono: '🏫', nombre: 'Escuela primaria' },
  middle_school: { icono: '🏫', nombre: 'Instituto básico' },
  high_school: { icono: '🏫', nombre: 'Instituto' },
  college_university: { icono: '🎓', nombre: 'Universidad' },
  hospital: { icono: '🏥', nombre: 'Hospital' },
  health_care: { icono: '🏥', nombre: 'Clínica' },
  dental_clinic: { icono: '🦷', nombre: 'Dentista' },
  vision_or_eye_care_clinic: { icono: '👓', nombre: 'Óptica' },
  reproductive_perinatal_and_womens_care: { icono: '🏥', nombre: 'Clínica' },
  pharmacy_and_drug_store: { icono: '💊', nombre: 'Farmacia' },
  animal_or_pet_service: { icono: '🐾', nombre: 'Veterinaria' },
  gas_station: { icono: '⛽', nombre: 'Gasolinera' },
  financial_service: { icono: '🏦', nombre: 'Banco / financiera' },
  bank_or_credit_union: { icono: '🏦', nombre: 'Banco' },
  government_office: { icono: '🏛️', nombre: 'Oficina de gobierno' },
  police_station: { icono: '👮', nombre: 'Policía' },
  park: { icono: '🌳', nombre: 'Parque' },
  beach: { icono: '🏖️', nombre: 'Playa' },
  waterfall: { icono: '💧', nombre: 'Cascada' },
  historic_site: { icono: '🏛️', nombre: 'Sitio conocido' },
  gym: { icono: '🏋️', nombre: 'Gimnasio' },
  sport_or_fitness_facility: { icono: '🏋️', nombre: 'Gimnasio' },
  sport_or_recreation_club: { icono: '⚽', nombre: 'Club deportivo' },
  sport_team: { icono: '⚽', nombre: 'Equipo deportivo' },
  stadium_arena: { icono: '🏟️', nombre: 'Estadio' },
  vehicle_dealer: { icono: '🚗', nombre: 'Venta de vehículos' },
  automotive_service: { icono: '🔧', nombre: 'Taller' },
  vehicle_service: { icono: '🔧', nombre: 'Taller' },
  personal_or_beauty_service: { icono: '💇', nombre: 'Salón de belleza' },
  wellness_service: { icono: '💆', nombre: 'Bienestar' },
  music_venue: { icono: '🎵', nombre: 'Música / eventos' },
  event_or_party_service: { icono: '🎉', nombre: 'Eventos' },
  public_transit_facility_or_service: { icono: '🚌', nombre: 'Transporte' },
  electric_utility_provider: { icono: '⚡', nombre: 'Energía eléctrica' },
}

// Lo que más sirve para orientarse en el pueblo se muestra primero al alejar el mapa
const REFERENCIAS = new Set([
  'gas_station', 'bank_or_credit_union', 'financial_service', 'pharmacy_and_drug_store', 'hospital',
  'government_office', 'police_station', 'christian_place_of_worship', 'religious_organization', 'park',
  'fast_food_restaurant', 'convenience_store', 'food_and_beverage_store', 'college_university', 'high_school',
])
const CADENAS = /domino|campero|pizza|despensa|maxi|banrural|banco|bi |shell|puma|texaco|uno |farmacia/i

/** Más alto = más importante para mostrarse cuando no caben todos */
export const importancia = (l: Lugar) =>
  l.p + (CADENAS.test(l.n) ? 1 : 0) + (REFERENCIAS.has(l.c ?? '') ? 0.5 : 0) - (l.c ? 0 : 0.5)

export function tipoDe(l: Lugar): Tipo {
  // Algunos nombres dicen más que la categoría
  if (/domino|pizza/i.test(l.n)) return { icono: '🍕', nombre: 'Pizzería' }
  if (/campero|pollo/i.test(l.n)) return { icono: '🍗', nombre: TIPOS[l.c ?? '']?.nombre ?? 'Restaurante' }
  return TIPOS[l.c ?? ''] ?? { icono: '📍', nombre: 'Lugar' }
}

const escaparHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// Se reutilizan los íconos para no redibujar los marcadores en cada movimiento del mapa
const iconos = new Map<string, L.DivIcon>()

/** Ícono del lugar; con `conNombre` se muestra el nombre debajo (cuando el mapa está cerca) */
export function iconoLugar(l: Lugar, conNombre: boolean) {
  const clave = `${l.n}|${l.lat}|${l.lng}|${conNombre}`
  let icono = iconos.get(clave)
  if (!icono) {
    icono = crearIcono(l, conNombre)
    iconos.set(clave, icono)
  }
  return icono
}

function crearIcono(l: Lugar, conNombre: boolean) {
  return L.divIcon({
    className: 'pin',
    html: `<div class="lugar"><span class="icono">${tipoDe(l).icono}</span>${conNombre ? `<span class="nombre">${escaparHtml(l.n)}</span>` : ''}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  })
}

/** Algunas direcciones vienen en MAYÚSCULAS: se pasan a "Mayúscula Inicial" */
export function direccionDe(l: Lugar) {
  if (!l.d) return null
  if (l.d !== l.d.toUpperCase()) return l.d
  return l.d.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, espacio: string, letra: string) => espacio + letra.toUpperCase())
}

export const contenidoPopupLugar = (l: Lugar) => {
  const direccion = direccionDe(l)
  return `<p style="font-weight:600">${escaparHtml(l.n)}</p><p style="color:#57534e">${escaparHtml(tipoDe(l).nombre)}</p>${
    direccion ? `<p style="color:#57534e">${escaparHtml(direccion)}</p>` : ''
  }`
}

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Busca por nombre o tipo ("domino", "farmacia", "iglesia"…) */
export function buscarLugares(lugares: Lugar[], texto: string, max = 8) {
  const q = normalizar(texto.trim())
  if (q.length < 2) return []
  return lugares
    .map((l) => {
      const nombre = normalizar(l.n)
      const puntos = nombre.startsWith(q) ? 3 : nombre.includes(q) ? 2 : normalizar(tipoDe(l).nombre).includes(q) ? 1 : 0
      return { l, puntos }
    })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.l.n.localeCompare(b.l.n, 'es'))
    .slice(0, max)
    .map((x) => x.l)
}
