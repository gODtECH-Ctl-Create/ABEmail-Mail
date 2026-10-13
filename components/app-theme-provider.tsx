'use client';

import type { ReactNode } from 'react';
import {
  ActiveThemeProvider,
  type ThemeId,
} from '@abe-techlab/abe-techlab-design-system/react';

export default function AppThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemeId;
  children: ReactNode;
}) {
  return (
    <ActiveThemeProvider initialTheme={initialTheme} storage="cookie" cookieName="active_theme">
      {children}
    </ActiveThemeProvider>
  );
}
