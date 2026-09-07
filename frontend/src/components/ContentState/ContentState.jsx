import './ContentState.css'

export default function ContentState({ status = 'empty', message }) {
  if (status === 'loading') {
    return (
      <div className="content-state content-state--loading" aria-live="polite" aria-busy="true">
        <span />
        <span />
        <span />
        <p>Cargando publicaciones</p>
      </div>
    )
  }

  const copy = status === 'error'
    ? message ?? 'No se pudieron cargar las publicaciones. Comprueba la conexión e inténtalo de nuevo.'
    : message ?? 'Todavía no hay publicaciones en esta vista.'

  return (
    <div className={`content-state content-state--${status}`} role={status === 'error' ? 'alert' : 'status'}>
      <h2>{status === 'error' ? 'No pudimos completar la petición' : 'No hay resultados'}</h2>
      <p>{copy}</p>
    </div>
  )
}
