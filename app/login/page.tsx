'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const { error: authError } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }

    window.location.href = '/';
  }

  return (
    <main className="login-shell">
      <section className="login-visual" aria-hidden="true">
        <div className="login-visual-copy">
          <div className="brand">
            <div className="brand-mark">AB</div>
            <div>
              <strong>ABEmail</strong>
              <span>Business Mail</span>
            </div>
          </div>
          <h2>Work email that stays out of your way.</h2>
          <p>Send, receive and keep your business conversations organised from one focused workspace.</p>
        </div>
      </section>

      <section className="login-card-wrap">
        <form className="login-card" onSubmit={submit}>
          <div className="login-mobile-brand brand">
            <div className="brand-mark">AB</div>
            <div>
              <strong>ABEmail</strong>
              <span>Business Mail</span>
            </div>
          </div>

          <div className="login-heading">
            <span className="eyebrow">Secure workspace</span>
            <h1>Welcome back</h1>
            <p>Sign in to your business mailbox.</p>
          </div>

          <label className="field-label">
            <span>Email address</span>
            <div className="field-input">
              <Mail size={16} />
              <input type="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </div>
          </label>

          <label className="field-label">
            <span>Password</span>
            <div className="field-input">
              <LockKeyhole size={16} />
              <input type="password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </div>
          </label>

          <button className="compose login-submit" disabled={busy} type="submit">
            <span>{busy ? 'Signing in…' : 'Sign in'}</span>
            <ArrowRight size={16} />
          </button>

          {error && <div className="error" role="alert">{error}</div>}
          <p className="login-note">Your organisation controls your mailbox access and credentials.</p>
        </form>
      </section>
    </main>
  );
}
