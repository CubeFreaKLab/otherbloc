import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, X } from '@phosphor-icons/react'
import Link from '../components/MotionLink'
import { useMotionNavigate as useNavigate } from '../hooks/useMotionNavigate'
import SessionBoundary from '../components/SessionBoundary'
import UnsavedChanges from '../components/UnsavedChanges'
import ContentState from '../components/ContentState/ContentState'
import { PublicationLoading } from '../components/PublicationFeed/PublicationFeed'
import WritingSurface from '../components/PublicationEditor/WritingSurface'
import TagsField from '../components/PublicationEditor/TagsField'
import ImageField from '../components/PublicationEditor/ImageField'
import PublicationPreview from '../components/PublicationEditor/PublicationPreview'
import EditorConfirmation from '../components/PublicationEditor/EditorConfirmation'
import EditorialDialog from '../components/EditorialDialog'
import ThemeControl from '../components/ThemeControl/ThemeControl'
import AccountAvatar from '../components/Header/AccountAvatar'
import { useResource } from '../hooks/useResource'
import { useSession } from '../hooks/useSession'
import { usePageTitle } from '../hooks/usePageTitle'
import { usePublicationEditor } from '../hooks/usePublicationEditor'
import { useDraftRecovery } from '../hooks/useDraftRecovery'
import { RecoveryChoice } from '../components/DraftRecovery'
import { gatewayRequest } from '../services/gatewayClient'
import { changePublicationStatus, statusLabels } from '../services/publicationEditor'
import { publicRequest } from '../services/publications'
import '../components/Header/Header.css'
import '../styles/editor.css'

function Editor({ initial }) {
  const navigate = useNavigate(), titleInput = useRef(null)
  const [uploads, setUploads] = useState(0), [acting, setActing] = useState(false), [deleted, setDeleted] = useState(false)
  const [details, setDetails] = useState(false), [revision, setRevision] = useState(0)
  const pendingTagKey = 'otherbloc-tag-input:' + initial.authorId + ':' + initial.id
  const [tagInput, setTagInput] = useState(() => { try { return sessionStorage.getItem(pendingTagKey) || '' } catch { return '' } })
  const recovery = useDraftRecovery({ ownerId: initial.authorId, key: 'publication:' + initial.id, path: '/author/publications/' + initial.id, label: 'Tu borrador', read: () => !recovery && !deleted && (dirty || operating || tagInput) ? { document, baseVersion: publication.version, tagInput } : null })
  const editor = usePublicationEditor(initial, uploads > 0 || acting || deleted || Boolean(recovery))
  const { document, publication, dirty, busy, error, update, save, accept } = editor
  const [preview, setPreview] = useState(publication.status !== 'draft')
  const [action, setAction] = useState(null), [actionError, setActionError] = useState(''), [message, setMessage] = useState('')
  const options = useResource('/publications/options', publicRequest)
  const locked = publication.status !== 'draft' || acting || deleted || Boolean(recovery)
  const inFlight = busy || acting || uploads > 0, operating = inFlight || Boolean(recovery)
  usePageTitle((document.title || 'Borrador sin título') + ' · Editor')
  useEffect(() => { if (deleted) navigate('/author', { replace: true }) }, [deleted, navigate])
  useEffect(() => { try { if (tagInput) sessionStorage.setItem(pendingTagKey, tagInput); else sessionStorage.removeItem(pendingTagKey) } catch { /* The input remains in memory. */ } }, [tagInput, pendingTagKey])
  useLayoutEffect(() => { const node = titleInput.current; if (node) { node.style.height = 'auto'; node.style.height = node.scrollHeight + 'px' } }, [document.title, preview])
  const patch = (field, value) => update((current) => ({ ...current, [field]: value }))
  const uploadBusy = (value) => setUploads((count) => Math.max(0, count + (value ? 1 : -1)))

  function requestStatus(status) {
    const descriptions = {
      review: ['¿Enviar a revisión?', 'Se guardarán los cambios y administración revisará la nota antes de publicarla. Podrás retirarla de revisión si necesitas seguir escribiendo.', 'Enviar a revisión'],
      draft: [publication.status === 'archived' ? '¿Recuperar el borrador?' : '¿Retirar la revisión?', 'La nota quedará como borrador privado para continuar escribiendo.', 'Volver a borrador'],
      archived: ['¿Archivar la publicación?', 'Dejará de estar disponible para visitantes. Podrás recuperarla como borrador y enviarla de nuevo a revisión.', 'Archivar'],
    }
    const [title, message, label] = descriptions[status]
    setAction({ kind: 'status', status, title, message, label })
  }
  async function confirm() {
    if (operating || !action) return
    setActing(true); setActionError(''); setMessage('')
    try {
      if (action.kind === 'reload') {
        const result = await gatewayRequest('/publications/' + publication.id)
        accept(result.publication, true); setRevision((value) => value + 1); setPreview(result.publication.status !== 'draft')
        setMessage('Se recuperó la versión guardada.')
      } else if (action.kind === 'delete') {
        await gatewayRequest('/publications/' + publication.id, { method: 'DELETE', headers: { 'If-Match': '"' + publication.version + '"' } })
        setTagInput(''); setDeleted(true)
      } else {
        const current = await save()
        const changed = await changePublicationStatus(current, action.status)
        accept(changed); setPreview(changed.status !== 'draft')
        setMessage('Estado actualizado: ' + statusLabels[changed.status].toLowerCase() + '.')
      }
      setAction(null)
    } catch (error) { setActionError(error.message); setAction(null) }
    finally { setActing(false) }
  }
  function exportChanges() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...document, etiquetaPendiente: tagInput }, null, 2)], { type: 'application/json' }))
    const link = window.document.createElement('a')
    link.href = url; link.download = 'otherbloc-borrador-' + publication.id + '.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <>
    <UnsavedChanges dirty={(dirty || Boolean(tagInput)) && !deleted} pending={inFlight && !deleted} />
    <header className="writing-header">
      <div className="writing-header__identity"><Link to="/" className="writing-brand"><img className="brand-logo" src="/brand/otherbloc-logo-black.svg" alt="otherbloc, inicio" width="1532" height="291" /></Link><Link className="writing-back" to="/author" aria-label="Mis publicaciones"><ArrowLeft size={17} aria-hidden="true" /><span>Mis publicaciones</span></Link></div>
      <div className="writing-header__actions"><p className="writing-save" role="status">{uploads ? 'Subiendo imagen…' : busy ? 'Guardando…' : error ? 'No se pudo guardar' : dirty ? 'Cambios sin guardar' : 'Guardado'}</p>
        {publication.status === 'draft' && (dirty || error) && <button type="button" className="text-button" disabled={operating} onClick={() => save().catch(() => {})}>{error ? 'Reintentar' : 'Guardar ahora'}</button>}
        <button type="button" className="writing-action" aria-expanded={details} onClick={() => setDetails(true)}>Detalles</button>
        <button type="button" className="writing-action" disabled={acting} aria-pressed={preview} onClick={() => setPreview((value) => !value)}>{preview ? 'Escribir' : 'Vista previa'}</button>
        {publication.status === 'draft' && <button type="button" className="primary-button writing-submit" disabled={operating || error?.code === 'version_conflict'} onClick={() => requestStatus('review')}>Enviar a revisión</button>}
        <ThemeControl /><AccountAvatar />
      </div>
    </header>
    <div className="writing-notices"><RecoveryChoice entry={recovery} versioned onRestore={(value) => { editor.restore(value); setTagInput(value.tagInput ?? ''); setRevision((value) => value + 1); setPreview(false) }} />
      {error && <div className="form-feedback" role="alert"><p>{error.message}</p>{error.fields?.length > 0 && <p>Revisa {error.fields.map(({ field }) => field.startsWith('tags') ? 'las etiquetas' : field.startsWith('blocks') ? 'la extensión del texto y sus imágenes' : ({ title: 'el título', summary: 'el resumen', coverAlt: 'la descripción de portada' }[field] || 'los detalles')).filter((field, index, all) => all.indexOf(field) === index).join(', ')}. Tus cambios siguen aquí.</p>}
        <div className="form-actions"><button type="button" className="text-button" onClick={exportChanges}>Descargar mis cambios</button><button type="button" className="text-button" disabled={operating} onClick={() => setAction({ kind: 'reload', title: '¿Recuperar la versión guardada?', message: 'Tus cambios locales sin guardar se descartarán. Descárgalos primero si necesitas conservar una copia.', label: 'Recuperar versión guardada' })}>Recuperar versión guardada</button></div>
      </div>}
      {actionError && <p className="form-feedback" role="alert">{actionError}</p>}{message && <p className="success-message" role="status">{message}</p>}
      {publication.moderationNote && <p className="moderation-note">Observación de administración: {publication.moderationNote.reason}</p>}
    </div>
    {preview && <PublicationPreview publicationId={publication.id} document={document} />}
    <section className="writing-page" aria-label="Editor" hidden={preview}>
      <p className="writing-eyebrow">{statusLabels[publication.status]}</p>
      <h1 className="visually-hidden">Editor</h1>
      <textarea ref={titleInput} id="publication-title" className="writing-title" aria-label="Título" placeholder="Título de tu nota" value={document.title} rows={1} maxLength={160} disabled={locked} onChange={(event) => patch('title', event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); window.document.querySelector('.writing-prose')?.focus() } }} />
      <WritingSurface blocks={document.blocks} onChange={(blocks) => patch('blocks', blocks)} publicationId={publication.id} disabled={locked} onBusyChange={uploadBusy} revision={revision} />
    </section>
    <EditorialDialog open={details} className="editorial-dialog writing-details" aria-labelledby="details-title" onCancel={() => setDetails(false)}>
      <header><h2 id="details-title">Detalles</h2><button type="button" className="writing-action" aria-label="Cerrar detalles" onClick={() => setDetails(false)}><X size={22} /></button></header>
      <fieldset disabled={locked} className="writing-metadata">
        <div className="form-field"><label htmlFor="publication-summary">Resumen</label><textarea id="publication-summary" value={document.summary} rows={3} maxLength={400} onChange={(event) => patch('summary', event.target.value)} /><small>Entre 20 y 400 caracteres para enviar a revisión.</small></div>
        <div className="form-field"><label htmlFor="publication-type">Tipo de publicación</label><select id="publication-type" value={document.type} onChange={(event) => patch('type', event.target.value)}>{(options.data?.types ?? [document.type]).map((type) => <option key={type}>{type}</option>)}</select></div>
        <div className="form-field"><label htmlFor="publication-category">Categoría</label><select id="publication-category" value={document.category} onChange={(event) => patch('category', event.target.value)}>{(options.data?.categories ?? [document.category]).map((category) => <option key={category}>{category}</option>)}</select></div>
        <TagsField tags={document.tags} input={tagInput} onInput={setTagInput} onChange={(tags) => patch('tags', tags)} disabled={locked} />
        <section><h3>Portada</h3><ImageField publicationId={publication.id} assetId={document.coverId} alt={document.coverAlt} label="Portada" onChange={(value) => patch('coverId', value)} disabled={locked} onBusyChange={uploadBusy} /><div className="form-field"><label htmlFor="publication-cover-alt">Descripción de la portada</label><input id="publication-cover-alt" value={document.coverAlt} maxLength={300} onChange={(event) => patch('coverAlt', event.target.value)} /><small>Describe lo que se ve para quienes no pueden ver la fotografía.</small></div></section>
      </fieldset>
      {options.status === 'error' && <p role="alert">No se pudieron cargar las categorías. <button className="text-button" type="button" onClick={options.retry}>Reintentar</button></p>}
      <section className="writing-state"><h3>{statusLabels[publication.status]}</h3><div className="form-actions">
        {publication.status === 'review' && <button type="button" className="secondary-button" disabled={operating} onClick={() => { setDetails(false); requestStatus('draft') }}>Retirar de revisión</button>}
        {publication.status === 'published' && <><Link className="text-link" to={'/article/' + publication.id}>Leer publicación pública</Link><button type="button" className="secondary-button" disabled={operating} onClick={() => { setDetails(false); requestStatus('archived') }}>Archivar publicación</button></>}
        {publication.status === 'archived' && <button type="button" className="secondary-button" disabled={operating} onClick={() => { setDetails(false); requestStatus('draft') }}>Recuperar como borrador</button>}
        {['draft', 'archived'].includes(publication.status) && <button type="button" className="text-button" disabled={operating} onClick={() => { setDetails(false); setAction({ kind: 'delete', title: '¿Eliminar la publicación?', message: 'Dejará de aparecer en tus publicaciones. No podrás restaurarla desde la aplicación.', label: 'Eliminar publicación' }) }}>Eliminar publicación</button>}
      </div></section>
    </EditorialDialog>
    <EditorConfirmation action={action} busy={operating} onCancel={() => setAction(null)} onConfirm={confirm} />
  </>
}

function EditorLoader({ user, id }) {
  const { data, status, error, retry } = useResource('/publications/' + encodeURIComponent(id))
  if (status === 'loading') return <PublicationLoading feature />
  if (status === 'error') return <ContentState status="error" message={error.status === 404 ? 'No encontramos esta publicación o no tienes acceso a ella.' : error.message} onRetry={retry} />
  if (data.publication.authorId !== user.id) return <ContentState status="error" message="Solo su autor puede abrir esta publicación en el editor. Administración tiene su propia sección de revisión." />
  return <Editor key={data.publication.id} initial={data.publication} />
}
export default function PublicationEditorPage() {
  const { id } = useParams(), { user } = useSession()
  return <main id="main-content" tabIndex={-1} className="editor-page"><SessionBoundary>{user && <EditorLoader user={user} id={id} />}</SessionBoundary></main>
}
