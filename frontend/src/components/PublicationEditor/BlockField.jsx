import { ArrowDown, ArrowUp, Trash } from '@phosphor-icons/react'
import { blockLabels } from '../../services/publicationEditor'
import ImageField from './ImageField'

export default function BlockField({ block, index, total, publicationId, onChange, onMove, onRemove, disabled, onBusyChange }) {
  const patch = (key, value) => onChange((current) => ({ ...current, [key]: value }))
  const id = 'block-' + block.id
  return <section className="editor-block" aria-labelledby={id + '-title'}>
    <header className="editor-block__header"><h3 id={id + '-title'}>{index + 1}. {blockLabels[block.type]}</h3><div className="editor-block__tools">
      <button type="button" aria-label={'Subir bloque ' + (index + 1)} disabled={disabled || index === 0} onClick={() => onMove(-1)}><ArrowUp size={19} aria-hidden="true" /></button>
      <button type="button" aria-label={'Bajar bloque ' + (index + 1)} disabled={disabled || index === total - 1} onClick={() => onMove(1)}><ArrowDown size={19} aria-hidden="true" /></button>
      <button type="button" aria-label={'Eliminar bloque ' + (index + 1)} disabled={disabled} onClick={onRemove}><Trash size={19} aria-hidden="true" /></button>
    </div></header>
    <fieldset disabled={disabled} className="editor-block__fields">
      {['paragraph', 'heading', 'quote'].includes(block.type) && <div className="form-field"><label htmlFor={id + '-text'}>{blockLabels[block.type]} del bloque {index + 1}</label><textarea id={id + '-text'} value={block.text} rows={block.type === 'heading' ? 2 : 5} maxLength={block.type === 'heading' ? 200 : 6000} onChange={(event) => patch('text', event.target.value)} /></div>}
      {block.type === 'heading' && <div className="form-field"><label htmlFor={id + '-level'}>Nivel del encabezado</label><select id={id + '-level'} value={block.level} onChange={(event) => patch('level', Number(event.target.value))}><option value={2}>Sección</option><option value={3}>Subsección</option></select></div>}
      {block.type === 'quote' && <div className="form-field"><label htmlFor={id + '-attribution'}>Autoría o fuente de la cita</label><input id={id + '-attribution'} value={block.attribution} maxLength={160} onChange={(event) => patch('attribution', event.target.value)} /></div>}
      {block.type === 'list' && <>
        <div className="form-field"><label htmlFor={id + '-items'}>Elementos de la lista, uno por línea</label><textarea id={id + '-items'} value={block.items.join('\n')} rows={5} onChange={(event) => patch('items', event.target.value.split('\n'))} aria-describedby={id + '-help'} /><small id={id + '-help'}>Hasta 50 elementos de 500 caracteres cada uno.</small></div>
        <label className="editor-checkbox"><input type="checkbox" checked={block.ordered} onChange={(event) => patch('ordered', event.target.checked)} /> Lista numerada</label>
      </>}
      {block.type === 'image' && <>
        <ImageField publicationId={publicationId} assetId={block.assetId} alt={block.alt} label={'Imagen del bloque ' + (index + 1)} onChange={(value) => patch('assetId', value)} disabled={disabled} onBusyChange={onBusyChange} />
        <div className="form-field"><label htmlFor={id + '-alt'}>Descripción de la imagen</label><input id={id + '-alt'} value={block.alt} maxLength={300} onChange={(event) => patch('alt', event.target.value)} /></div>
        <div className="form-field"><label htmlFor={id + '-caption'}>Pie de imagen</label><input id={id + '-caption'} value={block.caption} maxLength={500} onChange={(event) => patch('caption', event.target.value)} /></div>
      </>}
    </fieldset>
  </section>
}
