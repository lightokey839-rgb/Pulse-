import DossierView from "@/components/DossierView";

export default async function TokenPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  return <DossierView query={decodeURIComponent(mint)} />;
}
