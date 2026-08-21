import { TopBar } from "@/components/shell/TopBar";
import { DraftingStudio } from "@/components/drafting/DraftingStudio";
import { getCurrentUser } from "@/lib/session";
import { Matters, DocumentTypes } from "@/lib/db/repo";

export default async function DraftingPage({ searchParams }: { searchParams: Promise<{ matterId?: string }> }) {
  const user = await getCurrentUser();
  const { matterId } = await searchParams;
  const [matters, documentTypes] = await Promise.all([Matters.byTenant(user.tenantId), DocumentTypes.all()]);
  return (
    <div>
      <TopBar currentUser={user} title="Drafting Studio" subtitle="Mode B — structured, fact-driven document generation with mandatory citation verification." />
      <DraftingStudio matters={matters} documentTypes={documentTypes} initialMatterId={matterId} />
    </div>
  );
}
