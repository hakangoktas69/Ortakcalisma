import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Eworks', description: 'Mali müşavir kurum işleri portalı' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function KokYerlesim({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
