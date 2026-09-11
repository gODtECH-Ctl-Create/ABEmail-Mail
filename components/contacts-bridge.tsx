'use client';

import { useEffect } from 'react';

type Contact = { id: string; name: string; email: string; company?: string | null };

const CONTACTS_LIST_ID = 'abemail-contact-autocomplete';
const COMPOSE_HANDOFF_KEY = 'abemail-compose-handoff';

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

    function installComposeHandoff() {
      if (window.location.pathname !== '/') return;
      const params = new URLSearchParams(window.location.search);
      if (params.get('compose') !== '1') return;
      const to = params.get('to') ?? '';
      if (sessionStorage.getItem(COMPOSE_HANDOFF_KEY) === window.location.search) return;
      const composeButton = document.querySelector<HTMLButtonElement>('.compose.primary-action');
      if (!composeButton) return;
      sessionStorage.setItem(COMPOSE_HANDOFF_KEY, window.location.search);
      composeButton.click();
      window.setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('input[name="to"]');
        if (!input || !to) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, to);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, 50);
    }

    function scan() {
      installComposeHandoff();
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
