import DashboardView from "@/components/DashboardView";

// Sayfa verisi tarayıcıda (giriş token'ı ile) yükleniyor; anında gezinme doğrulamasından muaf.
export const instant = false;

export default function Page() {
  return <DashboardView />;
}
