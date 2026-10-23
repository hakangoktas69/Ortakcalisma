import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Mükellef Takip",
  description: "Mali müşavirler için mükellef takip portalı",
};

// Tema tercihi ilk boyamadan önce uygulanır (yoksa sayfa bir an yanlış temada yanıp söner). Varsayılan açık tema.
const themeInit = `try{var t=localStorage.getItem('mt_theme');if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full bg-slate-50 text-slate-800">{children}</body>
    </html>
  );
}
