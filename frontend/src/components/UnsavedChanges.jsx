import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { useBlocker, useLocation, useNavigate, useNavigation } from 'react-router-dom'
import EditorialDialog from './EditorialDialog'

export default function UnsavedChanges({ dirty, pending = false }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || pending) && currentLocation.pathname !== nextLocation.pathname)
  const location = useLocation(), navigation = useNavigation(), navigate = useNavigate()
  const historyIndex = useRef(window.history.state?.idx), canceling = useRef(false)
  useLayoutEffect(() => { historyIndex.current = window.history.state?.idx }, [location.key])
  const titleId = useId()
  useLayoutEffect(() => {
    if (navigation.state === 'idle') canceling.current = false
    if (!canceling.current && (dirty || pending) && blocker.state === 'unblocked' && navigation.state !== 'idle' && navigation.location.pathname !== location.pathname) {
      // Editing after a slow navigation started cancels that navigation, not the new work.
      canceling.current = true
      const currentIndex = window.history.state?.idx
      // During POP the browser cursor has already moved, although the old page is still mounted.
      // Restore the Router-owned index; replacing that entry would erase the page we came from.
      if (Number.isInteger(historyIndex.current) && Number.isInteger(currentIndex) && historyIndex.current !== currentIndex) navigate(historyIndex.current - currentIndex)
      else navigate(location.pathname + location.search + location.hash, { replace: true, preventScrollReset: true, viewTransition: false })
    }
  }, [dirty, pending, blocker.state, navigation, location, navigate])
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
