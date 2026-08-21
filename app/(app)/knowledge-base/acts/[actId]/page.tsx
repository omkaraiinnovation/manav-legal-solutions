import { TopBar } from "@/components/shell/TopBar";
import { SectionHeader } from "@/components/ui/StatCard";
import { CoverageStatusBadge, TrustLevelBadge, Pill } from "@/components/ui/Badges";
import { getCurrentUser } from "@/lib/session";
import { Acts, Provisions, LegalRelationships } from "@/lib/db/repo";
import { notFound } from "next/navigation";
import { formatDateDisplay } from "@/lib/legal/date-utils";
import { GitBranch, ExternalLink } from "lucide-react";

export default async function ActDetailPage({ params }: { params: Promise<{ actId: string }> }) {
  const { actId } = await params;
  const user = await getCurrentUser();
  const act = await Acts.get(actId);
  if (!act) notFound();

  const provisionsRaw = await Provisions.byAct(actId);
  const provisions = provisionsRaw.sort((a, b) => a.sectionNumber.localeCompare(b.sectionNumber, undefined, { numeric: true }));
  const relationshipsByProvision = new Map(await Promise.all(provisions.map(async (p) => [p.id, await LegalRelationships.fromNode(p.id)] as const)));

  return (
    <div>
      <TopBar currentUser={user} title={act.fullName} subtitle={act.shortName} />
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-6">
        <div className="paper-card animate-rise p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TrustLevelBadge level={act.trustLevel} />
            <CoverageStatusBadge status={act.coverageStatus} />
            <Pill>{act.jurisdictionLevel}{act.state ? ` · ${act.state}` : ""}</Pill>
            <Pill>{act.status.replaceAll("_", " ")}</Pill>
          </div>
          <p className="text-sm leading-relaxed text-ink-soft">{act.summary}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            {act.commencementDate && <div><span className="text-ink-faint">Commenced: </span>{formatDateDisplay(act.commencementDate)}</div>}
            {act.repealedDate && <div><span className="text-ink-faint">Repealed: </span>{formatDateDisplay(act.repealedDate)}</div>}
            {act.competentAuthority && <div><span className="text-ink-faint">Authority: </span>{act.competentAuthority}</div>}
            {act.specialCourt && <div><span className="text-ink-faint">Forum: </span>{act.specialCourt}</div>}
          </div>
          <a href={act.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--oxblood)" }}>
            <ExternalLink size={12} /> Official source
          </a>
        </div>

        <section>
          <SectionHeader eyebrow={`${provisions.length} provisions`} title="Provisions" />
          <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
            {provisions.map((p) => {
              const rels = relationshipsByProvision.get(p.id) ?? [];
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-sm font-semibold">S.{p.sectionNumber}</span>
                      <span className="ml-2 text-sm font-medium">{p.title}</span>
                    </div>
                    {p.repealed && <Pill className="!border-[var(--flagged)] !text-[var(--flagged)]">Repealed</Pill>}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{p.textContent}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                    <span>Valid {formatDateDisplay(p.validFrom)}{p.validTo ? ` – ${formatDateDisplay(p.validTo)}` : " – present"}</span>
                    {p.supersedesOldReference && <span className="flex items-center gap-1"><GitBranch size={11} /> supersedes {p.supersedesOldReference}</span>}
                  </div>
                  {rels.length > 0 && (
                    <div className="mt-1 text-xs" style={{ color: "var(--brass)" }}>
                      {rels.map((r) => r.note).join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
            {provisions.length === 0 && (
              <div className="p-6 text-center text-sm text-ink-faint">
                No section-level provisions ingested for this Act yet — it is tracked at the taxonomy level only.
                Flag for the Legal Knowledge Base Admin queue if this Act is needed for an active matter.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
