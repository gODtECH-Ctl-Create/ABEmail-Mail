import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ABEmail Mail',
  description: 'ABEmail business mail workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
