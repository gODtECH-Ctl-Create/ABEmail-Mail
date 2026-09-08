'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookUser, Check, Mail, Menu, PenLine, Plus, Search, Settings, Trash2, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import './contacts.css';

type Contact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type FormState = Pick<Contact, 'name' | 'email' | 'company' | 'phone' | 'notes'> & { tagsText: string };

const emptyForm: FormState = { name: '', email: '', company: '', phone: '', notes: '', tagsText: '' };

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CT';
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [userEmail, setUserEmail] = useState('');

  async function loadContacts(search = '') {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/contacts${search ? `?q=${encodeURIComponent(search)}` : ''}`, { cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!response.ok) throw new Error(data.error ?? 'Unable to load contacts.');
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (loadError) {
      console.error(loadError);
      setError('Unable to load contacts right now.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void getSupabaseBrowser().auth.getUser().then(({ data }) => {
      const email = data.user?.email?.toLowerCase() ?? '';
      if (!email) window.location.href = '/login';
      else setUserEmail(email);
    });
    void loadContacts();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadContacts(query.trim()); }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const visibleContacts = useMemo(() => {
    if (query.trim()) return contacts;
    return contacts;
  }, [contacts, query]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setStatus('');
    setError('');
    setComposerOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setForm({ name: contact.name, email: contact.email, company: contact.company ?? '', phone: contact.phone ?? '', notes: contact.notes ?? '', tagsText: contact.tags.join(', ') });
    setStatus('');
    setError('');
    setComposerOpen(true);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const tags = form.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean);
      const payload = { name: form.name, email: form.email, company: form.company, phone: form.phone, notes: form.notes, tags };
      const response = await fetch('/api/contacts', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save contact.');
      setStatus(editing ? 'Contact updated' : 'Contact saved');
      setComposerOpen(false);
      await loadContacts(query.trim());
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Unable to save contact.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(contact: Contact) {
    if (!window.confirm(`Delete ${contact.name}?`)) return;
    setError('');
    try {
      const response = await fetch(`/api/contacts?id=${encodeURIComponent(contact.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to delete contact.');
      setContacts((current) => current.filter((item) => item.id !== contact.id));
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete contact.');
    }
  }

  function composeTo(email: string) {
    window.location.href = `/?compose=1&to=${encodeURIComponent(email)}`;
  }

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main className={`contacts-app ${mobileNavOpen ? 'nav-open' : ''}`}>
      <div className="contacts-backdrop" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
      <aside className="sidebar contacts-sidebar" aria-label="Mailbox navigation">
        <div className="sidebar-top">
          <div className="brand"><div className="brand-mark">AB</div><div><strong>ABEmail</strong><span>Business Mail</span></div></div>
          <button className="icon-button mobile-close" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <a className="compose primary-action" href="/?compose=1"><PenLine size={17} /><span>Compose</span></a>
        <nav className="folder-nav" aria-label="Mail folders">
          <div className="nav-section-label">Mailbox</div>
          <a className="nav-item nav-subitem" href="/?view=primary"><Mail size={16} /><span>Primary</span></a>
          <a className="nav-item nav-subitem" href="/?view=my-sent"><Mail size={16} /><span>Sent</span></a>
          <a className="nav-item nav-subitem" href="/?view=drafts"><Mail size={16} /><span>Drafts</span></a>
          <a className="nav-item nav-subitem" href="/?view=spam"><Mail size={16} /><span>Spam</span></a>
          <a className="nav-item nav-subitem" href="/?view=scheduled"><Mail size={16} /><span>Scheduled</span></a>
          <div className="nav-section-label">Business</div>
          <a className="nav-item nav-subitem active" href="/contacts"><BookUser size={16} /><span>Contacts</span></a>
        </nav>
        <div className="sidebar-bottom">
          <a className="nav-item" href="/settings"><Settings size={17} /><span>Settings</span></a>
          <button className="account-card" type="button" onClick={logout} title="Sign out"><div className="avatar">{initials(userEmail || 'AB')}</div><div className="account-copy"><strong>{userEmail || 'ABEmail'}</strong><span>Sign out</span></div></button>
        </div>
      </aside>

      <section className="mail-panel contacts-panel">
        <header className="topbar contacts-topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div><p className="eyebrow">Business</p><h1>Contacts</h1><span className="view-description">Your private address book for faster, more personal email.</span></div>
          </div>
          <button className="send-button contacts-add" type="button" onClick={openCreate}><Plus size={15} /> Add contact</button>
        </header>

        <div className="contacts-content">
          <div className="contacts-toolbar">
            <label className="search contacts-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, company or phone" aria-label="Search contacts" /></label>
            <span className="contacts-count">{loading ? 'Loading…' : `${visibleContacts.length} ${visibleContacts.length === 1 ? 'contact' : 'contacts'}`}</span>
          </div>

          {error && <div className="contacts-alert" role="alert">{error}</div>}
          {status && <div className="contacts-success" role="status"><Check size={15} />{status}</div>}

          {loading ? (
            <div className="contacts-empty"><div className="contact-skeleton" /><div className="contact-skeleton" /><div className="contact-skeleton" /></div>
          ) : visibleContacts.length === 0 ? (
            <div className="contacts-empty"><div className="contacts-empty-icon"><BookUser size={25} /></div><strong>{query ? 'No contacts found' : 'Your address book is empty'}</strong><span>{query ? 'Try another name, email, company or phone number.' : 'Save the people and businesses you email most often.'}</span><button className="ghost-action" type="button" onClick={openCreate}><Plus size={15} /> Add your first contact</button></div>
          ) : (
            <div className="contacts-grid">
              {visibleContacts.map((contact) => (
                <article className="contact-card" key={contact.id}>
                  <div className="contact-card-head"><div className="contact-avatar">{initials(contact.name)}</div><div className="contact-primary"><strong>{contact.name}</strong><span>{contact.company || contact.email}</span></div><button className="icon-button" type="button" onClick={() => deleteContact(contact)} aria-label={`Delete ${contact.name}`}><Trash2 size={16} /></button></div>
                  <div className="contact-details"><button type="button" className="contact-email" onClick={() => composeTo(contact.email)}>{contact.email}</button>{contact.phone && <span>{contact.phone}</span>}{contact.notes && <p>{contact.notes}</p>}</div>
                  {contact.tags.length > 0 && <div className="contact-tags">{contact.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
                  <div className="contact-actions"><button type="button" className="ghost-action" onClick={() => openEdit(contact)}>Edit</button><button type="button" className="send-button contact-compose" onClick={() => composeTo(contact.email)}><PenLine size={14} /> Compose</button></div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {composerOpen && <div className="contact-modal-backdrop" role="presentation"><div className="contact-modal" role="dialog" aria-modal="true" aria-label={editing ? 'Edit contact' : 'Add contact'}>
        <div className="contact-modal-head"><div><p className="eyebrow">Address book</p><h2>{editing ? 'Edit contact' : 'Add contact'}</h2></div><button className="icon-button" type="button" onClick={() => setComposerOpen(false)} disabled={saving} aria-label="Close"><X size={18} /></button></div>
        <form onSubmit={saveContact} className="contact-form">
          <label>Name<input value={form.name} onChange={(event) => updateForm('name', event.target.value)} maxLength={120} required /></label>
          <label>Email<input value={form.email} onChange={(event) => updateForm('email', event.target.value)} maxLength={254} type="email" required /></label>
          <div className="contact-form-row"><label>Company<input value={form.company ?? ''} onChange={(event) => updateForm('company', event.target.value)} maxLength={160} /></label><label>Phone<input value={form.phone ?? ''} onChange={(event) => updateForm('phone', event.target.value)} maxLength={40} /></label></div>
          <label>Tags<input value={form.tagsText} onChange={(event) => updateForm('tagsText', event.target.value)} placeholder="Client, Supplier, Finance" /></label>
          <label>Notes<textarea value={form.notes ?? ''} onChange={(event) => updateForm('notes', event.target.value)} maxLength={2000} rows={4} /></label>
          {error && <div className="contacts-alert" role="alert">{error}</div>}
          <div className="contact-form-actions"><button className="ghost-action" type="button" onClick={() => setComposerOpen(false)} disabled={saving}>Cancel</button><button className="send-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save contact'}</button></div>
        </form>
      </div></div>}
    </main>
  );
}
