import { useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import Link from '../MotionLink'
import { useMotionNavigate as useNavigate } from '../../hooks/useMotionNavigate'
import { useSession } from '../../hooks/useSession'
import { signIn } from '../../services/gatewayClient'
import { ArrowLeft } from '@phosphor-icons/react'
import ThemeControl from '../ThemeControl/ThemeControl'
import './AuthForm.css'

export default function AuthForm({ mode }) {
  const register = mode === 'register'
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState([])
  const submitted = useRef(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useSession()
  const requested = params.get('returnTo')
  const destination = requested?.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\') && !/^\/(login|register)(?:[/?#]|$)/.test(requested) ? requested : '/account'
  if (user && !busy) return <Navigate to={destination} replace />
  async function submit(event) {
    event.preventDefault()
    if (submitted.current) return
    submitted.current = true
    const data = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true)
    setMessage('')
    setFields([])
    try {
      await signIn(register ? 'register' : 'login', data)
      navigate(destination, { replace: true })
    } catch (error) {
      setMessage(error.message)
      setFields(error.fields ?? [])
    } finally { setBusy(false); submitted.current = false }
  }
  const invalid = (name) => fields.some((field) => field.field === name) || undefined
  return (
    <>
      <header className="auth-header">
        <Link to="/"><img className="brand-logo" src="/brand/otherbloc-logo-black.svg" alt="otherbloc, inicio" /></Link>
        <div><ThemeControl /><Link to="/"><ArrowLeft size={16} aria-hidden="true" /> Volver a leer</Link></div>
      </header>
      <main id="main-content" tabIndex={-1} className="access-page">
        <aside className="access-photo" aria-label="Un espacio para la lectura">
          <img className="access-photo__image" src="/images/lectura.webp" alt="Una persona leyendo en una biblioteca" width="1536" height="1024" loading="lazy" />
          <img className="access-photo__brand" src="/brand/otherbloc-logo-black.svg" alt="" />
          <div className="access-photo__copy"><h2>Una cuenta.<br />Muchas miradas.</h2><p>Lee, guarda y comparte ideas.<br />Encuentra tu lugar entre otras voces.</p></div>
        </aside>
        <section className="access-form" aria-labelledby="access-title" key={mode}>
          <span className="access-form__eyebrow">Bienvenido a otherbloc</span>
          <h1 id="access-title">{register ? 'Haz espacio para tus ideas.' : 'Qué bueno volver a leerte.'}</h1>
          <p className="access-form__intro">{register ? 'Crea una cuenta para descubrir, guardar y compartir otras miradas.' : 'Entra a tu cuenta y continúa donde dejaste la lectura.'}</p>
          {!register && params.get('passwordChanged') === '1' && <p className="success-message" role="status">Contraseña actualizada. Inicia sesión con la nueva contraseña.</p>}
          <form onSubmit={submit} aria-busy={busy}>
            {register && <div className="form-field"><label htmlFor="access-name">Nombre</label><input id="access-name" name="name" autoComplete="name" required minLength={2} maxLength={80} aria-invalid={invalid('name')} /></div>}
            <div className="form-field"><label htmlFor="access-email">Correo electrónico</label><input id="access-email" name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={invalid('email')} /></div>
            <div className="form-field"><label htmlFor="access-password">Contraseña</label><input id="access-password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : 1} maxLength={128} aria-describedby={register ? 'password-help' : undefined} aria-invalid={invalid('password')} />
              {register && <small id="password-help">Usa al menos 12 caracteres. Puedes escribir una frase.</small>}
            </div>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Comprobando…' : register ? 'Crear cuenta' : 'Iniciar sesión'}</button>
            {message && <div className="form-feedback" role="alert"><p>{message}</p>{fields.length > 0 && <ul>{fields.map((field, index) => <li key={index}>{field.message}</li>)}</ul>}</div>}
          </form>
          <p className="access-form__alternative">{register ? '¿Ya tienes una cuenta?' : '¿Todavía no tienes cuenta?'} <Link to={(register ? '/login' : '/register') + '?returnTo=' + encodeURIComponent(destination)} onClick={() => { setMessage(''); setFields([]) }}>{register ? 'Inicia sesión' : 'Crea una cuenta'}</Link></p>
        </section>
      </main>
    </>
  )
}
