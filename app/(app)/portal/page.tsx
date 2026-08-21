import { TopBar } from "@/components/shell/TopBar";
import { Pill, SensitivityBadge } from "@/components/ui/Badges";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/session";
import { Matters, Drafts, Deadlines } from "@/lib/db/repo";
import { formatDateDisplay } from "@/lib/legal/date-utils";
import { MessageSquareText, FileText, CalendarClock } from "lucide-react";
import Link from "next/link";

export default async function ClientPortalPage() {
  const user = await getCurrentUser();
  const allMatters = await Matters.byTenant(user.tenantId);
  const myMatters = user.role === "client" ? allMatters.filter((m) => m.clientId === user.id) : allMatters;

  const perMatter = await Promise.all(
    myMatters.map(async (m) => ({
      matter: m,
      drafts: (await Drafts.byMatter(m.id)).filter((d) => d.status === "approved"),
      deadlines: await Deadlines.byMatter(m.id),
    }))
  );

  return (
    <div>
      <TopBar currentUser={user} title="My Matters" subtitle="A simplified view of your matters, documents and upcoming dates." />
      <div className="mx-auto max-w-3xl px-6 py-6">
        {myMatters.length === 0 && (
          <div className="paper-card p-8 text-center">
            <p className="text-sm text-ink-faint">No matters on file yet.</p>
            <Button href="/consultation" className="mt-3">Start a Consultation</Button>
          </div>
        )}
        <div className="space-y-6">
          {perMatter.map(({ matter: m, drafts, deadlines }) => (
            <div key={m.id} className="paper-card animate-rise p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold">{m.title}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Pill>{m.status}</Pill>
                    <SensitivityBadge level={m.sensitivityLevel} />
                  </div>
                </div>
                <Link href="/consultation" className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--oxblood)" }}>
                  <MessageSquareText size={13} /> Message the firm
                </Link>
              </div>

              <p className="mt-3 text-sm text-ink-soft">{m.facts}</p>

              {deadlines.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-faint"><CalendarClock size={12} /> UPCOMING DATES</div>
                  <ul className="space-y-1 text-sm">
                    {deadlines.map((d) => <li key={d.id}>{d.label} — <span className="text-ink-faint">{formatDateDisplay(d.dueDate)}</span></li>)}
                  </ul>
                </div>
              )}

              {drafts.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-faint"><FileText size={12} /> DOCUMENTS SHARED WITH YOU</div>
                  <ul className="space-y-1 text-sm">
                    {drafts.map((d) => <li key={d.id}>{d.title}</li>)}
                  </ul>
                </div>
              )}
              {drafts.length === 0 && <p className="mt-4 text-xs text-ink-faint">No documents have been finalized and shared with you yet — your advocate is still reviewing.</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
