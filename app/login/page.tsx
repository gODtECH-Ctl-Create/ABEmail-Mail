'use client';

import { FormEvent, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const { error: authError } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) { setError(authError.message); return; }
    window.location.href = '/';
  }

  return <main className="login-shell"><form className="login-card" onSubmit={submit}><div className="brand"><div className="brand-mark">AB</div><span>ABEmail</span></div><h1>Welcome back</h1><p>Sign in to your business mailbox.</p><input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /><button className="compose" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>{error && <div className="error">{error}</div>}</form></main>;
}
