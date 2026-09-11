'use client';

import { useEffect, useRef } from 'react';

type SignatureResponse = { signatures?: Array<{ enabled?: boolean; is_default?: boolean; text_body?: string }> };

export default function SignatureController() {
  const applied = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function getDefaultSignature() {
      try {
        const response = await fetch('/api/signatures', { cache: 'no-store' });
        if (!response.ok) return '';
        const data = await response.json() as SignatureResponse;
        const signature = data.signatures?.find((item) => item.enabled && item.is_default);
        return signature?.text_body?.trim() ?? '';
      } catch {
        return '';
      }
    }

    async function applyToNewComposer() {
      if (cancelled || applied.current) return;
      const composer = document.querySelector('.composer-window');
      const textarea = composer?.querySelector('textarea[name="body"]') as HTMLTextAreaElement | null;
      if (!textarea || textarea.value.trim()) return;

      const signature = await getDefaultSignature();
      if (cancelled || !signature || textarea.value.trim()) return;

      textarea.value = `-- \n${signature}`;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      applied.current = true;
    }

    const observer = new MutationObserver(() => { void applyToNewComposer(); });
    observer.observe(document.body, { childList: true, subtree: true });
    void applyToNewComposer();

    const reset = () => { applied.current = false; };
    window.addEventListener('focus', reset);
    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener('focus', reset);
    };
  }, []);

  return null;
}
