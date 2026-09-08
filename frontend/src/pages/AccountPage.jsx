import { useRef, useState } from 'react'
import Link from '../components/MotionLink'
import { useMotionNavigate as useNavigate } from '../hooks/useMotionNavigate'
import { useSession } from '../hooks/useSession'
import { clearSession, gatewayMediaUrl, gatewayRequest, setSessionUser, signOut } from '../services/gatewayClient'
import SessionBoundary from '../components/SessionBoundary'
import UnsavedChanges from '../components/UnsavedChanges'
import { RecoveryChoice } from '../components/DraftRecovery'
import { useDraftRecovery } from '../hooks/useDraftRecovery'
import { hasRecovery } from '../services/draftRecovery'
import { initials } from '../utils/initials'
import '../styles/account.css'

const roleNames = { reader: 'Leer y escribir', author: 'Leer y escribir', admin: 'Administrador' }

function ProfileEditor({ user }) {
  const [name, setName] = useState(user.name)
  const [biography, setBiography] = useState(user.biography)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)
  const pending = useRef(false)
  const navigate = useNavigate()
  const dirty = name !== user.name || biography !== user.biography
  const recovery = useDraftRecovery({ ownerId: user.id, key: 'profile', path: '/account', label: 'Tu perfil', read: () => !recovery && (dirty || busy) ? { name, biography } : null })
  const blocked = busy || Boolean(recovery)
  const recoveryPending = hasRecovery()
  async function perform(action, success) {
    if (pending.current || recovery) return
    pending.current = true
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await action()
      if (result?.user) setSessionUser(result.user)
      setMessage(success)
    } catch (error) { setError(error.message) }
    finally { pending.current = false; setBusy(false) }
  }
  function save(event) {
    event.preventDefault()
    perform(async () => {
      const result = await gatewayRequest('/users/me', { method: 'PATCH', body: { name, biography } })
      setName(result.user.name); setBiography(result.user.biography)
      return result
    }, 'Tu perfil se guardó.')
  }
  function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Elige un JPEG, PNG o WebP de hasta 2 MB.'); return
    }
    perform(() => gatewayRequest('/users/me/avatar', { method: 'PUT', body: file, headers: { 'Content-Type': file.type } }), 'Tu avatar se guardó.')
  }
  return <>
    <UnsavedChanges dirty={dirty} />
    <nav className="account-library form-actions" aria-label="Tu biblioteca"><Link className="text-link" to="/account/saved">Publicaciones guardadas</Link><Link className="text-link" to="/account/following">Autores que sigues</Link></nav>
    <RecoveryChoice entry={recovery} onRestore={(value) => { setName(value.name); setBiography(value.biography) }} />
    <section className="account-profile" aria-labelledby="profile-edit-title">
      <div className="account-profile__heading"><div><span className="eyebrow">{roleNames[user.role]}</span><h2 id="profile-edit-title">Tu perfil</h2></div><Link className="text-link" to={'/profile/' + user.id}>Ver perfil público</Link></div>
      <div className="account-avatar">
        {user.avatarUrl ? <img src={gatewayMediaUrl(user.avatarUrl)} width="88" height="88" alt="Tu avatar actual" /> : <span className="account-avatar__initial" aria-hidden="true">{initials(user.name)}</span>}
        <div><div className="form-actions"><button className="secondary-button" onClick={() => fileInput.current?.click()} disabled={blocked}>Cambiar avatar</button>{user.avatarUrl && <button className="text-button" disabled={blocked} onClick={() => perform(() => gatewayRequest('/users/me/avatar', { method: 'DELETE' }), 'Se quitó tu avatar.')}>Quitar avatar</button>}</div><p className="field-help">JPEG, PNG o WebP · Hasta 2 MB</p></div>
        <input ref={fileInput} className="visually-hidden" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Archivo de avatar" onChange={upload} />
      </div>
      <form onSubmit={save} className="account-form" aria-busy={busy}>
        <div className="form-field"><label htmlFor="profile-name">Nombre público</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} disabled={Boolean(recovery)} required minLength={2} maxLength={80} autoComplete="name" /></div>
        <div className="form-field"><label htmlFor="profile-biography">Biografía</label><textarea id="profile-biography" value={biography} onChange={(event) => setBiography(event.target.value)} disabled={Boolean(recovery)} maxLength={600} rows={5} aria-describedby="bio-help" /><small id="bio-help">{biography.length}/600 caracteres. No publiques información privada.</small></div>
        <p className="account-email">Correo de la cuenta: <span>{user.email}</span><small>No se muestra en tu perfil público.</small></p>
        <div className="form-actions"><button className="primary-button" disabled={blocked || !dirty}>{busy ? 'Guardando…' : 'Guardar perfil'}</button>{dirty && <button className="secondary-button" type="button" disabled={blocked} onClick={() => { setName(user.name); setBiography(user.biography) }}>Descartar cambios</button>}</div>
      </form>
      {message && <p className="success-message" role="status">{message}</p>}{error && <p className="form-feedback" role="alert">{error}</p>}
    </section>
    <section className="account-section"><h2>Comparte tus ideas</h2><p>Tu cuenta ya está lista para escribir. Cada nota pasa por revisión antes de publicarse.</p><Link className="text-link" to="/author">Escribir una nota</Link></section>
    <PasswordSection disabled={busy || dirty || recoveryPending} />
    <section className="account-section"><h2>Tu sesión</h2><p>Al salir, esta sesión se revoca en el servidor. Tus publicaciones y tu perfil se conservan.</p>{(dirty || recoveryPending) && <p className="field-help">Guarda o descarta los cambios antes de cerrar sesión.</p>}<button className="secondary-button" disabled={blocked || dirty || recoveryPending} onClick={() => perform(async () => { await signOut(); navigate('/login', { replace: true }) }, '')}>Cerrar sesión</button></section>
  </>
}

function PasswordSection({ disabled }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const navigate = useNavigate()
  async function submit(event) {
    event.preventDefault()
    if (pending.current) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    pending.current = true; setBusy(true); setError('')
    try {
      await gatewayRequest('/users/me/password', { method: 'POST', body: values })
      clearSession()
      navigate('/login?passwordChanged=1', { replace: true })
    } catch (error) { setError(error.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className="account-section"><details><summary>Cambiar contraseña</summary><p>Este cambio cerrará todas tus sesiones.</p><form className="account-form" onSubmit={submit}>
    <div className="form-field"><label htmlFor="current-password">Contraseña actual</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></div>
    <div className="form-field"><label htmlFor="new-password">Nueva contraseña</label><input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /><small>Usa al menos 12 caracteres.</small></div>
    <button className="secondary-button" disabled={busy || disabled}>{busy ? 'Cambiando…' : 'Guardar nueva contraseña'}</button>{error && <p className="form-feedback" role="alert">{error}</p>}
  </form></details></section>
}

export default function AccountPage() {
  const { user } = useSession()
  return <main id="main-content" className="account-page page-width" tabIndex={-1}><header className="account-heading"><span className="eyebrow">Tu espacio en otherbloc</span><h1>Mi cuenta</h1><div className="form-actions">{user && <Link className="text-link" to="/author">Mis publicaciones</Link>}{user?.role === 'admin' && <><Link className="text-link" to="/admin/users">Administrar usuarios</Link><Link className="text-link" to="/admin/publications">Revisar publicaciones</Link></>}</div></header><SessionBoundary>{user && <ProfileEditor key={user.id} user={user} />}</SessionBoundary></main>
}
