// Variables de entorno: en local salen de .env, en Vercel de la configuración del proyecto
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
  // Notificaciones push (opcionales: sin estas claves la app funciona, pero sin notificaciones al teléfono)
  vapid: {
    publica: process.env.VAPID_PUBLIC_KEY ?? '',
    privada: process.env.VAPID_PRIVATE_KEY ?? '',
    contacto: process.env.VAPID_SUBJECT ?? 'https://entregas-cocina-tia-keny.vercel.app',
  },
  // Clave para que un servicio externo (cron) revise las entregas atrasadas
  cronSecret: process.env.CRON_SECRET ?? '',
}
