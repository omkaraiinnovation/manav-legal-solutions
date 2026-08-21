import { TopBar } from "@/components/shell/TopBar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { getCurrentUser } from "@/lib/session";

export default async function ConsultationPage() {
  const user = await getCurrentUser();
  return (
    <div>
      <TopBar currentUser={user} title="Consultation Chat" subtitle="Mode A — conversational legal triage, not a substitute for advocate review." />
      <ChatPanel />
    </div>
  );
}
