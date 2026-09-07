'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bug, CheckCircle2, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export type ReportContext = {
  action?: string;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
  incidentKey?: string;
};

const REPORTABLE_API_PREFIXES = [
  '/api/send',
  '/api/send-many',
  '/api/send-with-attachments',
  '/api/drafts',
  '/api/messages',
  '/api/inbox',
  '/api/search',
  '/api/attachments',
  '/api/notifications',
];

function requestPath(input: RequestInfo | URL) {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return new URL(raw, window.location.origin).pathname;
  } catch {
    return '';
  }
}

function reportable(path: string) {
  return REPORTABLE_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function dispatchReport(detail: ReportContext) {
  window.dispatchEvent(new CustomEvent('abemail:report-issue', { detail }));
}

export default function ReportIssue() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<ReportContext>({});
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const detail = (event as CustomEvent<ReportContext>).detail ?? {};
      setContext(detail);
      setResult(null);
      setDescription('');
      setOpen(true);
    };

    window.addEventListener('abemail:report-issue', handleRequest);
    return () => window.removeEventListener('abemail:report-issue', handleRequest);
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = requestPath(input);
      const action = path.replace(/^\/api\//, '').replace(/\//g, '.');

      try {
        const response = await originalFetch(input, init);

        if (reportable(path) && response.status >= 500) {
          let errorMessage = `Request failed with status ${response.status}.`;
          let errorCode = `HTTP_${response.status}`;
          try {
            const payload = await response.clone().json();
            if (typeof payload?.error === 'string') errorMessage = payload.error.slice(0, 500);
            if (typeof payload?.code === 'string') errorCode = payload.code.slice(0, 120);
          } catch {}
          dispatchReport({ action, errorCode, errorMessage, httpStatus: response.status });
        }

        return response;
      } catch (error) {
        if (reportable(path)) {
          dispatchReport({
            action,
            errorCode: 'NETWORK_ERROR',
            errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Network request failed.',
          });
        }
        throw error;
      }
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const browser = useMemo(() => navigator.userAgent.slice(0, 160), []);
  const device = useMemo(() => `${navigator.platform}`.slice(0, 100), []);

  const submit = async () => {
    if (!description.trim() && !context.errorMessage && !context.action) return;
    setSubmitting(true);
    setResult(null);

    try {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('Please sign in before reporting an issue.');

      const response = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mailbox: user.email,
          route: window.location.pathname,
          action: context.action,
          description,
          errorCode: context.errorCode,
          errorMessage: context.errorMessage,
          httpStatus: context.httpStatus,
          incidentKey: context.incidentKey,
          browser,
          device,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to submit report.');

      setResult(`Report ${payload.reportKey} submitted.`);
      setDescription('');
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Unable to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setContext({}); setResult(null); setDescription(''); setOpen(true); }}
        aria-label="Report a problem"
        title="Report a problem"
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 45, width: 42, height: 42, borderRadius: 999, border: '1px solid #dfe2e6', background: '#fff', display: 'grid', placeItems: 'center', color: '#4e545c', boxShadow: '0 8px 25px rgba(0,0,0,.1)', cursor: 'pointer' }}
      >
        <Bug size={17} />
      </button>

      {open ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(15,18,22,.35)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <section role="dialog" aria-modal="true" aria-labelledby="report-issue-title" style={{ width: 'min(520px,100%)', background: '#fff', border: '1px solid #e2e5e9', borderRadius: 16, padding: 20, boxShadow: '0 24px 80px rgba(0,0,0,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, color: '#8a9098' }}>ABEmail Support</p>
                <h2 id="report-issue-title" style={{ margin: '5px 0 0', fontSize: 18 }}>Report a problem</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ width: 34, height: 34, border: 0, background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#777d85' }}><X size={18} /></button>
            </div>

            {context.action || context.errorMessage ? (
              <div style={{ marginTop: 14, padding: 11, borderRadius: 10, background: '#f7f8fa', fontSize: 12, color: '#5f656d' }}>
                <strong>{context.action ? `Action: ${context.action}` : 'Issue detected'}</strong>
                {context.errorMessage ? <div style={{ marginTop: 4 }}>{context.errorMessage}</div> : null}
              </div>
            ) : null}

            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell us what happened..." rows={5} style={{ width: '100%', marginTop: 14, border: '1px solid #dfe2e6', borderRadius: 10, padding: 11, resize: 'vertical', outline: 0, font: 'inherit', boxSizing: 'border-box' }} />

            <p style={{ fontSize: 11, lineHeight: 1.5, color: '#8b9098', margin: '10px 0 0' }}>ABEmail attaches safe diagnostics such as the time, page, action and request context. It does not include passwords, access tokens or message bodies.</p>

            {result ? <div style={{ marginTop: 12, padding: 10, borderRadius: 9, background: result.startsWith('Report ') ? '#eef8f2' : '#fff1f1', color: result.startsWith('Report ') ? '#28714b' : '#a13b34', fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}><CheckCircle2 size={14} />{result}</div> : null}

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ border: '1px solid #dfe2e6', background: '#fff', borderRadius: 9, padding: '9px 12px', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={submit} disabled={submitting || (!description.trim() && !context.errorMessage && !context.action)} style={{ border: 0, background: '#15171a', color: '#fff', borderRadius: 9, padding: '9px 13px', cursor: 'pointer', opacity: submitting ? .6 : 1 }}>{submitting ? 'Sending…' : 'Submit report'}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
