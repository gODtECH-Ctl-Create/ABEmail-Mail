'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Check, CircleUserRound, CreditCard, Mail, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import styles from './settings.module.css';

type BillingCycle = 'monthly' | 'yearly';

const MAILBOXES = [
  'info@waste2light.com',
  'support@waste2light.com',
  'admin@waste2light.com',
  'emmanuel.abah@waste2light.com',
];

const BILLING = {
  plan: 'ABEmail Business',
  currency: 'NGN',
  monthly: null as number | null,
  yearly: null as number | null,
};

const numberFormatter = new Intl.NumberFormat('en-NG');

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [notifications, setNotifications] = useState(() => {
    if (typeof window === 'undefined') return { email: true, browser: false };
    return {
      email: localStorage.getItem('abemail-email-notifications') !== 'false',
      browser: localStorage.getItem('abemail-browser-notifications') === 'true',
    };
  });
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(() => {
    if (typeof window === 'undefined') return 'monthly';
    return localStorage.getItem('abemail-billing-cycle') === 'yearly' ? 'yearly' : 'monthly';
  });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    getSupabaseBrowser().auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user?.email) {
        window.location.href = '/login';
        return;
      }
      setEmail(data.user.email.toLowerCase());
    });
    return () => {
      mounted = false;
    };
  }, []);

  function saveNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  }

  function setEmailNotifications(enabled: boolean) {
    setNotifications((current) => ({ ...current, email: enabled }));
    localStorage.setItem('abemail-email-notifications', String(enabled));
    saveNotice(enabled ? 'Email alerts enabled' : 'Email alerts disabled');
  }

  async function setBrowserNotifications(enabled: boolean) {
    if (enabled) {
      if (!('Notification' in window)) {
        saveNotice('Browser notifications are not supported here');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        saveNotice('Notification permission was not granted');
        return;
      }
    }

    setNotifications((current) => ({ ...current, browser: enabled }));
    localStorage.setItem('abemail-browser-notifications', String(enabled));
    saveNotice(enabled ? 'Browser notifications enabled' : 'Browser notifications disabled');
  }

  function chooseBillingCycle(cycle: BillingCycle) {
    if (email !== 'admin@waste2light.com') {
      saveNotice('Only the admin mailbox can change billing');
      return;
    }
    setBillingCycle(cycle);
    localStorage.setItem('abemail-billing-cycle', cycle);
    saveNotice(`${cycle === 'yearly' ? 'Yearly' : 'Monthly'} billing selected`);
  }

  const activePrice = billingCycle === 'yearly' ? BILLING.yearly : BILLING.monthly;
  const isAdmin = email === 'admin@waste2light.com';

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button className={styles.backButton} type="button" onClick={() => (window.location.href = '/')} aria-label="Back to inbox">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className={styles.eyebrow}>ABEmail</p>
            <h1>Settings</h1>
            <p className={styles.subtitle}>Manage your Waste2Light mail experience.</p>
          </div>
        </header>

        {notice && (
          <div className={styles.notice} role="status">
            <Check size={15} /> {notice}
          </div>
        )}

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}><CircleUserRound size={18} /></div>
            <div>
              <h2>Account</h2>
              <p>Your current ABEmail mailbox account.</p>
            </div>
          </div>
          <div className={styles.accountRow}>
            <div className={styles.avatar}>{initials(email || 'AB')}</div>
            <div className={styles.accountText}>
              <strong>{email || 'Loading account…'}</strong>
              <span>Waste2Light mailbox</span>
            </div>
            <span className={styles.statusPill}>Active</span>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}><Bell size={18} /></div>
            <div>
              <h2>Notifications</h2>
              <p>Choose how ABEmail should alert you.</p>
            </div>
          </div>
          <ToggleRow
            title="Email alerts"
            description="Receive important account and mailbox alerts by email."
            checked={notifications.email}
            onChange={setEmailNotifications}
          />
          <ToggleRow
            title="Browser notifications"
            description="Show a device notification when ABEmail triggers a browser alert."
            checked={notifications.browser}
            onChange={setBrowserNotifications}
          />
          <div className={styles.infoBox}>
            <span>Note</span>
            <p>Browser permission is enabled here. Background push delivery will be connected when ABEmail’s Web Push service is added.</p>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}><Mail size={18} /></div>
            <div>
              <h2>Mailboxes</h2>
              <p>Mailboxes currently provisioned for Waste2Light.</p>
            </div>
          </div>
          <div className={styles.mailboxGrid}>
            {MAILBOXES.map((mailbox) => (
              <div key={mailbox} className={styles.mailboxItem}>
                <span>{mailbox.split('@')[0]}</span>
                <small>@waste2light.com</small>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}><CreditCard size={18} /></div>
            <div>
              <h2>Subscription</h2>
              <p>Your ABEmail Business subscription for Waste2Light.</p>
            </div>
          </div>

          <div className={styles.subscriptionTop}>
            <div>
              <span className={styles.label}>Plan</span>
              <strong className={styles.planName}>{BILLING.plan}</strong>
            </div>
            <span className={styles.setupPill}>Billing setup</span>
          </div>

          <div className={styles.cycleGrid}>
            {(['monthly', 'yearly'] as BillingCycle[]).map((cycle) => {
              const selected = billingCycle === cycle;
              const price = cycle === 'yearly' ? BILLING.yearly : BILLING.monthly;
              return (
                <button
                  key={cycle}
                  className={`${styles.cycleCard} ${selected ? styles.selected : ''}`}
                  type="button"
                  disabled={!isAdmin}
                  aria-pressed={selected}
                  onClick={() => chooseBillingCycle(cycle)}
                >
                  <div>
                    <strong>{cycle === 'yearly' ? 'Yearly' : 'Monthly'}</strong>
                    <span>{cycle === 'yearly' ? 'Discounted annual billing' : 'Flexible monthly billing'}</span>
                  </div>
                  <div className={styles.price}>
                    {price == null ? 'Price to be set' : `₦${numberFormatter.format(price)}`}
                    {price != null && <small>{cycle === 'yearly' ? '/ year' : '/ month'}</small>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className={styles.billingSummary}>
            <div>
              <span>Selected cycle</span>
              <strong>{billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}</strong>
            </div>
            <div>
              <span>Current amount</span>
              <strong>{activePrice == null ? 'Not configured' : `₦${numberFormatter.format(activePrice)}`}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>Setup</strong>
            </div>
          </div>

          <div className={styles.infoBox}>
            <span><ShieldCheck size={15} /> Billing control</span>
            <p>{isAdmin ? 'You are the Waste2Light billing administrator. Payment collection will be connected after the final price and payment provider are selected.' : 'Subscription details are visible to mailbox users. Billing-cycle changes are reserved for the admin mailbox.'}</p>
          </div>
        </section>

        <footer className={styles.footer}>ABEmail · Waste2Light · Business Mail</footer>
      </div>
    </main>
  );
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className={styles.toggleRow}>
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <button
        className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

function initials(value: string) {
  const clean = value.includes('@') ? value.split('@')[0] : value;
  return clean
    .split(/[._\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AB';
}
