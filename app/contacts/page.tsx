'use client';

import { useEffect, useState } from 'react';
import { BookUser, Plus, Search, Trash2, PenLine } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  notes?: string;
  tags?: string[];
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadContacts() {
    try {
      const res = await fetch('/api/contacts', { cache: 'no-store' });
      const data = await res.json();
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
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

  const filtered = contacts.filter((c) =>
    `${c.name} ${c.email} ${c.company ?? ''}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="contacts-app">
      <section className="mail-panel contacts-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Business</p>
            <h1>Contacts</h1>
            <span>Your private address book for faster email.</span>
          </div>
          <a className="send-button" href="/?compose=1">
            <PenLine size={15} /> Compose
          </a>
        </header>

        <div className="contacts-content">
          <div className="contacts-toolbar">
            <label className="search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts"
              />
            </label>
            <a className="send-button" href="/contacts?new=1">
              <Plus size={15} /> Add contact
            </a>
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
                  <div className="contact-actions">
                    <a className="send-button" href={`/?compose=1&to=${encodeURIComponent(contact.email)}`}>
                      <PenLine size={14} /> Compose
                    </a>
                    <button onClick={() => deleteContact(contact.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
