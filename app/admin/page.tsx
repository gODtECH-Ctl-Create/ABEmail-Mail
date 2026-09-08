'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, ArrowUpRight, Bell, Database, Mail, ShieldCheck, Users, WalletCards, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './admin.module.css';

type Overview = {
  adminEmail: string;
  generatedAt: string;
  health: { app: string; database: string; adminAccess: string; monitoringStore: string };
  mailboxes: Array<{ address: string; display_name: string | null; active: boolean }>;
  metrics: { inbound: number; outbound: number; nonSentOutbound: number; browserNotificationUsers: number; newAlerts: number };
  billing: { plan_name: string; billing_cycle: string; status: string } | null;
  incidents: Array<{ id: string; incident_key: string; title: string; severity: string; status: string; component: string | null; last_seen_at: string }>;
  reports: Array<{ id: string; report_key: string; mailbox: string | null; action: string | null; status: string; description: string | null; created_at: string; incident_id: string | null }>;
  alerts: Array<{ id: string; alert_key: string; incident_id: string | null; severity: string; title: string; message: string; status: string; created_at: string }>;
};

function HealthPill({ label, state }: { label: string; state: string }) {
  const healthy = state === 'operational' || state === 'connected' || state === 'configured';
  return <span className={`${styles.healthPill} ${healthy ? styles.healthy : styles.attention}`}><span />{label}: {state.replaceAll('_', ' ')}</span>;
}

function formatTime(value: string) {
  try { return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return value; }
}

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(0);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/overview', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!active) return;
        setStatus(response.status);
        if (!response.ok) { setError(payload.error ?? 'Unable to load admin overview.'); return; }
        setData(payload);
      })
      .catch(() => { if (active) { setStatus(500); setError('Unable to reach the admin service.'); } });
    return () => { active = false; };
  }, []);

  if (!data) {
    return (
      <main className={styles.gate}>
        <div className={styles.gateCard}>
          <div className={styles.brandMark}>AB</div>
          <p className={styles.eyebrow}>ABE Tech Lab Operations</p>
          {status === 0 ? <><h1>Loading operations console</h1><p>Checking your admin access…</p></> : <><h1>{status === 401 ? 'Admin sign-in required' : 'Admin access required'}</h1><p>{error}</p><Link href="/login?next=%2Fadmin" className={styles.primaryButton}>Go to sign in</Link></>}
        </div>
      </main>
    );
  }

  const activeIncidents = data.incidents.filter((incident) => !['resolved', 'closed'].includes(incident.status));
  const openReports = data.reports.filter((report) => !['resolved', 'closed'].includes(report.status));
  const newAlerts = data.alerts.filter((alert) => alert.status === 'new');

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>ABE Tech Lab Operations</p><h1>Waste2Light ABEmail</h1><p className={styles.muted}>System health, incidents and service operations.</p></div>
        <div className={styles.headerMeta}><span>{data.adminEmail}</span><span>Updated {formatTime(data.generatedAt)}</span></div>
      </header>

      <section className={styles.healthRow}><HealthPill label="App" state={data.health.app} /><HealthPill label="Database" state={data.health.database} /><HealthPill label="Admin" state={data.health.adminAccess} /><HealthPill label="Monitoring store" state={data.health.monitoringStore} /></section>

      <nav aria-label="Operations sections" className={styles.healthRow} style={{ marginTop: 14 }}>
        <Link href="/admin/monitoring" className={styles.primaryButton}>Monitoring</Link>
        <Link href="/admin/security" className={styles.primaryButton}>Security</Link>
        <Link href="/admin/capacity" className={styles.primaryButton}>Capacity & Usage</Link>
        <Link href="/admin/incidents" className={styles.primaryButton}>Incidents</Link>
        <Link href="/admin/mailboxes" className={styles.primaryButton}>Mailboxes</Link>
        <Link href="/admin/users" className={styles.primaryButton}>Users</Link>
        <Link href="/admin/subscription" className={styles.primaryButton}>Subscription</Link>
        <Link href="/admin/audit" className={styles.secondaryButton}>Audit log</Link>
      </nav>

      <section className={styles.metricGrid}>
        <div className={styles.metricCard}><Mail size={18} /><span>Inbound mail</span><strong>{data.metrics.inbound}</strong><small>Total received records</small></div>
        <div className={styles.metricCard}><ArrowUpRight size={18} /><span>Outbound mail</span><strong>{data.metrics.outbound}</strong><small>Total sent records</small></div>
        <div className={styles.metricCard}><AlertTriangle size={18} /><span>Non-sent outbound</span><strong>{data.metrics.nonSentOutbound}</strong><small>Needs investigation</small></div>
        <div className={styles.metricCard}><Bell size={18} /><span>New alerts</span><strong>{data.metrics.newAlerts}</strong><small>Automatic operations alerts</small></div>
      </section>

      <section className={styles.twoCol}>
        <div className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Alerts</p><h2>Automatic alerts</h2></div><span className={styles.counter}>{newAlerts.length} new</span></div>{newAlerts.length === 0 ? <div className={styles.empty}><ShieldCheck size={22} /><strong>No new alerts</strong><span>Automatic incident alerts will appear here when thresholds are crossed.</span></div> : newAlerts.map((alert) => <div className={styles.listRow} key={alert.id}><div><strong>{alert.title}</strong><span>{alert.message} · {formatTime(alert.created_at)}</span></div><b className={alert.severity === 'P1' ? styles.danger : styles.badge}>{alert.severity}</b></div>)}</div>
        <div className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Incidents</p><h2>Operational incidents</h2></div><span className={styles.counter}>{activeIncidents.length} open</span></div>{activeIncidents.length === 0 ? <div className={styles.empty}><ShieldCheck size={22} /><strong>No active incidents</strong><span>The monitoring store is ready for automatic incident detection.</span></div> : activeIncidents.map((incident) => <div className={styles.listRow} key={incident.id}><div><strong>{incident.title}</strong><span>{incident.incident_key} · {incident.component ?? 'system'} · {formatTime(incident.last_seen_at)}</span></div><b className={incident.severity === 'P1' ? styles.danger : styles.badge}>{incident.severity}</b></div>)}</div>
      </section>

      <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>User reports</p><h2>Reported problems</h2></div><span className={styles.counter}>{openReports.length} open</span></div>{openReports.length === 0 ? <div className={styles.empty}><Activity size={22} /><strong>No outstanding reports</strong><span>User-submitted diagnostics will appear here once reporting is enabled.</span></div> : openReports.map((report) => <div className={styles.listRow} key={report.id}><div><strong>{report.description || report.action || 'Reported problem'}</strong><span>{report.report_key} · {report.mailbox || 'mailbox unknown'} · {formatTime(report.created_at)}</span></div><b className={styles.badge}>{report.status}</b></div>)}</section>

      <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Mailboxes</p><h2>Waste2Light mailboxes</h2></div><span className={styles.counter}>{data.mailboxes.filter((mailbox) => mailbox.active).length} active</span></div><div className={styles.mailboxGrid}>{data.mailboxes.map((mailbox) => <div className={styles.mailboxCard} key={mailbox.address}><div className={styles.mailboxIcon}><Users size={16} /></div><div><strong>{mailbox.display_name || mailbox.address}</strong><span>{mailbox.address}</span></div><b className={mailbox.active ? styles.active : styles.disabled}>{mailbox.active ? 'Active' : 'Inactive'}</b></div>)}</div></section>

      <section className={styles.threeCol}><div className={styles.infoCard}><Database size={18} /><span>Infrastructure</span><strong>Provider-neutral foundation</strong><small>Designed for current Vercel hosting and future Cloudflare runtime migration.</small></div><div className={styles.infoCard}><Wifi size={18} /><span>Email network</span><strong>Resend + DNS monitored</strong><small>Delivery, inbound, MX, SPF, DKIM and DMARC checks feed this console.</small></div><div className={styles.infoCard}><WalletCards size={18} /><span>Subscription</span><strong>{data.billing?.plan_name ?? 'Not configured'}</strong><small>{data.billing ? `${data.billing.billing_cycle} · ${data.billing.status}` : 'Billing record unavailable'}</small></div></section>

      <footer className={styles.footer}>Waste2Light deployment · ABE Tech Lab operations console · Commercial multi-tenant administration stays in the separate ABEmail product.</footer>
    </main>
  );
}
