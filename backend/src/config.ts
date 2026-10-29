// Variables de entorno: en local salen de .env, en Cloud Run de la configuración del servicio
function requerida(nombre: string) {
  const valor = process.env[nombre]
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`)
  return valor
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: requerida('DATABASE_URL'),
  jwtSecret: requerida('JWT_SECRET'),
  // Orígenes permitidos para CORS, separados por coma
  frontendUrls: (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
}
