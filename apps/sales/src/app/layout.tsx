import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Eworks Satış', description: 'Satış ekibinin ofis hesabı açtığı portal' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function KokYerlesim({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
