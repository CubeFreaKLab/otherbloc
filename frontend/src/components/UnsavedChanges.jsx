import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

export default function UnsavedChanges({ dirty }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  const dialog = useRef(null)
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    if (blocker.state === 'blocked') dialog.current?.showModal()
    else dialog.current?.close()
  }, [blocker.state])
  return <dialog ref={dialog} className="editorial-dialog" aria-labelledby="unsaved-title" onCancel={(event) => { event.preventDefault(); blocker.reset?.() }}>
    <h2 id="unsaved-title">Tienes cambios sin guardar</h2><p>Puedes seguir editando o salir y descartar estos cambios.</p>
    <div className="form-actions"><button className="primary-button" onClick={() => blocker.reset?.()}>Seguir editando</button><button className="secondary-button" onClick={() => blocker.proceed?.()}>Salir sin guardar</button></div>
  </dialog>
}
