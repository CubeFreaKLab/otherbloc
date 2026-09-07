import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SessionBoundary from '../components/SessionBoundary'
import UnsavedChanges from '../components/UnsavedChanges'
import ContentState from '../components/ContentState/ContentState'
import { PublicationLoading } from '../components/PublicationFeed/PublicationFeed'
import BlockField from '../components/PublicationEditor/BlockField'
import ImageField from '../components/PublicationEditor/ImageField'
import PublicationPreview from '../components/PublicationEditor/PublicationPreview'
import EditorConfirmation from '../components/PublicationEditor/EditorConfirmation'
import { useResource } from '../hooks/useResource'
import { useSession } from '../hooks/useSession'
import { usePageTitle } from '../hooks/usePageTitle'
import { usePublicationEditor } from '../hooks/usePublicationEditor'
import { useDraftRecovery } from '../hooks/useDraftRecovery'
import { RecoveryChoice } from '../components/DraftRecovery'
import { gatewayRequest } from '../services/gatewayClient'
import { blockLabels, changePublicationStatus, newBlock, statusLabels } from '../services/publicationEditor'
import { publicRequest } from '../services/publications'
import '../styles/editor.css'

function Editor({ initial }) {
  const navigate = useNavigate()
  const [uploads, setUploads] = useState(0), [acting, setActing] = useState(false), [deleted, setDeleted] = useState(false)
  const recovery = useDraftRecovery({ ownerId: initial.authorId, key: 'publication:' + initial.id, path: '/author/publications/' + initial.id, label: 'Tu publicación', read: () => !recovery && !deleted && (dirty || operating) ? { document, baseVersion: publication.version, tags } : null })
  const editor = usePublicationEditor(initial, uploads > 0 || acting || deleted || Boolean(recovery))
  const { document, publication, dirty, busy, error, update, save, accept } = editor
  const [preview, setPreview] = useState(publication.status !== 'draft')
  const [tags, setTags] = useState(initial.tags.join(', '))
  const [action, setAction] = useState(null), [actionError, setActionError] = useState(''), [message, setMessage] = useState('')
  const options = useResource('/publications/options', publicRequest)
  const locked = publication.status !== 'draft' || acting || deleted || Boolean(recovery)
  const inFlight = busy || acting || uploads > 0
  const operating = inFlight || Boolean(recovery)
  usePageTitle((document.title || 'Borrador sin título') + ' · Editor')
  useEffect(() => { if (deleted) navigate('/author', { replace: true }) }, [deleted, navigate])
  const patch = (field, value) => update((current) => ({ ...current, [field]: value }))
  const uploadBusy = (value) => setUploads((count) => Math.max(0, count + (value ? 1 : -1)))

  function move(id, direction) {
    update((current) => {
      const blocks = [...current.blocks], index = blocks.findIndex((block) => block.id === id), next = index + direction
      if (index < 0 || next < 0 || next >= blocks.length) return current
      ;[blocks[index], blocks[next]] = [blocks[next], blocks[index]]
      return { ...current, blocks }
    })
  }

  function requestStatus(status) {
    const descriptions = {
      review: ['¿Enviar a revisión?', 'Se guardarán los cambios y administración podrá revisar la publicación. No podrás editarla hasta retirarla o recibir una devolución.', 'Enviar a revisión'],
      draft: [publication.status === 'archived' ? '¿Recuperar el borrador?' : '¿Retirar la revisión?', 'La publicación quedará como borrador privado para continuar editándola.', 'Volver a borrador'],
      archived: ['¿Archivar la publicación?', 'Dejará de estar disponible para visitantes. Podrás recuperarla como borrador y enviarla de nuevo a revisión.', 'Archivar'],
    }
    const [title, message, label] = descriptions[status]
    setAction({ kind: 'status', status, title, message, label })
  }

  async function confirm() {
    if (operating || !action) return
    if (action.kind === 'block') {
      update((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== action.id) }))
      setAction(null); return
    }
    setActing(true); setActionError(''); setMessage('')
    try {
      if (action.kind === 'reload') {
        const result = await gatewayRequest('/publications/' + publication.id)
        accept(result.publication, true); setTags(result.publication.tags.join(', ')); setPreview(result.publication.status !== 'draft')
        setMessage('Se recuperó la versión del servidor.')
      } else {
        if (action.kind === 'delete') {
          await gatewayRequest('/publications/' + publication.id, { method: 'DELETE', headers: { 'If-Match': '"' + publication.version + '"' } })
          setDeleted(true)
        } else {
          const current = await save()
          const changed = await changePublicationStatus(current, action.status)
          accept(changed); setPreview(changed.status !== 'draft')
          setMessage('Estado actualizado: ' + statusLabels[changed.status].toLowerCase() + '.')
        }
      }
      setAction(null)
    } catch (error) { setActionError(error.message); setAction(null) }
    finally { setActing(false) }
  }

  function exportChanges() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }))
    const link = window.document.createElement('a')
    link.href = url; link.download = 'otherbloc-borrador-' + publication.id + '.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <>
    <UnsavedChanges dirty={dirty && !deleted} pending={inFlight && !deleted} />
    <header className="editor-heading"><Link className="text-link" to="/author">Mis publicaciones</Link><h1>Tu publicación</h1><span className="publication-status">{statusLabels[publication.status]}</span></header>
    <RecoveryChoice entry={recovery} versioned onRestore={(value) => { editor.restore(value); setTags(value.tags); setPreview(false) }} />
    <div className="editor-toolbar">
      <p role="status">{uploads ? 'Subiendo imagen…' : busy ? 'Guardando…' : error ? 'No se guardaron los últimos cambios' : dirty ? 'Cambios sin guardar' : publication.status === 'draft' ? 'Borrador guardado' : 'Contenido guardado'}</p>
      {publication.status === 'draft' && <button type="button" className="primary-button" disabled={operating || !dirty} onClick={() => save().catch(() => {})}>Guardar ahora</button>}
      <button type="button" className="secondary-button" disabled={acting} aria-pressed={preview} onClick={() => setPreview((value) => !value)}>{preview ? 'Volver al editor' : 'Vista previa'}</button>
    </div>
    {error && <div className="form-feedback" role="alert"><p>{error.message}</p>{error.fields?.length > 0 && <p>Comprueba los campos señalados: {error.fields.map((field) => field.field.startsWith('blocks') ? 'bloques (contenido y límites)' : field.field === 'tags' ? 'etiquetas (hasta 8, sin repetir)' : field.field).filter((field, index, all) => all.indexOf(field) === index).join(', ')}.</p>}
      <div className="form-actions"><button type="button" className="secondary-button" disabled={operating} onClick={exportChanges}>Descargar mis cambios</button><button type="button" className="text-button" disabled={operating} onClick={() => setAction({ kind: 'reload', title: '¿Recuperar la versión del servidor?', message: 'Tus cambios locales sin guardar se descartarán. Descárgalos primero si necesitas conservar una copia.', label: 'Recuperar versión guardada' })}>Recargar contenido del servidor</button></div>
    </div>}
    {actionError && <p className="form-feedback" role="alert">{actionError}</p>}
    {message && <p className="success-message" role="status">{message}</p>}
    {publication.moderationNote && <p className="moderation-note">Observación de administración: {publication.moderationNote.reason}</p>}
    {preview ? <PublicationPreview publicationId={publication.id} document={document} /> : <div className="editor-layout">
      <div className="editor-document">
        {locked && <p className="moderation-note">El contenido solo se puede editar en estado borrador. Usa los controles de estado para continuar.</p>}
        <fieldset disabled={locked} className="editor-metadata"><legend>Sobre la publicación</legend>
          <div className="form-field editor-span"><label htmlFor="publication-title">Título</label><textarea id="publication-title" value={document.title} rows={2} maxLength={160} onChange={(event) => patch('title', event.target.value)} /><small>De 5 a 160 caracteres para enviar a revisión.</small></div>
          <div className="form-field editor-span"><label htmlFor="publication-summary">Resumen</label><textarea id="publication-summary" value={document.summary} rows={3} maxLength={400} onChange={(event) => patch('summary', event.target.value)} /><small>Presenta la idea en 20 a 400 caracteres.</small></div>
          <div className="form-field"><label htmlFor="publication-type">Tipo de publicación</label><select id="publication-type" value={document.type} onChange={(event) => patch('type', event.target.value)}>{(options.data?.types ?? [document.type]).map((type) => <option key={type}>{type}</option>)}</select></div>
          <div className="form-field"><label htmlFor="publication-category">Categoría</label><select id="publication-category" value={document.category} onChange={(event) => patch('category', event.target.value)}>{(options.data?.categories ?? [document.category]).map((category) => <option key={category}>{category}</option>)}</select></div>
          <div className="form-field editor-span"><label htmlFor="publication-tags">Etiquetas</label><input id="publication-tags" value={tags} maxLength={254} onChange={(event) => { setTags(event.target.value); patch('tags', event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean)) }} /><small>Separa las etiquetas con comas. Hasta 8, de 30 caracteres cada una.</small></div>
        </fieldset>
        {options.status === 'error' && <p role="alert">No se pudieron cargar los tipos y categorías. <button className="text-button" type="button" onClick={options.retry}>Reintentar opciones</button></p>}
        <section><h2>Portada</h2><ImageField publicationId={publication.id} assetId={document.coverId} alt={document.coverAlt} label="Portada" onChange={(value) => patch('coverId', value)} disabled={locked} onBusyChange={uploadBusy} />
          <div className="form-field"><label htmlFor="publication-cover-alt">Descripción de la portada</label><input id="publication-cover-alt" value={document.coverAlt} maxLength={300} disabled={locked} onChange={(event) => patch('coverAlt', event.target.value)} /><small>Describe lo que se ve para quienes no pueden ver la fotografía.</small></div>
        </section>
        <section><h2>Contenido</h2>{document.blocks.map((block, index) => <BlockField key={block.id} block={block} index={index} total={document.blocks.length} publicationId={publication.id}
          disabled={locked || uploads > 0} onBusyChange={uploadBusy} onChange={(change) => update((current) => ({ ...current, blocks: current.blocks.map((item) => item.id === block.id ? change(item) : item) }))}
          onMove={(direction) => move(block.id, direction)} onRemove={() => setAction({ kind: 'block', id: block.id, title: '¿Eliminar este bloque?', message: 'Se quitará su contenido del borrador. La imagen, si existe, dejará de estar vinculada cuando se guarden los cambios.', label: 'Eliminar bloque' })} />)}
          {!locked && <div className="editor-block-picker"><h3>Añadir un bloque</h3><div className="form-actions">{Object.entries(blockLabels).map(([type, label]) => <button type="button" className="secondary-button" key={type} disabled={uploads > 0 || document.blocks.length >= 80} onClick={() => update((current) => ({ ...current, blocks: [...current.blocks, newBlock(type)] }))}>Añadir {label.toLowerCase()}</button>)}</div><p className="field-help">{document.blocks.length}/80 bloques. Puedes cambiar su orden con los botones de flecha.</p></div>}
        </section>
      </div>
      <aside className="editor-aside"><h2>Guardado y revisión</h2><p>El borrador se guarda al dejar de escribir. Espera a ver «Borrador guardado» antes de cerrar. Guardar no publica tu contenido.</p><p>Para enviar a revisión, completa el título, resumen, portada y descripción; no dejes bloques vacíos.</p></aside>
    </div>}
    <section className="account-section"><h2>Estado de la publicación</h2><div className="form-actions">
      {publication.status === 'draft' && <button type="button" className="primary-button" disabled={operating || Boolean(error)} onClick={() => requestStatus('review')}>Enviar a revisión</button>}
      {publication.status === 'review' && <button type="button" className="secondary-button" disabled={operating} onClick={() => requestStatus('draft')}>Retirar de revisión</button>}
      {publication.status === 'published' && <><Link className="text-link" to={'/article/' + publication.id}>Leer publicación pública</Link><button type="button" className="secondary-button" disabled={operating} onClick={() => requestStatus('archived')}>Archivar publicación</button></>}
      {publication.status === 'archived' && <button type="button" className="primary-button" disabled={operating} onClick={() => requestStatus('draft')}>Recuperar como borrador</button>}
      {['draft', 'archived'].includes(publication.status) && <button type="button" className="text-button" disabled={operating} onClick={() => setAction({ kind: 'delete', title: '¿Eliminar la publicación?', message: 'Dejará de aparecer en tus publicaciones. No podrás restaurarla desde la aplicación. Los registros privados de auditoría se conservan.', label: 'Eliminar publicación' })}>Eliminar publicación</button>}
    </div></section>
    <EditorConfirmation action={action} busy={operating} onCancel={() => setAction(null)} onConfirm={confirm} />
  </>
}

function EditorLoader({ user, id }) {
  const { data, status, error, retry } = useResource('/publications/' + encodeURIComponent(id))
  if (status === 'loading') return <PublicationLoading feature />
  if (status === 'error') return <ContentState status="error" message={error.status === 404 ? 'No encontramos esta publicación o no tienes acceso a ella.' : error.message} onRetry={retry} />
  if (data.publication.authorId !== user.id) return <ContentState status="error" message="Solo el autor puede abrir esta publicación en su editor. La revisión de administración tiene su propia sección." />
  return <Editor key={data.publication.id} initial={data.publication} />
}

export default function PublicationEditorPage() {
  const { id } = useParams(), { user } = useSession()
  return <main id="main-content" tabIndex={-1} className="page-width editor-page"><SessionBoundary roles={['author', 'admin']}>{user && <EditorLoader user={user} id={id} />}</SessionBoundary></main>
}
