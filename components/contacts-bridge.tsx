'use client';

import { useEffect } from 'react';

type Contact = { id: string; name: string; email: string; company?: string | null };

const CONTACTS_LIST_ID = 'abemail-contact-autocomplete';
const CONTACTS_NAV_ATTR = 'data-contacts-nav';

function makeContactsIcon() {
  const wrapper = document.createElement('span');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M6.5 16c.8-1.7 2.3-2.5 4.5-2.5s3.7.8 4.5 2.5M15 9h3M15 12h3"></path></svg>';
  return wrapper;
}

export default function ContactsBridge() {
  useEffect(() => {
    let cancelled = false;
    let contactCache: Contact[] | null = null;
    let contactCacheAt = 0;

    async function getContacts() {
      const now = Date.now();
      if (contactCache && now - contactCacheAt < 60_000) return contactCache;
      try {
        const response = await fetch('/api/contacts?limit=200', { cache: 'no-store' });
        if (!response.ok) return [];
        const data = await response.json();
        const contacts = Array.isArray(data.contacts) ? data.contacts : [];
        contactCache = contacts;
        contactCacheAt = now;
        return contacts as Contact[];
      } catch {
        return [];
      }
    }

    function installContactsNav() {
      const nav = document.querySelector<HTMLElement>('.folder-nav');
      if (!nav || nav.querySelector(`[${CONTACTS_NAV_ATTR}]`)) return;
      const link = document.createElement('a');
      link.href = '/contacts';
      link.className = 'nav-item nav-subitem';
      link.setAttribute(CONTACTS_NAV_ATTR, 'true');
      link.setAttribute('aria-label', 'Contacts');
      link.appendChild(makeContactsIcon());
      const label = document.createElement('span');
      label.textContent = 'Contacts';
      link.appendChild(label);
      nav.appendChild(link);
    }

    async function installAutocomplete(input: HTMLInputElement) {
      if (input.dataset.contactsBound === 'true') return;
      input.dataset.contactsBound = 'true';
      input.setAttribute('list', CONTACTS_LIST_ID);

      let datalist = document.getElementById(CONTACTS_LIST_ID) as HTMLDataListElement | null;
      if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = CONTACTS_LIST_ID;
        document.body.appendChild(datalist);
      }

      const contacts = await getContacts();
      if (cancelled || !datalist) return;
      datalist.replaceChildren(...contacts.map((contact) => {
        const option = document.createElement('option');
        option.value = contact.email;
        option.label = [contact.name, contact.company].filter(Boolean).join(' · ');
        return option;
      }));
    }

    function scan() {
      installContactsNav();
      document.querySelectorAll<HTMLInputElement>('input[name="to"]').forEach((input) => {
        void installAutocomplete(input);
      });
    }

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      observer.disconnect();
      document.querySelectorAll(`input[name="to"][data-contacts-bound="true"]`).forEach((input) => {
        delete (input as HTMLInputElement).dataset.contactsBound;
      });
      document.getElementById(CONTACTS_LIST_ID)?.remove();
    };
  }, []);

  return null;
}
