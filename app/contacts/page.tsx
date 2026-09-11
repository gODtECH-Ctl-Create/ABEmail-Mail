'use client';

import { useEffect, useState } from 'react';
import { BookUser, PenLine, Plus, Search, Trash2 } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  notes?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadContacts() {
    try {
      const response = await fetch('/api/contacts', { cache: 'no-store' });
      const data = await response.json();
      setContacts(data.contacts ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  async function deleteContact(id: string) {
    await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
    loadContacts();
  }

  const filtered = contacts.filter((contact) =>
    `${contact.name} ${contact.email} ${contact.company ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <section className="mail-panel contacts-panel">
      <header className="topbar contacts-topbar">
        <div>
          <p className="eyebrow">Business</p>
          <h1>Contacts</h1>
          <span className="view-description">Manage people and businesses you email regularly.</span>
        </div>
        <button className="send-button">
          <Plus size={15} /> Add contact
        </button>
      </header>

      <div className="contacts-content">
        <div className="contacts-toolbar">
          <label className="search contacts-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts" />
          </label>
          <span>{filtered.length} contacts</span>
        </div>

        {loading ? (
          <p>Loading contacts...</p>
        ) : filtered.length === 0 ? (
          <div className="contacts-empty">
            <BookUser size={30} />
            <strong>No contacts found</strong>
          </div>
        ) : (
          <div className="contacts-grid">
            {filtered.map((contact) => (
              <article className="contact-card" key={contact.id}>
                <strong>{contact.name}</strong>
                <span>{contact.email}</span>
                {contact.company && <span>{contact.company}</span>}
                {contact.phone && <span>{contact.phone}</span>}
                <div className="contact-actions">
                  <a className="send-button" href={`/?compose=1&to=${encodeURIComponent(contact.email)}`}>
                    <PenLine size={14} /> Compose
                  </a>
                  <button className="icon-button" onClick={() => deleteContact(contact.id)} aria-label="Delete contact">
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
