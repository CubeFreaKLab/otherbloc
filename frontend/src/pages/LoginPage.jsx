import { Link } from 'react-router-dom'

export default function LoginPage() {
  return (
    <main className="auth-page page-width page-main">
      <section className="auth-page__intro">
        <h1>Continue your reading.</h1>
        <p>Sign in to save publications, follow authors, and return to the ideas that matter.</p>
        <img src="/images/article-reading.webp" alt="A reader with an independent magazine in a modern library" />
      </section>
      <section className="auth-panel" aria-labelledby="login-heading">
        <h2 id="login-heading">Log in</h2>
        <form>
          <div className="form-field">
            <label htmlFor="login-email">Email address</label>
            <input id="login-email" type="email" autoComplete="email" required />
          </div>
          <div className="form-field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" required />
          </div>
          <button className="primary-button" type="submit">Log in</button>
        </form>
        <p>New to otherbloc? <Link to="/register">Create an account</Link></p>
      </section>
    </main>
  )
}
