'use client';

import { useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

const BUCKET = 'abemail-attachments';
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TOTAL_SIZE = 35 * 1024 * 1024;
const PANEL_MARKER = 'data-abemail-attachments-mounted';

type UploadedAttachment = {
  id: string;
  path: string;
  filename: string;
  contentType: string;
  size: number;
};

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'attachment';
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / (1024 * 102.4)) / 10} MB`;
}

function getMessageSnapshot() {
  const detail = document.querySelector<HTMLElement>('.message-detail');
  if (!detail) return null;
  const heading = detail.querySelector<HTMLElement>('.detail-heading');
  const from = heading?.querySelector<HTMLElement>('.detail-meta strong')?.textContent?.trim().toLowerCase() ?? '';
  const subject = heading?.querySelector<HTMLElement>('h2')?.textContent?.trim() ?? '';
  const body = detail.querySelector<HTMLElement>('.message-content')?.innerText?.trim() ?? '';
  if (!from || !subject) return null;
  return { from, subject, body };
}

function installComposer() {
  const composer = document.querySelector<HTMLFormElement>('.composer-window');
  const foot = composer?.querySelector<HTMLElement>('.composer-foot');
  if (!composer || !foot || foot.hasAttribute(PANEL_MARKER)) return;
  foot.setAttribute(PANEL_MARKER, '1');

  const state: { uploads: UploadedAttachment[]; busy: boolean } = { uploads: [], busy: false };
  const supabase = getSupabaseBrowser();

  const tools = document.createElement('div');
  tools.className = 'attachment-tools';
  tools.innerHTML = `
    <div class="attachment-actions-row">
      <button type="button" class="attachment-trigger">Attach files</button>
      <input type="file" class="attachment-input" multiple hidden />
    </div>
    <div class="attachment-list" aria-live="polite"></div>`;
  foot.prepend(tools);

  const button = tools.querySelector<HTMLButtonElement>('.attachment-trigger');
  const input = tools.querySelector<HTMLInputElement>('.attachment-input');
  const list = tools.querySelector<HTMLElement>('.attachment-list');
  if (!button || !input || !list) return;

  const isDraft = () => Boolean(composer.querySelector('.delete-draft-button'));

  const render = () => {
    list.innerHTML = state.uploads.map((item) => `
      <span class="attachment-chip">
        <span class="attachment-chip-copy"><strong>${item.filename.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong><small>${formatSize(item.size)}</small></span>
        <button type="button" data-attachment-remove="${item.id}" aria-label="Remove ${item.filename.replace(/"/g, '')}">×</button>
      </span>`).join('');

    list.querySelectorAll<HTMLButtonElement>('[data-attachment-remove]').forEach((removeButton) => {
      removeButton.addEventListener('click', () => {
        const id = removeButton.dataset.attachmentRemove ?? '';
        const item = state.uploads.find((upload) => upload.id === id);
        state.uploads = state.uploads.filter((upload) => upload.id !== id);
        render();
        if (item) void supabase.storage.from(BUCKET).remove([item.path]);
      });
    });
  };

  button.addEventListener('click', () => {
    if (isDraft()) {
      button.textContent = 'Attachments available for new messages';
      window.setTimeout(() => { button.textContent = 'Attach files'; }, 1800);
      return;
    }
    input.click();
  });

  input.addEventListener('change', async () => {
    if (!input.files?.length || state.busy) return;
    state.busy = true;
    button.disabled = true;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      button.disabled = false;
      state.busy = false;
      return;
    }

    try {
      let total = state.uploads.reduce((sum, item) => sum + item.size, 0);
      const files = Array.from(input.files);
      if (state.uploads.length + files.length > MAX_FILES) throw new Error(`You can attach up to ${MAX_FILES} files.`);

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} exceeds the 20 MB file limit.`);
        total += file.size;
        if (total > MAX_TOTAL_SIZE) throw new Error('Combined attachments exceed the 35 MB limit.');

        const id = crypto.randomUUID();
        const filename = safeFilename(file.name);
        const path = `${userId}/${id}-${filename}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (error) throw new Error(`Unable to upload ${filename}.`);
        state.uploads.push({ id: path, path, filename, contentType: file.type || 'application/octet-stream', size: file.size });
      }
      render();
    } catch (error) {
      button.textContent = error instanceof Error ? error.message : 'Attachment upload failed.';
      window.setTimeout(() => { button.textContent = 'Attach files'; }, 2500);
    } finally {
      input.value = '';
      button.disabled = false;
      state.busy = false;
    }
  });

  composer.addEventListener('submit', async (event) => {
    if (!state.uploads.length) return;
    if (state.busy || isDraft()) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    state.busy = true;
    button.disabled = true;

    const to = composer.querySelector<HTMLInputElement>('input[name="to"]')?.value ?? '';
    const subject = composer.querySelector<HTMLInputElement>('input[name="subject"]')?.value ?? '';
    const message = composer.querySelector<HTMLTextAreaElement>('textarea[name="body"]')?.value ?? '';
    const status = composer.querySelector<HTMLElement>('.composer-status span');
    const recipients = to.split(/[\n,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);

    if (!recipients.length || !subject.trim() || !message.trim()) {
      if (status) status.textContent = 'To, subject and message are required.';
      state.busy = false;
      button.disabled = false;
      return;
    }

    if (status) status.textContent = 'Sending with attachments…';
    try {
      const response = await fetch('/api/send-with-attachments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: recipients,
          subject: subject.trim(),
          html: message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />'),
          attachments: state.uploads.map(({ path, filename, contentType, size }) => ({ path, filename, contentType, size })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Unable to send message with attachments.');
      if (status) status.textContent = 'Message sent';
      window.setTimeout(() => window.location.reload(), 550);
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : 'Unable to send message.';
      state.busy = false;
      button.disabled = false;
    }
  }, true);

  const closeButton = composer.querySelector<HTMLButtonElement>('.composer-head .icon-button');
  closeButton?.addEventListener('click', () => {
    if (state.uploads.length) {
      void supabase.storage.from(BUCKET).remove(state.uploads.map((item) => item.path));
    }
  }, true);
}

async function installReceivedAttachments() {
  const detail = document.querySelector<HTMLElement>('.message-detail');
  const scroll = detail?.querySelector<HTMLElement>('.detail-scroll');
  if (!detail || !scroll || scroll.querySelector('[data-abemail-received-attachments]')) return;

  const snapshot = getMessageSnapshot();
  if (!snapshot) return;

  try {
    const params = new URLSearchParams(snapshot);
    const response = await fetch(`/api/attachments/resolve?${params.toString()}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.attachments) || !data.attachments.length) return;

    const panel = document.createElement('div');
    panel.className = 'received-attachments';
    panel.setAttribute('data-abemail-received-attachments', '1');
    panel.innerHTML = `<div class="received-attachments-title">Attachments (${data.attachments.length})</div>` + data.attachments.map((item: { id?: string; filename?: string; content_type?: string; size?: number }) => {
      const id = typeof item.id === 'string' ? item.id : '';
      const filename = typeof item.filename === 'string' ? item.filename : 'Attachment';
      const size = typeof item.size === 'number' ? formatSize(item.size) : '';
      const href = `/api/attachments?messageId=${encodeURIComponent(data.messageId)}&attachmentId=${encodeURIComponent(id)}`;
      return `<a class="received-attachment-card" href="${href}" target="_blank" rel="noopener noreferrer"><span class="received-attachment-icon">${(item.content_type ?? '').startsWith('image/') ? 'IMG' : 'FILE'}</span><span><strong>${filename.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong><small>${size}</small></span></a>`;
    }).join('');

    scroll.appendChild(panel);
  } catch (error) {
    console.error('received attachments render error', error);
  }
}

export default function AttachmentsController() {
  useEffect(() => {
    installComposer();
    void installReceivedAttachments();
    const observer = new MutationObserver(() => {
      installComposer();
      void installReceivedAttachments();
    });
    observer.observe(document.body, { subtree: true, childList: true });
    const interval = window.setInterval(() => {
      installComposer();
      void installReceivedAttachments();
    }, 1000);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
