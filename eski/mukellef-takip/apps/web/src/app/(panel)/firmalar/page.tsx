import CompaniesView from "@/components/CompaniesView";

export const instant = false;

// ?q= ile açılırsa (ör. komut paletinden seçilen mükellef) liste o aramayla başlar
export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : "";
  return <CompaniesView key={query} initialQuery={query} />;
}
