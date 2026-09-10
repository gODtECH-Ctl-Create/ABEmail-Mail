'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Edit3, Mail, Plus, Save, Trash2, X } from 'lucide-react';
import styles from './signatures.module.css';

type Signature = {
  id: string;
  mailbox_address: string;
  name: string;
  html_body: string;
  text_body: string;
  enabled: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  mailbox_address: string;
  name: string;
  html_body: string;
  text_body: string;
  enabled: boolean;
  is_default: boolean;
};

const EMPTY_FORM: FormState = {
  mailbox_address: '',
  name: '',
  html_body: '',
  text_body: '',
  enabled: true,
  is_default: false,
};

export default function SignaturesPage() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/signatures', { cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!response.ok) throw new Error(data.error ?? 'Unable to load signatures.');
      setSignatures(data.signatures ?? []);
      if (data.mailbox) {
        setSelectedMailbox(data.mailbox);
        setForm((current) => current.id ? current : { ...current, mailbox_address: data.mailbox });
      }
    } catch (loadError) {
      console.error(loadError);
      setError('Unable to load signatures.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const mailboxSignatures = useMemo(
    () => signatures.filter((signature) => signature.mailbox_address === selectedMailbox),
    [signatures, selectedMailbox],
  );

  function chooseMailbox(mailbox: string) {
    setSelectedMailbox(mailbox);
    setForm({ ...EMPTY_FORM, mailbox_address: mailbox });
    setError('');
  }

  function startEdit(signature: Signature) {
    setSelectedMailbox(signature.mailbox_address);
    setForm({
      id: signature.id,
      mailbox_address: signature.mailbox_address,
      name: signature.name,
      html_body: signature.html_body,
      text_body: signature.text_body,
      enabled: signature.enabled,
      is_default: signature.is_default,
    });
    setError('');
  }

  function startNew() {
    setForm({ ...EMPTY_FORM, mailbox_address: selectedMailbox });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/signatures', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form.id ? form : form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save signature.');
      setNotice(form.id ? 'Signature updated' : 'Signature created');
      setSelectedMailbox(form.mailbox_address);
      setForm({ ...EMPTY_FORM, mailbox_address: form.mailbox_address });
      await load();
      window.setTimeout(() => setNotice(''), 2200);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Unable to save signature.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(signature: Signature) {
    if (!window.confirm(`Delete “${signature.name}”?`)) return;
    try {
      const response = await fetch(`/api/signatures?id=${encodeURIComponent(signature.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to delete signature.');
      setNotice('Signature deleted');
      if (form.id === signature.id) setForm({ ...EMPTY_FORM, mailbox_address: selectedMailbox });
      await load();
      window.setTimeout(() => setNotice(''), 2200);
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete signature.');
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => (window.location.href = '/')} aria-label="Back to inbox">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className={styles.eyebrow}>ABEmail · Business</p>
            <h1>Saved Signatures</h1>
            <p>Keep professional sender details ready for every new email.</p>
          </div>
          <button type="button" className={styles.primary} onClick={startNew}><Plus size={16} /> New signature</button>
        </header>

        {notice && <div className={styles.notice}><Check size={15} />{notice}</div>}
        {error && <div className={styles.error} role="alert">{error}</div>}

        <div className={styles.layout}>
          <aside className={styles.mailboxes} aria-label="Mailboxes">
            <span className={styles.sectionLabel}>Mailbox</span>
            {[selectedMailbox].filter(Boolean).map((mailbox) => (
              <button key={mailbox} type="button" className={`${styles.mailbox} ${selectedMailbox === mailbox ? styles.active : ''}`} onClick={() => chooseMailbox(mailbox)}>
                <Mail size={15} />
                <span>{mailbox}</span>
                <b>{signatures.filter((signature) => signature.mailbox_address === mailbox).length}</b>
              </button>
            ))}
          </aside>

          <div className={styles.content}>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div><span className={styles.eyebrow}>Current mailbox</span><h2>{selectedMailbox}</h2></div>
                <span className={styles.count}>{mailboxSignatures.length} saved</span>
              </div>

              <div className={styles.signatureList}>
                {loading ? (
                  <div className={styles.empty}>Loading signatures…</div>
                ) : mailboxSignatures.length === 0 ? (
                  <div className={styles.empty}>No signatures yet. Create one for this mailbox.</div>
                ) : mailboxSignatures.map((signature) => (
                  <article key={signature.id} className={styles.signatureCard}>
                    <div className={styles.signatureCardHead}>
                      <div><strong>{signature.name}</strong><div className={styles.meta}>{signature.is_default ? 'Default' : 'Optional'} · {signature.enabled ? 'Enabled' : 'Disabled'}</div></div>
                      {signature.is_default && <span className={styles.defaultPill}>Default</span>}
                    </div>
                    <div className={styles.preview} dangerouslySetInnerHTML={{ __html: signature.html_body || escapeHtml(signature.text_body).replace(/\n/g, '<br />') }} />
                    <div className={styles.cardActions}>
                      <button type="button" onClick={() => startEdit(signature)}><Edit3 size={14} /> Edit</button>
                      <button type="button" className={styles.danger} onClick={() => void remove(signature)}><Trash2 size={14} /> Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <form className={styles.card} onSubmit={save}>
              <div className={styles.cardHead}><div><span className={styles.eyebrow}>{form.id ? 'Edit signature' : 'Create signature'}</span><h2>{form.name || 'New signature'}</h2></div></div>
              <div className={styles.grid}>
                <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Professional" maxLength={100} required /></label>
                <label><span>Mailbox</span><input value={form.mailbox_address} readOnly aria-readonly="true" /></label>
              </div>
              <label><span>HTML signature</span><textarea value={form.html_body} onChange={(event) => setForm({ ...form, html_body: event.target.value })} placeholder="<strong>Jane Doe</strong><br>Sales · Waste2Light" rows={7} maxLength={20000} /></label>
              <label><span>Plain-text fallback</span><textarea value={form.text_body} onChange={(event) => setForm({ ...form, text_body: event.target.value })} placeholder={'Jane Doe\nSales · Waste2Light'} rows={5} maxLength={10000} /></label>
              <div className={styles.options}>
                <label className={styles.check}><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label>
                <label className={styles.check}><input type="checkbox" checked={form.is_default} onChange={(event) => setForm({ ...form, is_default: event.target.checked })} /> Use as default for this mailbox</label>
              </div>
              <div className={styles.formActions}>
                {form.id && <button type="button" className={styles.secondary} onClick={() => setForm({ ...EMPTY_FORM, mailbox_address: selectedMailbox })}><X size={15} /> Cancel</button>}
                <button type="submit" className={styles.primary} disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save signature'}</button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
