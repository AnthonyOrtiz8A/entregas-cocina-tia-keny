import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { Link, Navigate, RouterProvider, createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'
import { RutaProtegida } from './components/RutaProtegida'
import './index.css'
import { ConfiguracionPage } from './pages/ConfiguracionPage'
import { EntregaFormPage } from './pages/EntregaFormPage'
import { EntregasPage } from './pages/EntregasPage'
import { LoginPage } from './pages/LoginPage'
import { UsuariosPage } from './pages/UsuariosPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // No reintentar errores de cliente (401, 403, 404…)
      retry: (intentos, error) =>
        !(axios.isAxiosError(error) && error.response && error.response.status < 500) && intentos < 2,
    },
  },
})

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RutaProtegida />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Navigate to="/entregas" replace /> },
          { path: 'entregas', element: <EntregasPage /> },
          {
            element: <RutaProtegida roles={['admin']} />,
            children: [
              { path: 'entregas/nueva', element: <EntregaFormPage /> },
              { path: 'entregas/:id/editar', element: <EntregaFormPage /> },
              { path: 'usuarios', element: <UsuariosPage /> },
              { path: 'configuracion', element: <ConfiguracionPage /> },
            ],
          },
          {
            path: '*',
            element: (
              <div className="tarjeta space-y-3 p-8 text-center">
                <p className="text-lg font-semibold">Página no encontrada</p>
                <Link to="/entregas" className="btn-primario">
                  Ir a entregas
                </Link>
              </div>
            ),
          },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { zIndex: 9999 } }} />
    </QueryClientProvider>
  </StrictMode>,
)
