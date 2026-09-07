import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

export default function UnsavedChanges({ dirty, pending = false }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || pending) && currentLocation.pathname !== nextLocation.pathname)
  const dialog = useRef(null)
  useEffect(() => {
    const warn = (event) => { if (dirty || pending) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, pending])
  useEffect(() => {
    if (blocker.state === 'blocked') dialog.current?.showModal()
    else dialog.current?.close()
  }, [blocker.state])
  return <dialog ref={dialog} className="editorial-dialog" aria-labelledby="unsaved-title" onCancel={(event) => { event.preventDefault(); blocker.reset?.() }}>
    <h2 id="unsaved-title">{pending ? 'Hay una operación en curso' : dirty ? 'Tienes cambios sin guardar' : 'Tus cambios ya se guardaron'}</h2><p>{pending ? 'Espera a que termine el guardado o la subida. Una petición enviada puede completarse aunque cierres la página.' : dirty ? 'Puedes seguir editando o salir y descartar estos cambios.' : 'Puedes continuar con la navegación o volver al editor.'}</p>
    <div className="form-actions"><button className="primary-button" onClick={() => blocker.reset?.()}>Seguir editando</button><button className="secondary-button" disabled={pending} onClick={() => blocker.proceed?.()}>{dirty ? 'Salir sin guardar' : 'Continuar'}</button></div>
  </dialog>
}
