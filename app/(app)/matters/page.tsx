import { TopBar } from "@/components/shell/TopBar";
import { SectionHeader } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Pill, SensitivityBadge } from "@/components/ui/Badges";
import { getCurrentUser } from "@/lib/session";
import { Matters } from "@/lib/db/repo";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  intake: "var(--info)", research: "var(--brass)", drafting: "var(--oxblood)",
  review: "var(--unverified)", filed: "var(--verified)", closed: "var(--ink-faint)",
};

export default async function MattersListPage() {
  const user = await getCurrentUser();
  const matters = await Matters.byTenant(user.tenantId);

  return (
    <div>
      <TopBar currentUser={user} title="Case Workspace" subtitle={`${matters.length} matters on file`} />
      <div className="mx-auto max-w-5xl px-6 py-6">
        <SectionHeader title="All Matters" action={<Button href="/intake" size="sm"><Plus size={14} /> New Matter</Button>} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {matters.map((m) => (
            <Link key={m.id} href={`/matters/${m.id}`} className="paper-card animate-rise flex flex-col gap-2 p-5 transition-transform hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium leading-snug">{m.title}</h3>
                <ArrowRight size={15} className="mt-0.5 shrink-0 text-ink-faint" />
              </div>
              <p className="line-clamp-2 text-xs text-ink-soft">{m.facts}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: STATUS_COLOR[m.status] }}>
                  {m.status}
                </span>
                {m.jurisdiction.state && <Pill>{m.jurisdiction.state}</Pill>}
                <SensitivityBadge level={m.sensitivityLevel} />
                {m.domains.slice(0, 2).map((d) => <Pill key={d}>{d.replaceAll("_", " ")}</Pill>)}
              </div>
            </Link>
          ))}
          {matters.length === 0 && <div className="paper-card p-6 text-center text-sm text-ink-faint">No matters yet — start with Legal Matter Intake.</div>}
        </div>
      </div>
    </div>
  );
}
