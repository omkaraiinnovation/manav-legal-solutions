import { TopBar } from "@/components/shell/TopBar";
import { SectionHeader } from "@/components/ui/StatCard";
import { Pill } from "@/components/ui/Badges";
import { getCurrentUser } from "@/lib/session";
import { Drafts, Matters } from "@/lib/db/repo";
import Link from "next/link";
import { FileCheck2, ArrowRight } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  ai_generated: "var(--info)", in_review: "var(--unverified)", approved: "var(--verified)",
  rejected: "var(--flagged)", revision_requested: "var(--brass)",
};

export default async function ReviewQueuePage() {
  const user = await getCurrentUser();
  const drafts = Drafts.all().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <TopBar currentUser={user} title="Lawyer Review Console" subtitle="Every AI draft passes here before it reaches a client." />
      <div className="mx-auto max-w-4xl px-6 py-6">
        <SectionHeader eyebrow={`${drafts.filter((d) => d.status === "ai_generated" || d.status === "in_review").length} pending`} title="Review Queue" />
        <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
          {drafts.map((d) => {
            const matter = Matters.get(d.matterId);
            return (
              <Link key={d.id} href={`/review/${d.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-[var(--paper-sunken)]">
                <div className="flex items-center gap-3">
                  <FileCheck2 size={16} className="text-ink-faint" />
                  <div>
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-ink-faint">{matter?.title}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.coverageScore !== undefined && <Pill>{d.coverageScore}% verified</Pill>}
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: STATUS_COLOR[d.status] }}>
                    {d.status.replaceAll("_", " ")}
                  </span>
                  <ArrowRight size={15} className="text-ink-faint" />
                </div>
              </Link>
            );
          })}
          {drafts.length === 0 && <div className="p-6 text-center text-sm text-ink-faint">No drafts yet — generate one from the Drafting Studio.</div>}
        </div>
      </div>
    </div>
  );
}
