import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { z } from 'zod'

export async function parseBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'JSON inválido' })
  })
  const result = schema.safeParse(body)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new HTTPException(400, {
      message: first ? `${first.path.join('.') || 'datos'}: ${first.message}` : 'Datos inválidos',
    })
  }
  return result.data
}
