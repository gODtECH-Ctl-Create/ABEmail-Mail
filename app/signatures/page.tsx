'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Check, Edit3, Plus, Save, Trash2, X } from 'lucide-react';
import styles from './signatures.module.css';

type Signature = { id: string; mailbox_address: string; name: string; html_body: string; text_body: string; enabled: boolean; is_default: boolean; created_at: string; updated_at: string };
type FormState = { id?: string; mailbox_address: string; name: string; html_body: string; text_body: string; enabled: boolean; is_default: boolean };
const EMPTY: FormState = { mailbox_address: '', name: '', html_body: '', text_body: '', enabled: true, is_default: false };

export default function SignaturesPage() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [mailbox, setMailbox] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/signatures', { cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401) { window.location.href = '/login'; return; }
      if (!response.ok) throw new Error(data.error ?? 'Unable to load signatures.');
      const rows = Array.isArray(data.signatures) ? data.signatures : [];
      setSignatures(rows);
      setMailbox(data.mailbox ?? '');
      setForm((current) => current.id ? current : { ...EMPTY, mailbox_address: data.mailbox ?? '' });
    } catch (loadError) {
      console.error(loadError);
      setError('Unable to load signatures.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function newSignature() { setForm({ ...EMPTY, mailbox_address: mailbox }); setError(''); }
  function edit(signature: Signature) { setForm({ ...signature }); setError(''); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/signatures', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save signature.');
      setMessage(form.id ? 'Signature updated.' : 'Signature created.');
      setForm({ ...EMPTY, mailbox_address: mailbox });
      await load();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Unable to save signature.');
    } finally { setSaving(false); }
  }

  async function remove(signature: Signature) {
    if (!window.confirm(`Delete “${signature.name}”?`)) return;
    try {
      const response = await fetch(`/api/signatures?id=${encodeURIComponent(signature.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to delete signature.');
      if (form.id === signature.id) setForm({ ...EMPTY, mailbox_address: mailbox });
      setMessage('Signature deleted.');
      await load();
    } catch (removeError) { setError(removeError instanceof Error ? removeError.message : 'Unable to delete signature.'); }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button className={styles.back} type="button" onClick={() => (window.location.href = '/')} aria-label="Back to inbox"><ArrowLeft size={18} /></button>
          <div className={styles.headerText}>
            <p className={styles.eyebrow}>ABEmail · Business</p>
            <h1>Saved Signatures</h1>
            <p className={styles.subtitle}>Keep professional sender details ready for new email.</p>
          </div>
          <button className={styles.primary} type="button" onClick={newSignature}><Plus size={15} /> New signature</button>
        </header>

        {message && <div className={styles.notice} role="status"><Check size={15} /> {message}</div>}
        {error && <div className={styles.error} role="alert">{error}</div>}

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHead}><div><p className={styles.eyebrow}>Mailbox</p><h2>{mailbox || 'Your mailbox'}</h2></div><span className={styles.count}>{signatures.length} saved</span></div>
            <div className={styles.list}>
              {loading ? <div className={styles.empty}>Loading signatures…</div> : signatures.length === 0 ? <div className={styles.empty}>No saved signatures yet.<br />Create one to use it automatically in Compose.</div> : signatures.map((signature) => (
                <article key={signature.id} className={`${styles.item} ${signature.id === form.id ? styles.active : ''}`}>
                  <div className={styles.itemTop}><div><strong>{signature.name}</strong><div className={styles.meta}>{signature.is_default ? 'Default' : 'Optional'} · {signature.enabled ? 'Enabled' : 'Disabled'}</div></div><span className={styles.count}>{signature.is_default ? 'Default' : 'Saved'}</span></div>
                  <div className={styles.preview}>{signature.text_body || htmlToText(signature.html_body)}</div>
                  <div className={styles.itemActions}><button type="button" onClick={() => edit(signature)}><Edit3 size={13} /> Edit</button><button type="button" className={styles.danger} onClick={() => void remove(signature)}><Trash2 size={13} /> Delete</button></div>
                </article>
              ))}
            </div>
          </section>

          <form className={styles.card} onSubmit={save}>
            <div className={styles.cardHead}><div><p className={styles.eyebrow}>{form.id ? 'Edit signature' : 'Create signature'}</p><h2>{form.name || 'New signature'}</h2></div>{form.id && <button className={styles.iconButton} type="button" onClick={newSignature} aria-label="Cancel edit"><X size={16} /></button>}</div>
            <div className={styles.form}>
              <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Professional" maxLength={100} required /></label>
              <label>Mailbox<input value={form.mailbox_address} readOnly /></label>
              <label>Signature text<textarea value={form.text_body} onChange={(event) => setForm({ ...form, text_body: event.target.value })} placeholder={'Ayo Richard Abe\nSoftware Developer · ABE Tech Lab'} rows={8} maxLength={10000} /></label>
              <label>HTML version<textarea value={form.html_body} onChange={(event) => setForm({ ...form, html_body: event.target.value })} placeholder={'<strong>Ayo Richard Abe</strong><br>Software Developer · ABE Tech Lab'} rows={7} maxLength={20000} /></label>
              <p className={styles.helper}>The text version is inserted into the current plain-text Compose editor. The HTML version is stored for rich-email support.</p>
              <div className={styles.checks}><label className={styles.check}><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label><label className={styles.check}><input type="checkbox" checked={form.is_default} onChange={(event) => setForm({ ...form, is_default: event.target.checked })} /> Default</label></div>
              <div className={styles.formActions}>{form.id && <button className={styles.secondary} type="button" onClick={newSignature}>Cancel</button>}<button className={styles.primary} type="submit" disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save signature'}</button></div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

function htmlToText(value: string) { return value.replace(/<br\s*\/?>(\s*)/gi, '\n').replace(/<[^>]+>/g, '').trim(); }
