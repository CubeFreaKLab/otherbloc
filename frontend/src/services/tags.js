export function confirmTags(confirmed, input) {
  const tags = [...confirmed], remaining = [], errors = []
  const key = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  for (const tag of input.split(/[\s,]+/u).filter(Boolean)) {
    if (tags.some((value) => key(value) === key(tag))) continue
    if (tag.length > 30) { remaining.push(tag); errors.push('«' + tag + '» supera los 30 caracteres.'); continue }
    if (tags.length >= 8) { remaining.push(tag); errors.push('No se añadió «' + tag + '»: puedes usar hasta 8 etiquetas.'); continue }
    tags.push(tag)
  }
  return { tags, input: remaining.join(' '), error: errors.join(' ') }
}
