import type { ReactNode } from 'react';
import AdminNav from './admin-nav';
import styles from './admin-layout.module.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <AdminNav />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
