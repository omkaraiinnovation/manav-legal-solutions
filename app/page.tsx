import { TopBar } from "@/components/shell/TopBar";
import { StatCard, SectionHeader } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { VerificationBadge, SensitivityBadge, Pill } from "@/components/ui/Badges";
import { getCurrentUser } from "@/lib/session";
import { Matters, Drafts, Deadlines, Acts, Provisions } from "@/lib/db/repo";
import { daysUntil, formatDateDisplay } from "@/lib/legal/date-utils";
import { FolderKanban, FileCheck2, AlarmClock, BookOpenText, ArrowRight, MessageSquareText, ClipboardList, Scale } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (user.role === "client") redirect("/portal");

  const matters = Matters.byTenant(user.tenantId);
  const pendingDrafts = Drafts.pendingReview();
  const allDeadlines = Deadlines.all().filter((d) => d.status === "pending");
  const upcoming = allDeadlines
    .map((d) => ({ ...d, days: daysUntil(d.dueDate) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
  const acts = Acts.all();
  const seededActs = acts.filter((a) => a.coverageStatus === "seeded").length;
  const provisionCount = Provisions.all().length;

  const statusCounts = matters.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <TopBar currentUser={user} title={`Namaste, ${user.fullName.split(" ")[0]}`} subtitle="Here's what needs attention across the firm today." />
      <div className="mx-auto max-w-6xl px-6 py-6">

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-rise">
          <StatCard label="Active Matters" value={matters.filter((m) => m.status !== "closed").length} sub={`${matters.length} total on file`} Icon={FolderKanban} accent="oxblood" />
          <StatCard label="Drafts Awaiting Review" value={pendingDrafts.length} sub="Lawyer Review Console" Icon={FileCheck2} accent="brass" />
          <StatCard label="Upcoming Deadlines" value={upcoming.length} sub="Next 30 days" Icon={AlarmClock} accent="flagged" />
          <StatCard label="Knowledge Base" value={`${provisionCount}`} sub={`provisions · ${seededActs}/${acts.length} Acts fully seeded`} Icon={BookOpenText} accent="verified" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionHeader eyebrow="Case Operations" title="Matters" action={<Button href="/matters" variant="secondary" size="sm">View all <ArrowRight size={14} /></Button>} />
            <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
              {matters.map((m) => (
                <Link key={m.id} href={`/matters/${m.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--paper-sunken)]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{m.title}</span>
                      <SensitivityBadge level={m.sensitivityLevel} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                      <Pill>{m.status}</Pill>
                      {m.jurisdiction.state && <Pill>{m.jurisdiction.state}</Pill>}
                      {m.domains.slice(0, 2).map((d) => <Pill key={d}>{d.replaceAll("_", " ")}</Pill>)}
                    </div>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-ink-faint" />
                </Link>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <Link href="/consultation" className="paper-card flex flex-col items-start gap-2 p-4 transition-transform hover:-translate-y-0.5">
                <MessageSquareText size={18} style={{ color: "var(--oxblood)" }} />
                <div className="text-sm font-medium">Consultation Chat</div>
                <div className="text-xs text-ink-faint">Mode A — advisory triage</div>
              </Link>
              <Link href="/intake" className="paper-card flex flex-col items-start gap-2 p-4 transition-transform hover:-translate-y-0.5">
                <ClipboardList size={18} style={{ color: "var(--oxblood)" }} />
                <div className="text-sm font-medium">New Matter Intake</div>
                <div className="text-xs text-ink-faint">Structured client intake</div>
              </Link>
              <Link href="/laws-may-apply" className="paper-card flex flex-col items-start gap-2 p-4 transition-transform hover:-translate-y-0.5">
                <Scale size={18} style={{ color: "var(--oxblood)" }} />
                <div className="text-sm font-medium">What Laws May Apply?</div>
                <div className="text-xs text-ink-faint">Standalone law sweep</div>
              </Link>
            </div>
          </div>

          <div>
            <SectionHeader eyebrow="Deadline Engine" title="Upcoming Deadlines" />
            <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
              {upcoming.length === 0 && <div className="p-5 text-sm text-ink-faint">No pending deadlines tracked.</div>}
              {upcoming.map((d) => {
                const matter = matters.find((m) => m.id === d.matterId);
                const urgent = d.days <= 7;
                return (
                  <div key={d.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{d.label}</span>
                      <span className="text-xs font-semibold" style={{ color: urgent ? "var(--flagged)" : "var(--ink-soft)" }}>
                        {d.days >= 0 ? `${d.days}d` : "overdue"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-faint">{matter?.title} · due {formatDateDisplay(d.dueDate)}</div>
                    <div className="mt-1">
                      <VerificationBadge status={d.source === "lawyer_verified" ? "verified" : "unverified"} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <SectionHeader title="Matters by Status" />
              <div className="paper-card p-5">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div key={status} className="mb-2.5 last:mb-0">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="capitalize text-ink-soft">{status}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--paper-sunken)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(count / matters.length) * 100}%`, background: "var(--oxblood)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
