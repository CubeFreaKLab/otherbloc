import { useEffect, useRef } from 'react'
import SessionBoundary from '../components/SessionBoundary'
import ContentState from '../components/ContentState/ContentState'
import { useCreatePublication } from '../hooks/useCreatePublication'

function CreateDraft() {
  const { create, error } = useCreatePublication({ replace: true }), started = useRef(false)
  useEffect(() => { if (!started.current) { started.current = true; create() } }, [create])
  return error ? <ContentState status="error" message={error} onRetry={create} /> : <p role="status">Abriendo tu borrador…</p>
}

export default function NewPublicationPage() {
  return <main id="main-content" tabIndex={-1} className="page-width page-main"><h1 className="visually-hidden">Escribir una nota</h1><SessionBoundary><CreateDraft /></SessionBoundary></main>
}
