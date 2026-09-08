import { createId } from '../utils/createId.js'

export const safeLink = (value) => /^(https?:\/\/|mailto:)[^\s]+$/i.test(value ?? '')
const plain = (runs) => runs.map((run) => run.text).join('')

export function toInline(text = '', formatted) {
  return (formatted ?? [{ text }]).flatMap((run) => run.text.split('\n').flatMap((part, index) => [
    ...(index ? [{ type: 'hardBreak' }] : []),
    ...(part ? [{ type: 'text', text: part, marks: [
      ...(run.bold ? [{ type: 'bold' }] : []), ...(run.italic ? [{ type: 'italic' }] : []),
      ...(safeLink(run.href) ? [{ type: 'link', attrs: { href: run.href } }] : []),
    ] }] : []),
  ]))
}

export function fromInline(content = []) {
  const runs = []
  for (const node of content) {
    if (node.type === 'hardBreak') runs.push({ text: '\n' })
    else if (node.type === 'text') {
      const run = { text: node.text }
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') run.bold = true
        if (mark.type === 'italic') run.italic = true
        if (mark.type === 'link' && safeLink(mark.attrs?.href)) run.href = mark.attrs.href
      }
      runs.push(run)
    } else {
      if (runs.length) runs.push({ text: '\n' })
      runs.push(...fromInline(node.content))
    }
  }
  return runs
}

export function toWritingDocument(blocks) {
  const content = blocks.map((block) => {
    const attrs = { id: block.id }
    if (block.type === 'image') return { type: 'editorImage', attrs: { ...attrs, assetId: block.assetId, alt: block.alt, caption: block.caption } }
    if (block.type === 'list') return { type: block.ordered ? 'orderedList' : 'bulletList', attrs, content: block.items.map((text, i) => ({ type: 'listItem', content: [{ type: 'paragraph', content: toInline(text, block.formattedItems?.[i]?.runs) }] })) }
    const inline = toInline(block.text, block.formatted)
    if (block.type === 'quote') return { type: 'blockquote', attrs: { ...attrs, attribution: block.attribution }, content: [{ type: 'paragraph', content: inline }] }
    return { type: block.type === 'heading' ? 'heading' : 'paragraph', attrs: { ...attrs, ...(block.type === 'heading' ? { level: block.level } : {}) }, content: inline }
  })
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

export function fromWritingDocument(document) {
  const blocks = document.content.map((node) => {
    const id = node.attrs?.id || createId()
    if (node.type === 'editorImage') return { id, type: 'image', assetId: node.attrs.assetId, alt: node.attrs.alt, caption: node.attrs.caption }
    if (['bulletList', 'orderedList'].includes(node.type)) {
      const formattedItems = node.content.map((item) => ({ runs: fromInline(item.content) }))
      return { id, type: 'list', ordered: node.type === 'orderedList', items: formattedItems.map((item) => plain(item.runs)), formattedItems }
    }
    const formatted = fromInline(node.content)
    if (node.type === 'blockquote') return { id, type: 'quote', text: plain(formatted), formatted, attribution: node.attrs.attribution || '' }
    return { id, type: node.type === 'heading' ? 'heading' : 'paragraph', text: plain(formatted), formatted, ...(node.type === 'heading' ? { level: node.attrs.level } : {}) }
  })
  // The editor's trailing writing line is not an incomplete publication item.
  while (blocks.at(-1)?.type === 'paragraph' && !blocks.at(-1).text) blocks.pop()
  return blocks
}
