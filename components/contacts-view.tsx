'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BookUser, PenLine, Plus, Search, Trash2, X } from 'lucide-react';

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

type FormState = {
  name: string;
  email: string;
  company: string;
  phone: string;
  notes: string;
  tagsText: string;
};

const emptyForm: FormState = {
  name: '',
  email: '',
  company: '',
  phone: '',
  notes: '',
  tagsText: '',
};

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CT';
}

export default function ContactsView({ onCompose }: { onCompose: (email: string) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const loadContacts = useCallback(async (search = '') => {
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
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadContacts(query.trim());
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [query, loadContacts]);

  function openAddContact() {
    setForm(emptyForm);
    setError('');
    setStatus('');
    setModalOpen(true);
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
      const payload = {
        name: form.name,
        email: form.email,
        company: form.company,
        phone: form.phone,
        notes: form.notes,
        tags: form.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
      };
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save contact.');

      setModalOpen(false);
      setStatus('Contact saved.');
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
    setStatus('');
    try {
      const response = await fetch(`/api/contacts?id=${encodeURIComponent(contact.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to delete contact.');
      setContacts((current) => current.filter((item) => item.id !== contact.id));
      setStatus('Contact deleted.');
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete contact.');
    }
  }

  return (
    <section className="contacts-view" aria-label="Contacts">
      <div className="contacts-view-head">
        <div>
          <p className="eyebrow">Business</p>
          <h2>Contacts</h2>
          <p className="contacts-description">Your private address book for faster, more personal email.</p>
        </div>
        <button className="send-button contacts-add" type="button" onClick={openAddContact}>
          <Plus size={15} /> Add contact
        </button>
      </div>

      <div className="contacts-toolbar">
        <label className="search contacts-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, company or phone"
            aria-label="Search contacts"
          />
        </label>
        <span className="contacts-count">{loading ? 'Loading…' : `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}`}</span>
      </div>

      {error && <div className="contacts-alert" role="alert">{error}</div>}
      {status && <div className="contacts-success" role="status">{status}</div>}

      {loading ? (
        <div className="contacts-grid" aria-busy="true">
          <div className="contact-skeleton" />
          <div className="contact-skeleton" />
          <div className="contact-skeleton" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="contacts-empty">
          <div className="contacts-empty-icon"><BookUser size={25} /></div>
          <strong>{query ? 'No contacts found' : 'Your address book is empty'}</strong>
          <span>{query ? 'Try another name, email, company or phone number.' : 'Save the people and businesses you email most often.'}</span>
          {!query && <button className="ghost-action" type="button" onClick={openAddContact}><Plus size={15} /> Add your first contact</button>}
        </div>
      ) : (
        <div className="contacts-grid">
          {contacts.map((contact) => (
            <article className="contact-card" key={contact.id}>
              <div className="contact-card-head">
                <div className="contact-avatar">{initials(contact.name)}</div>
                <div className="contact-primary">
                  <strong>{contact.name}</strong>
                  <span>{contact.company || contact.email}</span>
                </div>
                <button className="icon-button" type="button" onClick={() => void deleteContact(contact)} aria-label={`Delete ${contact.name}`}>
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="contact-details">
                <button type="button" className="contact-email" onClick={() => onCompose(contact.email)}>
                  {contact.email}
                </button>
                {contact.phone && <span>{contact.phone}</span>}
                {contact.notes && <p>{contact.notes}</p>}
              </div>

              {contact.tags.length > 0 && (
                <div className="contact-tags">
                  {contact.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              )}

              <div className="contact-actions">
                <button type="button" className="send-button contact-compose" onClick={() => onCompose(contact.email)}>
                  <PenLine size={14} /> Compose
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="contact-modal-backdrop" role="presentation">
          <div className="contact-modal" role="dialog" aria-modal="true" aria-label="Add contact">
            <div className="contact-modal-head">
              <div>
                <p className="eyebrow">Address book</p>
                <h3>Add contact</h3>
              </div>
              <button className="icon-button" type="button" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveContact} className="contact-form">
              <label>Name<input value={form.name} onChange={(event) => updateForm('name', event.target.value)} maxLength={120} required /></label>
              <label>Email<input value={form.email} onChange={(event) => updateForm('email', event.target.value)} maxLength={254} type="email" required /></label>
              <div className="contact-form-row">
                <label>Company<input value={form.company} onChange={(event) => updateForm('company', event.target.value)} maxLength={160} /></label>
                <label>Phone<input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} maxLength={40} /></label>
              </div>
              <label>Tags<input value={form.tagsText} onChange={(event) => updateForm('tagsText', event.target.value)} placeholder="Client, Supplier, Finance" /></label>
              <label>Notes<textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} maxLength={2000} rows={4} /></label>
              {error && <div className="contacts-alert" role="alert">{error}</div>}
              <div className="contact-form-actions">
                <button className="ghost-action" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button className="send-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save contact'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
