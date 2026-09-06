'use client';

import { useEffect } from 'react';

const BUTTON_ID = 'abemail-mark-all-read';
const SUPPORTED_VIEWS = new Set(['Primary', 'All Mail', 'Starred']);

function getActiveView() {
  const active = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-item.active'))
    .find((button) => SUPPORTED_VIEWS.has(button.textContent?.trim() ?? ''));
  return active?.textContent?.trim() ?? '';
}

function getMailboxFilter() {
  const activeChip = document.querySelector<HTMLButtonElement>('.mailbox-chip.active');
  const value = activeChip?.textContent?.trim() ?? '';
  return value && value !== 'All' ? value : '';
}

function attachButton() {
  const toolbar = document.querySelector<HTMLElement>('.list-toolbar');
  if (!toolbar || toolbar.querySelector(`#${BUTTON_ID}`)) return;

  const viewLabel = getActiveView();
  if (!viewLabel) return;

  const unreadRows = document.querySelectorAll('.message-row.unread');
  if (!unreadRows.length) return;

  const mailboxFilter = getMailboxFilter();
  if (viewLabel === 'All Mail' && mailboxFilter) return;

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.textContent = 'Mark all read';
  button.setAttribute('aria-label', `Mark all visible ${viewLabel.toLowerCase()} messages as read`);
  button.title = 'Mark all visible messages as read';
  button.style.cssText = [
    'border: 1px solid #dfe2e6',
    'background: #ffffff',
    'color: #51565e',
    'border-radius: 8px',
    'padding: 6px 9px',
    'font: inherit',
    'font-size: 11px',
    'font-weight: 700',
    'cursor: pointer',
    'white-space: nowrap',
  ].join(';');

  button.addEventListener('mouseenter', () => {
    button.style.background = '#f7f8f9';
    button.style.color = '#16181d';
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = '#ffffff';
    button.style.color = '#51565e';
  });

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Marking…';
    button.style.opacity = '0.65';
    button.style.cursor = 'wait';

    try {
      const view = viewLabel === 'Primary' ? 'primary' : viewLabel === 'All Mail' ? 'all' : 'starred';
      const response = await fetch('/api/messages/mark-all-read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ view }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Unable to mark messages as read.');

      button.textContent = data.updated ? `${data.updated} marked read` : 'All read';
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      console.error('mark all read error', error);
      button.disabled = false;
      button.textContent = 'Try again';
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
  });

  toolbar.appendChild(button);
}

export default function MarkAllRead() {
  useEffect(() => {
    attachButton();
    const observer = new MutationObserver(() => attachButton());
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    const interval = window.setInterval(attachButton, 1200);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      document.getElementById(BUTTON_ID)?.remove();
    };
  }, []);

  return null;
}
