import { gatewayRequest } from './gatewayClient'
import { createId } from '../utils/createId'

export const statusLabels = { draft: 'Borrador', review: 'En revisión', published: 'Publicada', archived: 'Archivada' }
export const blockLabels = { paragraph: 'Texto', heading: 'Encabezado', list: 'Lista', quote: 'Cita', image: 'Imagen' }

export function editorDocument(publication) {
  const { title, summary, coverId, coverAlt, type, category, tags, blocks } = publication
  return { title, summary, coverId, coverAlt, type, category, tags: [...tags], blocks: blocks.map(({ url: _url, ...block }) => ({ ...block })) }
}

export function newBlock(type) {
  const fields = { paragraph: { text: '' }, heading: { text: '', level: 2 }, list: { items: [''], ordered: false }, quote: { text: '', attribution: '' }, image: { assetId: null, alt: '', caption: '' } }
  if (!fields[type]) throw new Error('Tipo de bloque no válido.')
  return { id: createId(), type, ...fields[type] }
}

export async function savePublication(id, document, version) {
  const result = await gatewayRequest('/publications/' + id, { method: 'PUT', body: document, headers: { 'If-Match': '"' + version + '"' } })
  return result.publication
}

export async function changePublicationStatus(publication, status, reason = '') {
  const result = await gatewayRequest('/publications/' + publication.id + '/status', { method: 'PATCH', body: { status, reason }, headers: { 'If-Match': '"' + publication.version + '"' } })
  return result.publication
}

export async function uploadPublicationImage(id, file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Elige un JPEG, PNG o WebP de hasta 5 MB.')
  const result = await gatewayRequest('/publications/' + id + '/assets', { method: 'POST', body: file, headers: { 'Content-Type': file.type } })
  return result.asset
}

export const privateMediaPath = (publicationId, assetId) => assetId ? '/api/publications/' + publicationId + '/media/' + assetId : null
