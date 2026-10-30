import { sign, verify } from 'hono/jwt'
import type { Usuario } from '../db/schema.js'
import type { TokenPayload } from '../types.js'

const ACCESS_TTL = 60 * 30 // 30 minutos
const REFRESH_TTL = 60 * 60 * 24 * 30 // 30 días

export async function createTokens(user: Pick<Usuario, 'id' | 'rol' | 'nombre'>, secret: string) {
  const now = Math.floor(Date.now() / 1000)
  const base = { sub: user.id, rol: user.rol, nombre: user.nombre }
  const [accessToken, refreshToken] = await Promise.all([
    sign({ ...base, typ: 'access', exp: now + ACCESS_TTL }, secret, 'HS256'),
    sign({ ...base, typ: 'refresh', exp: now + REFRESH_TTL }, secret, 'HS256'),
  ])
  return { accessToken, refreshToken }
}

export async function readToken(token: string, secret: string, typ: TokenPayload['typ']) {
  const payload = (await verify(token, secret, 'HS256')) as unknown as TokenPayload
  if (payload.typ !== typ) throw new Error('Tipo de token inválido')
  return payload
}

export const publicUser = (u: Usuario) => ({
  id: u.id,
  nombre: u.nombre,
  usuario: u.usuario,
  rol: u.rol,
  activo: u.activo,
})
