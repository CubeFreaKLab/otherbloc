import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SessionBoundary from '../components/SessionBoundary'
import { useSession } from '../hooks/useSession'
import { gatewayRequest } from '../services/gatewayClient'
import '../styles/account.css'

const labels = { reader: 'Lector', author: 'Autor', admin: 'Administrador' }

function UserManagement() {
  const { user } = useSession()
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState('reader')
  const [status, setStatus] = useState('active')
  const dialog = useRef(null)
  const pending = useRef(false)
  const load = useCallback(async (after = null) => {
    setLoading(true); setError('')
    try {
      const result = await gatewayRequest('/users?limit=20' + (after ? '&cursor=' + encodeURIComponent(after) : ''))
      setItems((previous) => after ? [...previous, ...result.items] : result.items)
      setCursor(result.nextCursor)
    } catch (error) { setError(error.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (selected) dialog.current?.showModal(); else dialog.current?.close() }, [selected])
  function choose(item) { setRole(item.role); setStatus(item.status); setError(''); setSelected(item) }
  async function save(event) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setSaving(true); setError('')
    try {
      const result = await gatewayRequest('/users/' + selected.id + '/permissions', { method: 'PATCH', body: { role, status } })
      setItems((values) => values.map((item) => item.id === result.user.id ? result.user : item))
      setNotice('Permisos actualizados para ' + result.user.name + '.')
      setSelected(null)
    } catch (error) { setError(error.message) }
    finally { pending.current = false; setSaving(false) }
  }
  return <>
    <p>Administra permisos y solicitudes de autor. Cambiar un rol o suspender una cuenta cierra sus sesiones existentes.</p>
    {notice && <p className="success-message" role="status">{notice}</p>}
    {error && !selected && <div role="alert"><p className="form-feedback">{error}</p><button className="secondary-button" onClick={() => load()}>Reintentar</button></div>}
    {loading && !items.length && <div aria-busy="true" role="status"><div className="text-skeleton" /><p>Cargando usuarios…</p></div>}
    {!loading && !error && !items.length && <p role="status">No hay usuarios en esta vista.</p>}
    <ul className="admin-users-list">{items.map((item) => <li key={item.id} data-user-id={item.id}>
      <div><h2>{item.name}</h2><p>{item.email}</p><span className="user-status">{labels[item.role]} · {item.status === 'active' ? 'Cuenta activa' : 'Suspendida'}{item.authorRequested ? ' · Solicita ser autor' : ''}</span></div>
      <button className="secondary-button" disabled={item.id === user.id || loading} onClick={() => choose(item)} aria-label={'Gestionar a ' + item.name}>{item.id === user.id ? 'Tu cuenta' : 'Gestionar'}</button>
    </li>)}</ul>
    {cursor && <button className="secondary-button" disabled={loading} onClick={() => load(cursor)}>{loading ? 'Cargando…' : 'Cargar más usuarios'}</button>}
    <dialog ref={dialog} className="editorial-dialog" aria-labelledby="permissions-title" onCancel={(event) => { event.preventDefault(); if (!saving) setSelected(null) }}>
      <h2 id="permissions-title">Permisos de {selected?.name}</h2><p>La cuenta debe volver a iniciar sesión si cambias su rol o estado.</p>
      <form className="account-form" onSubmit={save} aria-busy={saving}>
        <div className="form-field"><label htmlFor="user-role">Rol de la cuenta</label><select id="user-role" value={role} onChange={(event) => setRole(event.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="form-field"><label htmlFor="user-status">Estado de la cuenta</label><select id="user-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Activa</option><option value="suspended">Suspendida</option></select></div>
        {role === 'admin' && <p>Un administrador puede gestionar otras cuentas y moderar publicaciones.</p>}
        {error && <p className="form-feedback" role="alert">{error}</p>}
        <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Confirmar permisos'}</button><button className="secondary-button" type="button" disabled={saving} onClick={() => setSelected(null)}>Cancelar</button></div>
      </form>
    </dialog>
  </>
}

export default function AdminUsersPage() {
  return <main id="main-content" className="account-page page-width" tabIndex={-1}><header className="account-heading"><Link className="text-link" to="/account">Volver a mi cuenta</Link><h1>Usuarios</h1><span className="eyebrow">Administración</span></header><SessionBoundary roles={['admin']}><UserManagement /></SessionBoundary></main>
}
