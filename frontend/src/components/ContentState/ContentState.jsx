import './ContentState.css'

export default function ContentState({ status = 'empty', message }) {
  if (status === 'loading') {
    return (
      <div className="content-state content-state--loading" aria-live="polite" aria-busy="true">
        <span />
        <span />
        <span />
        <p>Loading publications</p>
      </div>
    )
  }

  const copy = status === 'error'
    ? message ?? 'Publications could not be loaded. Check the connection and try again.'
    : message ?? 'No publications match this view yet.'

  return (
    <div className={`content-state content-state--${status}`} role={status === 'error' ? 'alert' : 'status'}>
      <h2>{status === 'error' ? 'Something interrupted the request' : 'Nothing to show yet'}</h2>
      <p>{copy}</p>
    </div>
  )
}
