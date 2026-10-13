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

let lastAutoReportAt = 0;

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

function dispatchReport(detail: ReportContext, automatic = false) {
  if (automatic) {
    const now = Date.now();
    if (now - lastAutoReportAt < 15000) return;
    lastAutoReportAt = now;
  }
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
          dispatchReport({ action, errorCode, errorMessage, httpStatus: response.status }, true);
        }

        return response;
      } catch (error) {
        if (reportable(path)) {
          dispatchReport({
            action,
            errorCode: 'NETWORK_ERROR',
            errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Network request failed.',
          }, true);
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
        className="report-issue-fab"
      >
        <Bug size={17} />
      </button>

      {open ? (
        <div className="report-issue-backdrop">
          <section className="report-issue-dialog" role="dialog" aria-modal="true" aria-labelledby="report-issue-title">
            <div className="report-issue-header">
              <div>
                <p className="report-issue-kicker">ABEmail Support</p>
                <h2 id="report-issue-title">Report a problem</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="report-issue-close">
                <X size={18} />
              </button>
            </div>

            {context.action || context.errorMessage ? (
              <div className="report-issue-context">
                <strong>{context.action ? `Action: ${context.action}` : 'Issue detected'}</strong>
                {context.errorMessage ? <div className="report-issue-context-detail">{context.errorMessage}</div> : null}
              </div>
            ) : null}

            <textarea
              className="report-issue-textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tell us what happened..."
              rows={5}
            />

            <p className="report-issue-help">ABEmail attaches safe diagnostics such as the time, page, action and request context. It does not include passwords, access tokens or message bodies.</p>

            {result ? (
              <div className={`report-issue-result ${result.startsWith('Report ') ? 'is-success' : 'is-error'}`} role="status">
                <CheckCircle2 size={14} />
                <span>{result}</span>
              </div>
            ) : null}

            <div className="report-issue-actions">
              <button type="button" onClick={() => setOpen(false)} className="report-issue-cancel">Cancel</button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || (!description.trim() && !context.errorMessage && !context.action)}
                className="report-issue-submit"
              >
                {submitting ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
