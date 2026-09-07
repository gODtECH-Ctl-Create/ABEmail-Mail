'use client';

import { useEffect } from 'react';

const BUTTON_MARKER = 'data-abemail-reply-forward';

type MailSnapshot = {
  from: string;
  to: string[];
  subject: string;
  body: string;
  date: string;
};

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function replySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function forwardSubject(subject: string) {
  return /^fwd:/i.test(subject) ? subject : `Fwd: ${subject}`;
}

function toHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />');
}

function getSnapshot(): MailSnapshot | null {
  const detail = document.querySelector<HTMLElement>('.message-detail');
  if (!detail) return null;

  const heading = detail.querySelector<HTMLElement>('.detail-heading');
  const sender = heading?.querySelector<HTMLElement>('.detail-meta strong')?.textContent?.trim().toLowerCase() ?? '';
  const recipientsText = heading?.querySelector<HTMLElement>('.detail-meta span')?.textContent?.trim() ?? '';
  const recipients = recipientsText.replace(/^to\s+/i, '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  const subject = heading?.querySelector<HTMLElement>('h2')?.textContent?.trim() ?? '';
  const body = detail.querySelector<HTMLElement>('.message-content')?.innerText?.trim() ?? '';
  const date = heading?.querySelector<HTMLElement>('time')?.textContent?.trim() ?? '';

  if (!sender || !subject) return null;
  return { from: sender, to: recipients, subject, body, date: date || new Date().toLocaleString() };
}

function openDialog(snapshot: MailSnapshot, mode: 'reply-all' | 'forward') {
  document.querySelector('.abemail-rf-overlay')?.remove();

  const account = document.querySelector<HTMLElement>('.account-copy strong')?.textContent?.trim().toLowerCase() ?? '';
  const recipients = mode === 'reply-all'
    ? dedupe([snapshot.from, ...snapshot.to]).filter((address) => address !== account)
    : [];
  const subject = mode === 'reply-all' ? replySubject(snapshot.subject) : forwardSubject(snapshot.subject);
  const body = mode === 'reply-all'
    ? `\n\nOn ${snapshot.date}, ${snapshot.from} wrote:\n${snapshot.body}`
    : `\n\n---------- Forwarded message ----------\nFrom: ${snapshot.from}\nTo: ${snapshot.to.join(', ')}\nSubject: ${snapshot.subject}\n\n${snapshot.body}`;

  const overlay = document.createElement('div');
  overlay.className = 'abemail-rf-overlay';
  overlay.innerHTML = `
    <div class="abemail-rf-dialog" role="dialog" aria-modal="true" aria-labelledby="abemail-rf-title">
      <div class="abemail-rf-head">
        <div><span class="eyebrow">ABEmail</span><strong id="abemail-rf-title"></strong></div>
        <button type="button" class="icon-button abemail-rf-close" aria-label="Close">×</button>
      </div>
      <label class="abemail-rf-field"><span>To</span><input class="abemail-rf-to" placeholder="recipient@example.com" /></label>
      <label class="abemail-rf-field"><span>Subject</span><input class="abemail-rf-subject" /></label>
      <label class="abemail-rf-field"><span>Message</span><textarea class="abemail-rf-body"></textarea></label>
      <div class="abemail-rf-status" aria-live="polite"></div>
      <div class="abemail-rf-actions"><button type="button" class="reply-button secondary abemail-rf-cancel">Cancel</button><button type="button" class="send-button abemail-rf-send">Send</button></div>
    </div>`;
  document.body.appendChild(overlay);

  const title = overlay.querySelector<HTMLElement>('#abemail-rf-title');
  const toField = overlay.querySelector<HTMLInputElement>('.abemail-rf-to');
  const subjectField = overlay.querySelector<HTMLInputElement>('.abemail-rf-subject');
  const bodyField = overlay.querySelector<HTMLTextAreaElement>('.abemail-rf-body');
  const status = overlay.querySelector<HTMLElement>('.abemail-rf-status');
  const sendButton = overlay.querySelector<HTMLButtonElement>('.abemail-rf-send');
  const close = () => overlay.remove();

  if (title) title.textContent = mode === 'reply-all' ? 'Reply all' : 'Forward message';
  if (toField) toField.value = recipients.join(', ');
  if (subjectField) subjectField.value = subject;
  if (bodyField) bodyField.value = body;

  overlay.querySelector<HTMLButtonElement>('.abemail-rf-close')?.addEventListener('click', close);
  overlay.querySelector<HTMLButtonElement>('.abemail-rf-cancel')?.addEventListener('click', close);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });

  sendButton?.addEventListener('click', async () => {
    if (!sendButton || !toField || !subjectField || !bodyField || !status) return;
    const to = dedupe(toField.value.split(/[\n,;]+/));
    const finalSubject = subjectField.value.trim();
    const finalBody = bodyField.value.trim();
    if (!to.length || !finalSubject || !finalBody) {
      status.textContent = 'Recipient, subject and message are required.';
      return;
    }

    sendButton.disabled = true;
    sendButton.textContent = 'Sending…';
    status.textContent = '';
    try {
      const response = await fetch('/api/send-many', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: finalSubject,
          text: finalBody,
          html: toHtml(finalBody),
          replyTo: mode === 'reply-all' ? snapshot.from : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Unable to send message.');
      status.textContent = 'Message sent.';
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      console.error('reply/forward send error', error);
      status.textContent = error instanceof Error ? error.message : 'Unable to send message.';
      sendButton.disabled = false;
      sendButton.textContent = 'Send';
    }
  });
}

function installActions() {
  const actions = document.querySelector<HTMLElement>('.detail-reply-actions');
  if (!actions) return;

  if (!actions.querySelector(`[${BUTTON_MARKER}="reply-all"]`)) {
    const forwardButton = Array.from(actions.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Forward'));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reply-button secondary';
    button.setAttribute(BUTTON_MARKER, 'reply-all');
    button.textContent = 'Reply all';
    button.addEventListener('click', () => {
      const snapshot = getSnapshot();
      if (snapshot) openDialog(snapshot, 'reply-all');
    });
    if (forwardButton) actions.insertBefore(button, forwardButton);
    else actions.appendChild(button);
  }

  const forwardButton = Array.from(actions.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Forward'));
  if (forwardButton && !forwardButton.hasAttribute(`${BUTTON_MARKER}-forward`)) {
    forwardButton.setAttribute(`${BUTTON_MARKER}-forward`, '1');
    forwardButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const snapshot = getSnapshot();
      if (snapshot) openDialog(snapshot, 'forward');
    }, true);
  }
}

export default function ReplyForwardController() {
  useEffect(() => {
    installActions();
    const observer = new MutationObserver(installActions);
    observer.observe(document.body, { subtree: true, childList: true });
    const interval = window.setInterval(installActions, 900);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      document.querySelector('.abemail-rf-overlay')?.remove();
    };
  }, []);

  return null;
}
