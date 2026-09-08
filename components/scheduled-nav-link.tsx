'use client';

import { useEffect } from 'react';

/**
 * Adds the Scheduled Messages entry to the existing mailbox navigation without
 * changing the mailbox page state model. The main mailbox is a single client
 * surface, so the link remains mounted while the user moves through folders.
 */
export default function ScheduledNavLink() {
  useEffect(() => {
    if (window.location.pathname !== '/') return;

    const nav = document.querySelector('.folder-nav');
    if (!nav || nav.querySelector('[data-scheduled-nav]')) return;

    const link = document.createElement('a');
    link.href = '/scheduled';
    link.dataset.scheduledNav = 'true';
    link.className = 'nav-item nav-subitem';
    link.setAttribute('aria-label', 'Scheduled Messages');

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '◷';
    icon.style.fontSize = '17px';
    icon.style.lineHeight = '1';
    icon.style.width = '16px';
    icon.style.display = 'inline-grid';
    icon.style.placeItems = 'center';

    const label = document.createElement('span');
    label.textContent = 'Scheduled';

    link.append(icon, label);
    nav.appendChild(link);

    return () => {
      link.remove();
    };
  }, []);

  return null;
}
