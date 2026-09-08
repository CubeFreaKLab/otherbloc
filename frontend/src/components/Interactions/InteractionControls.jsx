import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Link from '../MotionLink'
import { BookmarkSimple, Heart, UserPlus } from '@phosphor-icons/react'
import { useSession } from '../../hooks/useSession'
import { useResource } from '../../hooks/useResource'
import { followWriter, loadAuthorInteractions, loadEngagement, reactToReading, saveReading } from '../../services/interactionQueries'
import './Interactions.css'

function AccessLink({ children, label }) {
  const location = useLocation()
  return <Link className="interaction-button" aria-label={label} to={'/login?returnTo=' + encodeURIComponent(location.pathname + location.search)}>{children}</Link>
}

export function SaveControl({ publicationId, initialSaved = false, onChange }) {
  const { user, status } = useSession(), pending = useRef(false)
  const [active, setActive] = useState(initialSaved), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function toggle() {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { const saved = await saveReading(publicationId, !active); setActive(saved); onChange?.(saved) }
    catch (error) { setError(error.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className="interaction-control">{!user && status !== 'loading' ? <AccessLink label="Inicia sesión para guardar"><BookmarkSimple size={19} aria-hidden="true" /> Guardar</AccessLink> : <button type="button" className="interaction-button" disabled={busy || status === 'loading'} aria-pressed={active} aria-label={active ? 'Quitar guardado' : 'Guardar publicación'} onClick={toggle}><BookmarkSimple size={19} weight={active ? 'fill' : 'regular'} aria-hidden="true" />{busy ? 'Guardando…' : active ? 'Guardada' : 'Guardar'}</button>}
    {error && <p className="form-feedback" role="alert">{error}</p>}
  </div>
}

export function ReactionControl({ publicationId, initial }) {
  const { user, status } = useSession(), pending = useRef(false)
  const [active, setActive] = useState(initial.active), [count, setCount] = useState(initial.count), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function refreshCount() {
    try { const result = await loadEngagement(publicationId); setCount(result.reactions.count); setActive(result.reactions.active); setError('') }
    catch (error) { setCount(null); setError(error.message) }
  }
  async function toggle() {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { setActive(await reactToReading(publicationId, !active)); await refreshCount() }
    catch (error) { setError(error.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className="interaction-control">{!user && status !== 'loading' ? <AccessLink label="Inicia sesión para reaccionar"><Heart size={19} aria-hidden="true" /> Me interesa</AccessLink> : <button type="button" className="interaction-button" disabled={busy || status === 'loading'} aria-pressed={active} onClick={toggle}><Heart size={19} weight={active ? 'fill' : 'regular'} aria-hidden="true" />{busy ? 'Guardando…' : active ? 'Te interesa' : 'Me interesa'}</button>}
    {count !== null && <span className="interaction-count" aria-live="polite">{count} {count === 1 ? 'reacción' : 'reacciones'}</span>}
    {error && <p className="form-feedback" role="alert">{error} {count === null && <button type="button" className="text-button" disabled={busy} onClick={refreshCount}>Actualizar recuento</button>}</p>}
  </div>
}

export function FollowControl({ author, initialFollowing = false, onChange }) {
  const { user, status } = useSession(), pending = useRef(false)
  const [active, setActive] = useState(initialFollowing), [busy, setBusy] = useState(false), [error, setError] = useState('')
  if (user?.id === author.id) return null
  async function toggle() {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { const following = await followWriter(author.id, !active); setActive(following); onChange?.(following) }
    catch (error) { setError(error.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className="interaction-control">{!user && status !== 'loading' ? <AccessLink label={'Inicia sesión para seguir a ' + author.name}><UserPlus size={19} aria-hidden="true" /> Seguir autor</AccessLink> : <button type="button" className="interaction-button" disabled={busy || status === 'loading'} aria-pressed={active} aria-label={(active ? 'Dejar de seguir a ' : 'Seguir a ') + author.name} onClick={toggle}><UserPlus size={19} weight={active ? 'fill' : 'regular'} aria-hidden="true" />{busy ? 'Guardando…' : active ? 'Siguiendo' : 'Seguir autor'}</button>}
    {error && <p className="form-feedback" role="alert">{error}</p>}
  </div>
}

function ProfileFollowLoader({ author, viewer }) {
  const { data, status, error, retry } = useResource('/author-interactions/' + author.id + '?viewer=' + viewer, loadAuthorInteractions)
  if (status === 'loading') return <p role="status">Comprobando seguimiento…</p>
  if (status === 'error') return <p className="form-feedback" role="alert">{error.message} <button className="text-button" type="button" onClick={retry}>Reintentar seguimiento</button></p>
  return <FollowControl key={author.id + ':' + viewer} author={author} initialFollowing={data.following} />
}

export function ProfileFollow({ author }) {
  const { user, status } = useSession()
  if (user?.id === author.id) return null
  if (status === 'loading') return <p role="status">Comprobando seguimiento…</p>
  if (!user) return <FollowControl author={author} />
  return <ProfileFollowLoader author={author} viewer={user.id} />
}
