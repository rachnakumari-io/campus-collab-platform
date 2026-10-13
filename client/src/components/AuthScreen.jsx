import { useState } from 'react'

export default function AuthScreen({ onSubmit, error, busy }) {
  const [mode, setMode] = useState('login')
  const isRegister = mode === 'register'

  function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSubmit(Object.fromEntries(form.entries()), mode)
  }

  return (
    <main className="auth-page">
      <div className="auth-brand"><span className="brand-mark">C</span> campus<span className="brand-light">connect</span></div>
      <section className="auth-card">
        <p className="eyebrow">YOUR CAMPUS, YOUR COMMUNITY</p>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-subtitle">{isRegister ? 'Meet students and find your next collaboration.' : 'Log in to find your people and keep building.'}</p>
        <form className="form-stack" onSubmit={handleSubmit}>
          {isRegister && <label>Full name<input autoComplete="name" minLength="2" maxLength="80" name="name" placeholder="Your name" required /></label>}
          <label>College email<input autoComplete="email" name="email" placeholder="you@college.edu" required type="email" /></label>
          {isRegister && <label>College / university<input maxLength="120" name="college" placeholder="Your college name" required /></label>}
          <label>Password<input autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={isRegister ? 8 : undefined} name="password" placeholder={isRegister ? 'At least 8 characters' : 'Your password'} required type="password" /></label>
          {isRegister && <p className="form-hint">Use a college email where available. An email domain by itself does not verify enrollment.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" disabled={busy} type="submit">{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}</button>
        </form>
        <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Campus Connect?'} <button type="button" onClick={() => setMode(isRegister ? 'login' : 'register')}>{isRegister ? 'Log in' : 'Create an account'}</button></p>
      </section>
    </main>
  )
}
