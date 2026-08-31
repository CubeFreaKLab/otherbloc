import { Link } from 'react-router-dom'

export default function RegisterPage() {
  return (
    <main className="auth-page page-width page-main">
      <section className="auth-page__intro">
        <h1>Make room for better ideas.</h1>
        <p>Create a reader profile and build a personal collection of considered publishing.</p>
        <img src="/images/editorial-process.webp" alt="Hands arranging editorial pages on a studio table" />
      </section>
      <section className="auth-panel" aria-labelledby="register-heading">
        <h2 id="register-heading">Create an account</h2>
        <form>
          <div className="form-field">
            <label htmlFor="register-name">Name</label>
            <input id="register-name" type="text" autoComplete="name" required />
          </div>
          <div className="form-field">
            <label htmlFor="register-email">Email address</label>
            <input id="register-email" type="email" autoComplete="email" required />
          </div>
          <div className="form-field">
            <label htmlFor="register-password">Password</label>
            <input id="register-password" type="password" autoComplete="new-password" required />
            <small>Use at least eight characters.</small>
          </div>
          <button className="primary-button" type="submit">Create account</button>
        </form>
        <p>Already registered? <Link to="/login">Log in</Link></p>
      </section>
    </main>
  )
}
