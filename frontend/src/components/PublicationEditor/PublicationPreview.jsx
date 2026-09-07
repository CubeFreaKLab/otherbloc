import { privateMediaPath } from '../../services/publicationEditor'
import PrivateImage from './PrivateImage'

export default function PublicationPreview({ publicationId, document }) {
  return <section className="editor-preview" aria-label="Vista previa de la publicación">
    <header><p className="publication-status">Vista previa · {document.type}</p><h2>{document.title || 'Título de tu publicación'}</h2>{document.summary && <p className="editor-preview__summary">{document.summary}</p>}</header>
    {document.coverId && <PrivateImage path={privateMediaPath(publicationId, document.coverId)} alt={document.coverAlt || 'Portada pendiente de descripción'} className="editor-preview__cover" />}
    <div className="article-prose">{document.blocks.map((block) => {
      if (block.type === 'heading') { const Heading = block.level === 3 ? 'h4' : 'h3'; return <Heading key={block.id}>{block.text || 'Encabezado vacío'}</Heading> }
      if (block.type === 'quote') return <blockquote key={block.id}>{block.text || 'Cita vacía'}{block.attribution && <cite>{block.attribution}</cite>}</blockquote>
      if (block.type === 'list') { const List = block.ordered ? 'ol' : 'ul'; return <List key={block.id}>{block.items.map((item, index) => <li key={index}>{item || 'Elemento vacío'}</li>)}</List> }
      if (block.type === 'image') return <figure key={block.id}>{block.assetId ? <PrivateImage path={privateMediaPath(publicationId, block.assetId)} alt={block.alt || 'Imagen pendiente de descripción'} /> : <p className="field-help">Imagen pendiente de subir</p>}{block.caption && <figcaption>{block.caption}</figcaption>}</figure>
      return <p key={block.id}>{block.text || 'Bloque de texto vacío'}</p>
    })}</div>
    {!document.blocks.length && <p className="field-help">Añade bloques para comenzar el contenido.</p>}
  </section>
}
