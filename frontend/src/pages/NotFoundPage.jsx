import { Link } from 'react-router-dom'

export default function NotFoundPage({ resource = 'página' }) {
  return (
    <main id="main-content" tabIndex={-1} className="page-width page-main">
      <div className="page-intro">
        <span>404 · No encontrado</span>
        <h1>Esta {resource} no está aquí.</h1>
        <p>Puede que la dirección haya cambiado o que el contenido ya no esté disponible.</p>
        <Link className="text-link" to="/explore">Volver a explorar</Link>
      </div>
    </main>
  )
}
