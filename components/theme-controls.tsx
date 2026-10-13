'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { ThemeSelector } from '@abe-techlab/abe-techlab-design-system/react';
import styles from './theme-controls.module.css';

type ThemeControlsProps = {
  variant?: 'preview' | 'settings';
};

export default function ThemeControls({ variant = 'settings' }: ThemeControlsProps) {
  const [darkMode, setDarkMode] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('active_color_mode');
      setDarkMode(saved === null
        ? document.documentElement.classList.contains('dark')
        : saved === 'dark');
    } catch {
      setDarkMode(document.documentElement.classList.contains('dark'));
    }
  }, []);

  useEffect(() => {
    if (darkMode === null) return;

    const root = document.documentElement;
    root.classList.toggle('dark', darkMode);

    try {
      const mode = darkMode ? 'dark' : 'light';
      window.localStorage.setItem('active_color_mode', mode);
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `active_color_mode=${mode}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    } catch {
      // Switching appearance still works even when browser storage is disabled.
    }
  }, [darkMode]);

  const toggleLabel = darkMode ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <div className={`${styles.controls} ${variant === 'preview' ? styles.preview : styles.settings}`}>
      <ThemeSelector
        label="Theme palette"
        labelClassName={styles.themeLabel}
        selectClassName={styles.themeSelect}
        aria-label="Choose a design-system theme palette"
      />
      <button
        className={styles.modeButton}
        type="button"
        onClick={() => setDarkMode((current) => current === null ? false : !current)}
        disabled={darkMode === null}
        aria-label={toggleLabel}
        aria-pressed={darkMode === true}
        title={toggleLabel}
      >
        {darkMode ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        <span>{darkMode ? 'Dark mode' : 'Light mode'}</span>
        <span className={styles.modeHint}>{darkMode ? 'Switch to light' : 'Switch to dark'}</span>
      </button>
    </div>
  );
}
