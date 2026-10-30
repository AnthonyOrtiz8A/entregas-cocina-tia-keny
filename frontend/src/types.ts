export type Rol = 'admin' | 'repartidor'
export type EstadoPago = 'pendiente' | 'pagado'

export interface Usuario {
  id: number
  nombre: string
  usuario: string
  rol: Rol
  activo: boolean
}

export interface Entrega {
  id: number
  nombre: string
  telefono: string
  direccion: string
  lat: number | null
  lng: number | null
  fecha: string // AAAA-MM-DD
  hora: string | null // HH:MM, o null si no tiene hora definida
  enteros: number
  medios: number
  extras: string | null
  extrasMonto: number
  total: number
  estadoPago: EstadoPago
  entregado: boolean
  entregadoEn: string | null
  notas: string | null
  creadoEn: string
  actualizadoEn: string
}

export type EntregaInput = Omit<Entrega, 'id' | 'entregado' | 'entregadoEn' | 'creadoEn' | 'actualizadoEn'>

export interface ResumenDia {
  fecha: string
  total: number
  pendientes: number
  enteros: number
  medios: number
}

export interface Configuracion {
  precioEntero: number
  precioMedio: number
  minutosAdvertencia: number
}

export interface Sesion {
  usuario: Usuario
  accessToken: string
  refreshToken: string
}
