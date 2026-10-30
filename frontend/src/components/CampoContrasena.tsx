import { type ComponentProps, useState } from 'react'

// Campo de contraseña con botón para mostrarla u ocultarla
export function CampoContrasena({ className = '', ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [ver, setVer] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={ver ? 'text' : 'password'} className={`input pr-12 ${className}`} />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-stone-500 hover:text-stone-800"
        aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'}
        title={ver ? 'Ocultar contraseña' : 'Ver contraseña'}
      >
        {ver ? <OjoTachado /> : <Ojo />}
      </button>
    </div>
  )
}

const Ojo = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const OjoTachado = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
  </svg>
)
