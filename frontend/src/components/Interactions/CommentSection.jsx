import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession } from '../../hooks/useSession'
import { deleteOwnComment, loadComments, loadEngagement, writeComment } from '../../services/interactionQueries'
import { formatDate } from '../../utils/formatDate'
import { createId } from '../../utils/createId'
import UnsavedChanges from '../UnsavedChanges'
import EditorConfirmation from '../PublicationEditor/EditorConfirmation'
import './Interactions.css'

function mergeComments(previous, incoming) {
  const byId = new Map([...previous, ...incoming].map((item) => [item.id, item]))
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

export default function CommentSection({ publicationId, initial, initialCount }) {
  const { user } = useSession(), location = useLocation()
  const [items, setItems] = useState(initial.items), [cursor, setCursor] = useState(initial.nextCursor), [total, setTotal] = useState(initialCount)
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [readError, setReadError] = useState(''), [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(null), [attempt, setAttempt] = useState(null)
  const pending = useRef(false), reading = useRef(false)
  async function refreshCount() {
    try { setTotal((await loadEngagement(publicationId)).commentCount); setReadError('') }
    catch (error) { setTotal(null); setReadError(error.message) }
  }
  async function submit(event) {
    event.preventDefault()
    if (pending.current || !text.trim()) return
    pending.current = true; setBusy(true); setError(''); setNotice('')
    const currentAttempt = attempt ?? { id: createId(), text: text.trim() }
    setAttempt(currentAttempt)
    try {
      const comment = await writeComment({ id: currentAttempt.id, text: currentAttempt.text, publicationId })
      setItems((current) => mergeComments(current, [comment])); setText(''); setAttempt(null)
      setNotice('Tu comentario se publicó.'); await refreshCount()
    } catch (error) { if (error.status === 400) setAttempt(null); setError(error.message) }
    finally { pending.current = false; setBusy(false) }
  }
  async function remove() {
    if (pending.current || !selected) return
    pending.current = true; setBusy(true); setError(''); setNotice('')
    try {
      await deleteOwnComment(selected.id)
      setItems((current) => current.filter((item) => item.id !== selected.id)); setSelected(null)
      setNotice('Tu comentario se eliminó.'); await refreshCount()
    } catch (error) { setError(error.message); setSelected(null) }
    finally { pending.current = false; setBusy(false) }
  }
  async function more() {
    if (reading.current || !cursor) return
    reading.current = true; setLoading(true); setReadError('')
    try {
      const result = await loadComments(publicationId, cursor)
      setItems((current) => mergeComments(current, result.items)); setCursor(result.nextCursor); setTotal(result.total)
    } catch (error) { setReadError(error.message) }
    finally { reading.current = false; setLoading(false) }
  }
  return <section className="comments-section" aria-labelledby="comments-heading">
    <UnsavedChanges dirty={Boolean(text)} pending={busy} />
    <h2 id="comments-heading">Conversación{total !== null ? ' · ' + total : ''}</h2>
    <p>Comparte tu lectura con respeto. Los comentarios son públicos; evita incluir información privada.</p>
    {user ? <form className="account-form comment-form" onSubmit={submit} aria-busy={busy}>
      <div className="form-field"><label htmlFor="comment-text">Tu comentario</label><textarea id="comment-text" rows={4} maxLength={2000} required disabled={busy || Boolean(attempt)} value={text} onChange={(event) => { setText(event.target.value); setError('') }} /><small>{text.length}/2000 caracteres.</small></div>
      {attempt && error && <p>El reintento enviará el mismo comentario para no duplicarlo. Si quieres cambiarlo, comprueba primero si aparece en la conversación al recargar.</p>}
      <button className="primary-button" disabled={busy || !text.trim()}>{busy ? 'Guardando…' : attempt && error ? 'Reintentar comentario' : 'Publicar comentario'}</button>
    </form> : <Link className="text-link" to={'/login?returnTo=' + encodeURIComponent(location.pathname)}>Inicia sesión para comentar</Link>}
    {error && <p className="form-feedback" role="alert">{error}</p>}
    {notice && <p className="success-message" role="status">{notice}</p>}
    {readError && <div className="form-feedback" role="alert"><p>{readError}</p><button type="button" className="text-button" disabled={loading || busy} onClick={total === null ? refreshCount : more}>Reintentar conversación</button></div>}
    {!items.length && <p>No hay comentarios todavía. Puedes abrir la conversación.</p>}
    <ul className="comment-list">{items.map((item) => <li className="comment-item" data-comment-id={item.id} key={item.id}>
      <header className="comment-item__header">{item.author ? <Link to={'/profile/' + item.author.id}>{item.author.name}</Link> : <strong>Cuenta no disponible</strong>}<time dateTime={item.createdAt}>{formatDate(item.createdAt.slice(0, 10))}</time></header>
      <p>{item.text}</p>{item.canDelete && <button className="text-button" type="button" disabled={busy} onClick={() => setSelected(item)}>Eliminar mi comentario</button>}
    </li>)}</ul>
    {cursor && <button className="secondary-button" type="button" disabled={loading || busy} onClick={more}>{loading ? 'Cargando comentarios…' : 'Ver más comentarios'}</button>}
    <EditorConfirmation action={selected ? { title: '¿Eliminar tu comentario?', message: 'Dejará de ser visible en la conversación. Esta acción no tiene restauración desde la aplicación.', label: 'Eliminar comentario' } : null} busy={busy} onCancel={() => setSelected(null)} onConfirm={remove} />
  </section>
}
