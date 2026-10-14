'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

function getSafeRedirect() {
  const requested = new URLSearchParams(window.location.search).get('next');
  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return '/';
  return requested;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const supabase = getSupabaseBrowser();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setBusy(false);
      setError(authError.message);
      return;
    }

    // Count successful sign-ins only. The Supabase user metadata keeps this introduction
    // consistent across devices; browser storage is a best-effort fallback.
    const user = authData.user;
    if (user) {
      const countKey = 'abemail_theme_discovery_login_count_v1:' + user.id;
      const pendingKey = 'abemail_theme_discovery_pending_v1:' + user.id;
      let localCount = 0;

      try {
        const storedCount = Number(window.localStorage.getItem(countKey) ?? '0');
        if (Number.isFinite(storedCount) && storedCount >= 0) localCount = Math.floor(storedCount);
      } catch {
        // Continue with the authenticated user's metadata.
      }

      const metadataCount = Number(user.user_metadata?.abemail_theme_discovery_login_count_v1 ?? 0);
      const currentCount = Number.isFinite(metadataCount) && metadataCount >= 0
        ? Math.max(Math.floor(metadataCount), localCount)
        : localCount;
      const nextCount = currentCount + 1;
      const pendingStep = nextCount <= 2 ? nextCount : null;
      let metadataSaved = false;

      try {
        const { error: trackingError } = await supabase.auth.updateUser({
          data: {
            abemail_theme_discovery_login_count_v1: nextCount,
            abemail_theme_discovery_pending_v1: pendingStep,
          },
        });
        if (trackingError) throw trackingError;
        metadataSaved = true;
      } catch (trackingError) {
        console.warn('Theme announcement tracking is using browser storage for this sign-in.', trackingError);
      }

      try {
        window.localStorage.setItem(countKey, String(nextCount));
        if (pendingStep === null) {
          window.localStorage.removeItem(pendingKey);
        } else {
          window.localStorage.setItem(pendingKey, String(pendingStep));
        }
      } catch {
        // The login must remain usable even if browser storage is unavailable.
      }

      // Keep sign-in functional if neither tracking mechanism is available.
      if (!metadataSaved && pendingStep !== null) {
        try {
          window.localStorage.setItem(pendingKey, String(pendingStep));
        } catch {
          // Announcement tracking is non-critical to authentication.
        }
      }
    }

    setBusy(false);
    window.location.href = getSafeRedirect();
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
