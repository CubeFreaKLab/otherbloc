import { useRef, useState } from 'react'
import { privateMediaPath, uploadPublicationImage } from '../../services/publicationEditor'
import PrivateImage from './PrivateImage'

export default function ImageField({ publicationId, assetId, alt, label, onChange, disabled, onBusyChange }) {
  const input = useRef(null), pending = useRef(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || pending.current) return
    pending.current = true; setBusy(true); onBusyChange?.(true); setError('')
    try { const asset = await uploadPublicationImage(publicationId, file); onChange(asset.id) }
    catch (error) { setError(error.message) }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false) }
  }
  return <div className="editor-image-field">
    {assetId && <PrivateImage path={privateMediaPath(publicationId, assetId)} alt={alt || label} className="editor-image-preview" />}
    <div className="form-actions"><button type="button" className="secondary-button" disabled={disabled || busy} onClick={() => input.current?.click()}>{busy ? 'Subiendo…' : assetId ? 'Cambiar ' + label.toLowerCase() : 'Subir ' + label.toLowerCase()}</button>
      {assetId && <button type="button" className="text-button" disabled={disabled || busy} onClick={() => onChange(null)}>Quitar {label.toLowerCase()}</button>}
    </div>
    <input ref={input} type="file" className="visually-hidden" tabIndex={-1} accept="image/jpeg,image/png,image/webp" aria-label={'Archivo de ' + label.toLowerCase()} onChange={upload} disabled={disabled || busy} />
    <p className="field-help">JPEG, PNG o WebP. Hasta 5 MB. La imagen se guarda en Storage y se vincula al guardar el borrador.</p>
    {error && <p className="form-feedback" role="alert">{error}</p>}
  </div>
}
