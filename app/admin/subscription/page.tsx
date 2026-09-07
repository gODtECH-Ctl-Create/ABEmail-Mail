'use client';

import Link from 'next/link';
import { ArrowLeft, CalendarClock, RefreshCw, Save, WalletCards } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import styles from '../admin.module.css';

type Subscription = {
  id: string;
  organization_name: string;
  plan_name: string;
  billing_cycle: 'monthly' | 'yearly';
  status: 'setup' | 'active' | 'past_due' | 'cancelled' | 'suspended';
  currency: string;
  monthly_price: number | null;
  yearly_price: number | null;
  starts_at: string | null;
  renews_at: string | null;
  provider: string | null;
};

function toDateInput(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function AdminSubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/subscription', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load subscription.');
      setSubscription(payload.subscription);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load subscription.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscription) return;
    setSaving(true);
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/admin/subscription', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: subscription.id,
          planName: String(form.get('planName') ?? ''),
          billingCycle: String(form.get('billingCycle') ?? ''),
          status: String(form.get('status') ?? ''),
          currency: String(form.get('currency') ?? 'NGN'),
          monthlyPrice: String(form.get('monthlyPrice') ?? ''),
          yearlyPrice: String(form.get('yearlyPrice') ?? ''),
          startsAt: String(form.get('startsAt') ?? '') ? `${String(form.get('startsAt'))}T00:00:00.000Z` : null,
          renewsAt: String(form.get('renewsAt') ?? '') ? `${String(form.get('renewsAt'))}T00:00:00.000Z` : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to save subscription.');
      setSubscription(payload.subscription);
      setMessage('Subscription saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save subscription.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.primaryButton}><ArrowLeft size={14} /> Overview</Link>
          <p className={styles.eyebrow} style={{ marginTop: 18 }}>ABE Tech Lab Operations</p>
          <h1>Subscription</h1>
          <p className={styles.muted}>Manage the Waste2Light commercial record without connecting a payment gateway.</p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
      </header>

      {loading ? <section className={styles.panel}><div className={styles.empty}><RefreshCw size={22} /><strong>Loading subscription</strong><span>Reading the current billing record.</span></div></section> : !subscription ? <section className={styles.panel}><div className={styles.empty}><WalletCards size={22} /><strong>No subscription record</strong><span>The existing billing record has not been initialized.</span></div></section> : (
        <form className={styles.panel} onSubmit={save}>
          <div className={styles.panelHead}>
            <div><p className={styles.eyebrow}>Waste2Light</p><h2>Subscription record</h2></div>
            <span className={subscription.status === 'active' ? styles.active : styles.badge}>{subscription.status}</span>
          </div>

          <div style={{ padding: 18, display: 'grid', gap: 16, maxWidth: 720 }}>
            {message ? <div style={{ color: '#27724b', fontSize: 12 }}>{message}</div> : null}
            {error ? <div style={{ color: '#aa3a32', fontSize: 12 }}>{error}</div> : null}

            <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#646a73' }}>
              Plan name
              <input name="planName" defaultValue={subscription.plan_name} style={{ border: '1px solid #e0e3e7', borderRadius: 10, padding: 11, fontSize: 12 }} required />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#646a73' }}>
                Billing cycle
                <select name="billingCycle" defaultValue={subscription.billing_cycle} style={{ border: '1px solid #e0e3e7', borderRadius: 10, padding: 11, fontSize: 12 }}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#646a73' }}>
                Status
                <select name="status" defaultValue={subscription.status} style={{ border: '1px solid #e0e3e7', borderRadius: 10, padding: 11, fontSize: 12 }}>
                  <option value="setup">Setup</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past due</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#646a73' }}>
                Currency
                <input name="currency" defaultValue={subscription.currency} maxLength={3} style={{ border: '1px solid #e0e3e7', borderRadius: 10, padding: 11, fontSize: 12 }} required />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#646a73' }}>
                Monthly price
                <input name="monthlyPrice" type="number" min="0" step="0.01" defaultValue={subscription.monthly_price ?? ''} style={{ border: '1px solid #e0e3e7', borderRadius: 10, padding: 11, fontSize: 12 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#646a73' }}>
                Yearly price
                <input name="yearlyPrice" type="number" min="0" step="0.01" defaultValue={subscription.yearly_price ?? ''} style={{ border: '1px solid #e0e3e7', borderRadius: 10, padding: 11, fontSize: 12 }} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#646a73' }}>
                <span><CalendarClock size={12} style={{ verticalAlign: -2 }} /> Start date</span>
                <input name="startsAt" type="date" defaultValue={toDateInput(subscription.starts_at)} style={{ border: '1px solid #e0e3e7', borderRadius: 10, padding: 11, fontSize: 12 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 11, color: '#646a73' }}>
                <span><CalendarClock size={12} style={{ verticalAlign: -2 }} /> Renewal date</span>
                <input name="renewsAt" type="date" defaultValue={toDateInput(subscription.renews_at)} style={{ border: '1px solid #e0e3e7', borderRadius: 10, padding: 11, fontSize: 12 }} />
              </label>
            </div>

            <div style={{ padding: 12, borderRadius: 10, background: '#f7f8fa', color: '#737983', fontSize: 11, lineHeight: 1.5 }}>
              Payment provider: {subscription.provider || 'Not connected'}. This record is for ABE Tech Lab operations and can later be linked to Paystack without redesigning the subscription model.
            </div>

            <button className={styles.primaryButton} type="submit" disabled={saving}><Save size={14} /> {saving ? 'Saving…' : 'Save subscription'}</button>
          </div>
        </form>
      )}

      <footer className={styles.footer}>No payment provider is connected here. Payments can remain external until the Waste2Light billing workflow is finalized.</footer>
    </main>
  );
}
