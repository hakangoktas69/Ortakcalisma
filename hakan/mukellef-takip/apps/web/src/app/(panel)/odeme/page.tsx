import BillingView from "@/components/BillingView";

export const instant = false;

// iyzico dönüşündeki ?odeme=basarili|basarisiz sunucuda okunur; istemcide window'dan okumak hidrasyon uyuşmazlığı yaratıyordu
export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { odeme } = await searchParams;
  return <BillingView returnStatus={typeof odeme === "string" ? odeme : undefined} />;
}
