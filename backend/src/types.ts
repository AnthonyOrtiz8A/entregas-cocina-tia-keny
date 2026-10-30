import type { Db } from './db/client.js'

export type Rol = 'admin' | 'repartidor'

export interface TokenPayload {
  sub: number
  rol: Rol
  nombre: string
  typ: 'access' | 'refresh'
  exp: number
  [key: string]: unknown
}

export type AppEnv = {
  Variables: {
    db: Db
    user: TokenPayload
  }
}
