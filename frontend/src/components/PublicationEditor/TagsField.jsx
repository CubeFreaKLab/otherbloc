import { useRef } from 'react'
import { X } from '@phosphor-icons/react'
import { confirmTags } from '../../services/tags'

export default function TagsField({ tags, input, onInput, onChange, disabled }) {
  const field = useRef(null)
  const feedback = confirmTags(tags, input).error
  function confirm(value) {
    const result = confirmTags(tags, value)
    onChange(result.tags); onInput(result.input)
  }
  return <div className="form-field editor-span">
    <label htmlFor="publication-tags">Etiquetas</label>
    <div className="tags-field" onClick={() => field.current?.focus()}>
      {tags.map((tag) => <span className="tag-piece" key={tag}>{tag}<button type="button" disabled={disabled} aria-label={'Quitar etiqueta ' + tag} onClick={() => { onChange(tags.filter((value) => value !== tag)); field.current?.focus() }}><X size={14} aria-hidden="true" /></button></span>)}
      <input ref={field} id="publication-tags" value={input} disabled={disabled} aria-describedby="tags-help tags-error" aria-invalid={Boolean(feedback)} placeholder={tags.length ? 'Otra etiqueta' : 'cultura ciudad'}
        onChange={(event) => { const value = event.target.value; if (/[\s,]$/.test(value) && !event.nativeEvent.isComposing) confirm(value); else onInput(value) }}
        onKeyDown={(event) => { if (!event.nativeEvent.isComposing && ['Enter', ',', ' '].includes(event.key)) { event.preventDefault(); confirm(input) } }}
        onPaste={(event) => { event.preventDefault(); const element = event.currentTarget; confirm(input.slice(0, element.selectionStart) + event.clipboardData.getData('text') + input.slice(element.selectionEnd)) }} />
    </div>
    <small id="tags-help">Espacio, Enter o coma para añadir. Hasta 8 etiquetas de 30 caracteres.</small>
    <small id="tags-error" role={feedback ? 'alert' : undefined}>{feedback || (input ? 'Esta etiqueta aún no se ha añadido; el resto del borrador sí se guarda.' : '')}</small>
  </div>
}
