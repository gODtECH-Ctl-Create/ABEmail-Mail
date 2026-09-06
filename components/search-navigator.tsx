'use client';

import { useEffect, useRef, useState } from 'react';

const VIEW_MAP: Record<string, string> = {
  Primary: 'primary',
  'All Mail': 'all',
  'My Sent': 'my-sent',
  'All Sent': 'all-sent',
  Starred: 'starred',
  Trash: 'trash',
};

type Result = {
  id: string;
  direction: 'inbound' | 'outbound';
  from_address: string;
  to_addresses: string[];
  subject: string;
  text_body: string | null;
  created_at: string;
  is_read: boolean;
  is_starred: boolean;
  is_trashed: boolean;
};

function getScope() {
  const active = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-item.active'))
    .map((button) => button.textContent?.replace(/\d+/g, '').trim() ?? '')
    .find((label) => VIEW_MAP[label]);
  const view = VIEW_MAP[active ?? 'Primary'] ?? 'primary';
  const activeChip = document.querySelector<HTMLButtonElement>('.mailbox-chip.active');
  const mailboxLabel = activeChip?.textContent?.trim() ?? '';
  const mailbox = mailboxLabel && mailboxLabel !== 'All' ? mailboxLabel : '';
  return { view, mailbox };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function SearchNavigator() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('.search input');
    if (!input) return;
    inputRef.current = input;

    const onInput = () => {
      setQuery(input.value);
      if (input.value.trim()) setOpen(true);
    };
    const onFocus = () => {
      if (input.value.trim()) setOpen(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        input.blur();
      }
      if (event.key === 'Enter' && input.value.trim()) {
        const scope = getScope();
        const params = new URLSearchParams({ q: input.value.trim(), view: scope.view });
        if (scope.mailbox) params.set('mailbox', scope.mailbox);
        window.location.href = `/search?${params.toString()}`;
      }
    };

    input.addEventListener('input', onInput);
    input.addEventListener('focus', onFocus);
    input.addEventListener('keydown', onKeyDown);
    return () => {
      input.removeEventListener('input', onInput);
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const normalized = query.trim();
    if (!normalized) {
      setResults([]);
      setLoading(false);
      return;
    }

    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const scope = getScope();
        const params = new URLSearchParams({ q: normalized, view: scope.view });
        if (scope.mailbox) params.set('mailbox', scope.mailbox);
        const response = await fetch(`/api/search?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Unable to search mail.');
        setResults(data.messages ?? []);
      } catch (error) {
        console.error('search navigator error', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target) || inputRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || !open) return;
    const position = () => {
      const rect = input.getBoundingClientRect();
      if (dropdownRef.current) {
        dropdownRef.current.style.top = `${rect.bottom + 8}px`;
        dropdownRef.current.style.left = `${rect.left}px`;
        dropdownRef.current.style.width = `${Math.max(rect.width, 360)}px`;
      }
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open, results.length]);

  if (!open || !query.trim()) return null;

  return (
    <div
      ref={dropdownRef}
      role="dialog"
      aria-label="Search results"
      style={{
        position: 'fixed',
        zIndex: 1000,
        maxHeight: 420,
        overflow: 'auto',
        padding: 8,
        border: '1px solid #e4e6e9',
        borderRadius: 14,
        background: '#fff',
        boxShadow: '0 18px 50px rgba(19, 24, 33, 0.16)',
      }}
    >
      {loading && <div style={{ padding: '12px 14px', color: '#6b7078', fontSize: 13 }}>Searching mail…</div>}
      {!loading && results.length === 0 && (
        <div style={{ padding: '12px 14px', color: '#6b7078', fontSize: 13 }}>
          No matching messages. Press Enter to open the full search view.
        </div>
      )}
      {!loading && results.slice(0, 8).map((message) => {
        const sender = message.direction === 'outbound' ? message.to_addresses[0] ?? 'Recipient' : message.from_address;
        const preview = message.text_body?.replace(/\s+/g, ' ').trim() || 'Open message to view its content.';
        return (
          <button
            key={message.id}
            type="button"
            onClick={() => {
              const scope = getScope();
              const params = new URLSearchParams({ q: query.trim(), view: scope.view });
              if (scope.mailbox) params.set('mailbox', scope.mailbox);
              window.location.href = `/search?${params.toString()}&focus=${encodeURIComponent(message.id)}`;
            }}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              width: '100%',
              padding: '10px 11px',
              border: 0,
              borderRadius: 10,
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 13, color: '#17191e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sender}</strong>
              <span style={{ display: 'block', marginTop: 2, fontSize: 12, fontWeight: 600, color: '#3e4249', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.subject || '(no subject)'}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: '#7b8088', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</span>
            </span>
            <span style={{ alignSelf: 'start', fontSize: 10, color: '#8a8f97', whiteSpace: 'nowrap' }}>{formatDate(message.created_at)}</span>
          </button>
        );
      })}
      {!loading && results.length > 8 && (
        <button
          type="button"
          onClick={() => {
            const scope = getScope();
            const params = new URLSearchParams({ q: query.trim(), view: scope.view });
            if (scope.mailbox) params.set('mailbox', scope.mailbox);
            window.location.href = `/search?${params.toString()}`;
          }}
          style={{ width: '100%', padding: '10px 11px', border: 0, borderTop: '1px solid #eef0f2', background: '#fff', color: '#4f46e5', fontSize: 12, fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}
        >
          View all {results.length} results →
        </button>
      )}
    </div>
  );
}
