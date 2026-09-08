'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  CreditCard,
  Gauge,
  LayoutDashboard,
  Mail,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import styles from './admin-layout.module.css';

const items = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/monitoring', label: 'Monitoring', icon: Activity },
  { href: '/admin/security', label: 'Security', icon: ShieldCheck },
  { href: '/admin/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/admin/capacity', label: 'Capacity & Usage', icon: Gauge },
  { href: '/admin/mailboxes', label: 'Mailboxes', icon: Mail },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/subscription', label: 'Subscription', icon: CreditCard },
  { href: '/admin/audit', label: 'Audit Log', icon: ClipboardList },
];

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={styles.mobileMenu}
        type="button"
        aria-label="Open Admin navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>

      {open && <button className={styles.overlay} aria-label="Close Admin navigation" type="button" onClick={() => setOpen(false)} />}

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`} aria-label="Admin navigation">
        <div className={styles.brandRow}>
          <Link href="/admin" className={styles.brand} onClick={() => setOpen(false)}>
            <span className={styles.brandMark}>AB</span>
            <span>
              <strong>ABEmail</strong>
              <small>Operations</small>
            </span>
          </Link>
          <button className={styles.closeButton} type="button" aria-label="Close Admin navigation" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <p className={styles.sectionLabel}>Workspace</p>
        <nav className={styles.nav}>
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.navLink} ${active ? styles.active : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={17} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <span>Waste2Light</span>
          <small>ABE Tech Lab Admin</small>
        </div>
      </aside>
    </>
  );
}
