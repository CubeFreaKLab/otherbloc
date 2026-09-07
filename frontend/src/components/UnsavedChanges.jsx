import { useEffect, useId } from 'react'
import { useBlocker } from 'react-router-dom'
import EditorialDialog from './EditorialDialog'

export default function UnsavedChanges({ dirty, pending = false }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || pending) && currentLocation.pathname !== nextLocation.pathname)
  const titleId = useId()
  useEffect(() => {
    const warn = (event) => { if (dirty || pending) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, pending])
  return <EditorialDialog open={blocker.state === 'blocked'} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); blocker.reset?.() }}>
    <h2 id={titleId}>{pending ? 'Hay una operación en curso' : dirty ? 'Tienes cambios sin guardar' : 'Tus cambios ya se guardaron'}</h2><p>{pending ? 'Espera a que termine el guardado o la subida. Una petición enviada puede completarse aunque cierres la página.' : dirty ? 'Puedes seguir editando o salir y descartar estos cambios.' : 'Puedes continuar con la navegación o volver al editor.'}</p>
    <div className="form-actions"><button className="primary-button" onClick={() => blocker.reset?.()}>Seguir editando</button><button className="secondary-button" disabled={pending} onClick={() => blocker.proceed?.()}>{dirty ? 'Salir sin guardar' : 'Continuar'}</button></div>
  </EditorialDialog>
}
