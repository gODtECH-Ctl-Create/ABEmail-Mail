'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, Moon, Palette, Sun, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import styles from './theme-announcement.module.css';

type AnnouncementStep = 1 | 2;

const PENDING_LOCAL_KEY = 'abemail_theme_discovery_pending_v1:';
const SEEN_LOCAL_KEY = 'abemail_theme_discovery_seen_v1:';

function parseStep(value: unknown): AnnouncementStep | null {
  const number = Number(value);
  return number === 1 || number === 2 ? number : null;
}

export default function ThemeAnnouncement() {
  const pathname = usePathname();
  const [step, setStep] = useState<AnnouncementStep | null>(null);

  useEffect(() => {
    if (pathname === '/login' || pathname === '/design-preview' || pathname.startsWith('/design-preview/')) {
      setStep(null);
      return;
    }

    let cancelled = false;

    async function loadAnnouncement() {
      try {
        const supabase = getSupabaseBrowser();
        const { data, error } = await supabase.auth.getUser();
        const user = data.user;

        if (cancelled || error || !user) return;

        const userId = user.id;
        const metadataPending = parseStep(user.user_metadata?.abemail_theme_discovery_pending_v1);
        let localPending: AnnouncementStep | null = null;

        try {
          localPending = parseStep(window.localStorage.getItem(PENDING_LOCAL_KEY + userId));
        } catch {
          // Server-side user metadata remains the primary source if browser storage is blocked.
        }

        const pendingStep = localPending ?? metadataPending;
        if (!pendingStep) return;

        const seenKey = SEEN_LOCAL_KEY + userId + ':' + pendingStep;

        try {
          if (window.localStorage.getItem(seenKey) === '1') {
            window.localStorage.removeItem(PENDING_LOCAL_KEY + userId);
            if (metadataPending) {
              void supabase.auth.updateUser({ data: { abemail_theme_discovery_pending_v1: null } });
            }
            return;
          }

          window.localStorage.setItem(seenKey, '1');
          window.localStorage.removeItem(PENDING_LOCAL_KEY + userId);
        } catch {
          // Continue to show the announcement even when local storage is unavailable.
        }

        if (metadataPending) {
          const { error: clearError } = await supabase.auth.updateUser({
            data: { abemail_theme_discovery_pending_v1: null },
          });
          if (clearError) {
            console.warn('Theme announcement state could not be cleared from user metadata.');
          }
        }

        if (!cancelled) setStep(pendingStep);
      } catch (loadError) {
        console.error('Unable to load the theme announcement.', loadError);
      }
    }

    void loadAnnouncement();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!step) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setStep(null);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [step]);

  if (!step) return null;

  const firstAnnouncement = step === 1;

  function openAppearanceSettings() {
    setStep(null);
    window.location.href = '/settings';
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setStep(null);
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-announcement-title"
        aria-describedby="theme-announcement-description"
      >
        <button
          className={styles.closeButton}
          type="button"
          onClick={() => setStep(null)}
          aria-label="Dismiss theme announcement"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className={styles.artwork} aria-hidden="true">
          {firstAnnouncement ? (
            <>
              <div className={styles.themeTile}>
                <Sun size={23} />
                <span>Light</span>
              </div>
              <div className={styles.themeDivider} />
              <div className={styles.themeTileDark}>
                <Moon size={23} />
                <span>Dark</span>
              </div>
            </>
          ) : (
            <div className={styles.paletteArtwork}>
              <span className={styles.paletteDotOne} />
              <span className={styles.paletteDotTwo} />
              <span className={styles.paletteDotThree} />
              <span className={styles.paletteDotFour} />
              <Palette size={28} />
            </div>
          )}
        </div>

        <p className={styles.eyebrow}>
          {firstAnnouncement ? 'A NEW WAY TO WORK' : 'MAKE IT YOURS'}
        </p>
        <h2 id="theme-announcement-title">
          {firstAnnouncement ? 'Choose your look' : 'Make ABEmail feel like yours'}
        </h2>
        <p className={styles.description} id="theme-announcement-description">
          {firstAnnouncement
            ? 'You can now switch ABEmail between Light and Dark mode. Your choice is saved for your next visit.'
            : 'Pick a theme palette that suits your workspace, then switch between Light and Dark mode whenever you like.'}
        </p>
        <p className={styles.hint}>
          Find the controls in <strong>Settings → Appearance</strong>.
        </p>

        <button className={styles.primaryButton} type="button" onClick={openAppearanceSettings} autoFocus>
          {firstAnnouncement ? 'Explore appearance settings' : 'Customize my theme'}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button className={styles.secondaryButton} type="button" onClick={() => setStep(null)}>
          Maybe later
        </button>
        <p className={styles.footnote}>This is a one-time introduction, not a recurring notification.</p>
      </section>
    </div>
  );
}
