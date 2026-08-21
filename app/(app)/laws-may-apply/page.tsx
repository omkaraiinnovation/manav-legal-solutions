import { TopBar } from "@/components/shell/TopBar";
import { LawsMayApplyExplorer } from "@/components/legal/LawsMayApplyExplorer";
import { getCurrentUser } from "@/lib/session";

export default async function LawsMayApplyPage() {
  const user = await getCurrentUser();
  return (
    <div>
      <TopBar currentUser={user} title="What Laws May Apply?" subtitle="Central + Special + State sweep over a fact pattern, without opening a full matter." />
      <LawsMayApplyExplorer />
    </div>
  );
}
