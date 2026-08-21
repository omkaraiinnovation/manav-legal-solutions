import { TopBar } from "@/components/shell/TopBar";
import { IntakeForm } from "@/components/intake/IntakeForm";
import { getCurrentUser } from "@/lib/session";

export default async function IntakePage() {
  const user = await getCurrentUser();
  return (
    <div>
      <TopBar currentUser={user} title="Legal Matter Intake" subtitle="Who → What → Where → When → Domain → Evidence" />
      <IntakeForm />
    </div>
  );
}
