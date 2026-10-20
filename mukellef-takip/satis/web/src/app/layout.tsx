import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Mükellef Takip · Satış",
  description: "Satış ekibi portalı: müşavir hesabı açma ve yönetme",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#fffbf7] text-slate-800">{children}</body>
    </html>
  );
}
