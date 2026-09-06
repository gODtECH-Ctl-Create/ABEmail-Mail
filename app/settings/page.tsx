'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Check, CircleUserRound, CreditCard, Mail, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import styles from './settings.module.css';

type BillingCycle = 'monthly' | 'yearly';
type SubscriptionStatus = 'setup' | 'active' | 'past_due' | 'cancelled' | 'suspended';

type NotificationPreferences = {
  email_notifications: boolean;
  browser_notifications: boolean;
};

type Subscription = {
  plan_name: string;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  currency: string;
  monthly_price: number | null;
  yearly_price: number | null;
  starts_at: string | null;
  renews_at: string | null;
};

const MAILBOXES = [
  'info@waste2light.com',
  'support@waste2light.com',
  'admin@waste2light.com',
  'emmanuel.abah@waste2light.com',
];

const DEFAULT_SUBSCRIPTION: Subscription = {
  plan_name: 'ABEmail Business',
  billing_cycle: 'monthly',
  status: 'setup',
  currency: 'NGN',
  monthly_price: null,
  yearly_price: null,
  starts_at: null,
  renews_at: null,
};

const numberFormatter = new Intl.NumberFormat('en-NG');

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email_notifications: true,
    browser_notifications: false,
  });
  const [subscription, setSubscription] = useState<Subscription>(DEFAULT_SUBSCRIPTION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const isAdmin = email === 'admin@waste2light.com';

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const supabase = getSupabaseBrowser();
        const { data: userData, error: userError } = await supabase.auth.getUser();
        const authenticatedEmail = userData.user?.email?.toLowerCase();

        if (userError || !authenticatedEmail || !userData.user) {
          window.location.href = '/login';
          return;
        }

        const user = userData.user;
        setEmail(authenticatedEmail);
        setUserId(user.id);

        const [{ data: preferences }, { data: billing, error: billingError }] = await Promise.all([
          supabase
            .from('notification_preferences')
            .select('email_notifications,browser_notifications')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('billing_subscriptions')
            .select('plan_name,billing_cycle,status,currency,monthly_price,yearly_price,starts_at,renews_at')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        if (!mounted) return;

        if (preferences) {
          setNotifications(preferences);
        } else {
          const { error: preferenceInsertError } = await supabase
            .from('notification_preferences')
            .insert({ user_id: user.id });
          if (!preferenceInsertError) {
            setNotifications({ email_notifications: true, browser_notifications: false });
          }
        }

        if (billing) {
          setSubscription(billing as Subscription);
        }

        if (billingError) {
          setError('Subscription details could not be loaded.');
        }
      } catch (loadError) {
        console.error('settings load error', loadError);
        if (mounted) setError('Some settings could not be loaded.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  function saveNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  }

  async function updateNotifications(next: NotificationPreferences) {
    if (!userId) return;
    setSaving(true);
    setError('');

    const { error: updateError } = await getSupabaseBrowser()
      .from('notification_preferences')
      .upsert(
        { user_id: userId, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

    if (updateError) {
      console.error('notification preference error', updateError);
      setError('Unable to save notification preferences.');
      setSaving(false);
      return;
    }

    setNotifications(next);
    saveNotice('Notification preferences saved');
    setSaving(false);
  }

  async function setEmailNotifications(enabled: boolean) {
    await updateNotifications({ ...notifications, email_notifications: enabled });
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

    await updateNotifications({ ...notifications, browser_notifications: enabled });
  }

  async function chooseBillingCycle(cycle: BillingCycle) {
    if (!isAdmin || saving) return;
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/settings/billing', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ billing_cycle: cycle }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to update billing.');
      }

      setSubscription((current) => ({ ...current, billing_cycle: cycle }));
      saveNotice(`${cycle === 'yearly' ? 'Yearly' : 'Monthly'} billing selected`);
    } catch (billingError) {
      console.error('billing update error', billingError);
      setError('Unable to save the billing cycle.');
    } finally {
      setSaving(false);
    }
  }

  const activePrice = subscription.billing_cycle === 'yearly'
    ? subscription.yearly_price
    : subscription.monthly_price;

  const statusLabel = subscription.status === 'past_due'
    ? 'Past due'
    : subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1);

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

        {error && (
          <div className={styles.errorNotice} role="alert">
            {error}
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
              <strong>{loading ? 'Loading account…' : email}</strong>
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
              <p>These preferences are saved to your ABEmail account.</p>
            </div>
          </div>
          <ToggleRow
            title="Email alerts"
            description="Receive important account and mailbox alerts by email."
            checked={notifications.email_notifications}
            disabled={saving || loading}
            onChange={setEmailNotifications}
          />
          <ToggleRow
            title="Browser notifications"
            description="Allow ABEmail to show notifications on this device."
            checked={notifications.browser_notifications}
            disabled={saving || loading}
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
              <strong className={styles.planName}>{subscription.plan_name}</strong>
            </div>
            <span className={styles.setupPill}>{statusLabel}</span>
          </div>

          <div className={styles.cycleGrid}>
            {(['monthly', 'yearly'] as BillingCycle[]).map((cycle) => {
              const selected = subscription.billing_cycle === cycle;
              const price = cycle === 'yearly' ? subscription.yearly_price : subscription.monthly_price;
              return (
                <button
                  key={cycle}
                  className={`${styles.cycleCard} ${selected ? styles.selected : ''}`}
                  type="button"
                  disabled={!isAdmin || saving || loading}
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
              <strong>{subscription.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'}</strong>
            </div>
            <div>
              <span>Current amount</span>
              <strong>{activePrice == null ? 'Not configured' : `₦${numberFormatter.format(activePrice)}`}</strong>
            </div>
            <div>
              <span>Renewal</span>
              <strong>{subscription.renews_at ? formatDate(subscription.renews_at) : 'Not scheduled'}</strong>
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

function ToggleRow({ title, description, checked, disabled, onChange }: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
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
        disabled={disabled}
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
