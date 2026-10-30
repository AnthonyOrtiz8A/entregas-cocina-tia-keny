# Entregas Cocina Tía Keny

Control de entregas de fiambre: clientes, dirección con punto en el mapa, día y hora, fiambres enteros y medios, extras, total y estado de pago. Las entregas se ven por día y se marcan como **urgente** (ya pasó la hora), **advertencia** (falta poco) o **a tiempo**.

```
backend/   API — Node + Hono + Drizzle ORM → Google Cloud Run + Neon (Postgres)
frontend/  App — React 19, TypeScript 6, Vite 8, Tailwind 4 → Vercel
```

| Capa | Tecnología |
| --- | --- |
| Interfaz | React 19, TypeScript 6, Vite 8 |
| Estilos | Tailwind CSS 4 |
| Rutas | React Router 7 (rutas protegidas y por rol) |
| Datos del servidor | TanStack Query 5 |
| Sesión | Zustand 5 (usuario y tokens) |
| Formularios | react-hook-form + Zod |
| Red | Axios (cliente único con interceptores y refresh de token) |
| Avisos | react-hot-toast |
| Mapa | Leaflet + OpenStreetMap / satélite Esri (gratis, sin API key) |

## Roles

- **Administrador**: crea, edita y elimina entregas; gestiona usuarios y precios.
- **Repartidor**: ve las entregas y las marca como entregadas o cobradas.

La primera vez que se abre la app pide crear la cuenta de administrador.

## Desarrollo local

### 1. Base de datos (Neon)

1. Crea una cuenta en <https://neon.tech> y un proyecto en la región **AWS US East 2 (Ohio)**, la más cercana a `us-central1` de Google Cloud.
2. Copia la *connection string* con **pooling** activado (el host lleva `-pooler`).

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env    # pega tu DATABASE_URL y un JWT_SECRET largo
npm run db:setup        # crea la base (si no existe) y las tablas
npm run dev             # http://localhost:8787
```

> También funciona con un Postgres local: `DATABASE_URL="postgresql://postgres:CONTRASEÑA@localhost:5432/entregas"`. Si la contraseña tiene caracteres como `@ : / # ?`, escríbelos codificados (`@` → `%40`, `#` → `%23`).

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:8787
npm run dev             # http://localhost:5173
```

### Lugares conocidos del mapa

Los negocios, iglesias, escuelas, etc. que aparecen en el mapa están en `frontend/public/lugares.json`.
Salen de los datos abiertos y gratuitos de [Overture Maps](https://overturemaps.org) (licencia CDLA Permissive 2.0).
Para actualizarlos (por ejemplo, cada pocos meses):

```bash
cd herramientas/lugares
npm install
npm run generar
```

## Despliegue

### Backend → Google Cloud Run

Requisitos: [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) y un proyecto con facturación activa (el uso de esta app entra en la capa gratuita de Cloud Run).

```bash
gcloud auth login
gcloud config set project TU_PROYECTO
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

Guarda los secretos en Secret Manager (una sola vez):

```bash
printf "postgresql://...-pooler...neon.tech/neondb?sslmode=require" | gcloud secrets create DATABASE_URL --data-file=-
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create JWT_SECRET --data-file=-
```

Da permiso a Cloud Run para leerlos (cambia `NUMERO` por el número de tu proyecto, aparece en la consola):

```bash
gcloud projects add-iam-policy-binding TU_PROYECTO --member=serviceAccount:NUMERO-compute@developer.gserviceaccount.com --role=roles/secretmanager.secretAccessor
```

Despliega desde la carpeta `backend` (usa el `Dockerfile`):

```bash
cd backend
gcloud run deploy entregas-api --source . --region us-central1 --allow-unauthenticated --set-secrets DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest --set-env-vars FRONTEND_URL=https://TU-APP.vercel.app
```

Al terminar muestra la URL (`https://entregas-api-xxxx.us-central1.run.app`). Para actualizar después basta con repetir el último comando. Si cambia el dominio de Vercel, actualiza `FRONTEND_URL`. Para permitir varios dominios sepáralos con coma, y como `--set-env-vars` también usa comas, escribe `^@^FRONTEND_URL=https://a.vercel.app,https://b.com`.

### Frontend → Vercel

1. Importa el repositorio en Vercel con **Root Directory = `frontend`** (Vite se detecta solo).
2. Variable de entorno: `VITE_API_URL=https://entregas-api-xxxx.us-central1.run.app` (la URL de Cloud Run, sin `/` al final).
3. `vercel.json` ya incluye la regla para que las rutas de React Router funcionen al recargar.
