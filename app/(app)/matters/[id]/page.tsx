import { TopBar } from "@/components/shell/TopBar";
import { SectionHeader } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Pill, SensitivityBadge, VerificationBadge } from "@/components/ui/Badges";
import { ApplicableLawTable } from "@/components/legal/ApplicableLawTable";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { QaPanel } from "@/components/documents/QaPanel";
import { EvidencePanel } from "@/components/matters/EvidencePanel";
import { SmartSearchPanel } from "@/components/matters/SmartSearchPanel";
import { getCurrentUser } from "@/lib/session";
import { Matters, MatterParties, ChronologyEvents, Deadlines, Drafts } from "@/lib/db/repo";
import { Documents, QaHistory } from "@/lib/db/documents-repo";
import { EvidenceAnalyses } from "@/lib/db/evidence-repo";
import { runApplicableLawSweep } from "@/lib/agents/applicable-law-agent";
import { computeCoverageAudit } from "@/lib/legal/coverage";
import { formatDateDisplay, daysUntil } from "@/lib/legal/date-utils";
import { notFound } from "next/navigation";
import { Gavel, FileText, Users2, CheckCircle2, XCircle, MessagesSquare, SearchCode, ShieldAlert } from "lucide-react";

export default async function MatterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const matter = await Matters.get(id);
  if (!matter) notFound();

  const [parties, chronology, deadlines, drafts, documents, qaHistory, evidenceAnalysis, sweep, coverage] = await Promise.all([
    MatterParties.byMatter(id),
    ChronologyEvents.byMatter(id),
    Deadlines.byMatter(id),
    Drafts.byMatter(id),
    Documents.byMatter(id),
    QaHistory.byMatter(id),
    EvidenceAnalyses.latestForMatter(id),
    runApplicableLawSweep(matter.facts, matter.jurisdiction, matter.domains),
    computeCoverageAudit(matter),
  ]);

  return (
    <div>
      <TopBar currentUser={user} title={matter.title} subtitle={`${matter.status} · opened ${formatDateDisplay(matter.createdAt)}`} />
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-6">

        {/* Header strip */}
        <div className="paper-card animate-rise flex flex-wrap items-center gap-2 p-4">
          <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: "var(--oxblood)" }}>{matter.status}</span>
          {matter.jurisdiction.state && <Pill>{matter.jurisdiction.state}{matter.jurisdiction.district ? ` · ${matter.jurisdiction.district}` : ""}</Pill>}
          {matter.jurisdiction.court && <Pill>{matter.jurisdiction.court}</Pill>}
          <SensitivityBadge level={matter.sensitivityLevel} />
          {matter.domains.map((d) => <Pill key={d}>{d.replaceAll("_", " ")}</Pill>)}
          <div className="ml-auto flex gap-2">
            <Button href={`/drafting?matterId=${matter.id}`} size="sm"><Gavel size={14} /> Draft Document</Button>
            <Button href={`/consultation?matterId=${matter.id}`} variant="secondary" size="sm">Ask AI</Button>
          </div>
        </div>

        {/* Facts */}
        <section>
          <SectionHeader eyebrow="Matter File" title="Facts & Relief Sought" />
          <div className="paper-card p-5 text-sm leading-relaxed">
            <p>{matter.facts}</p>
            {matter.reliefSought && <p className="mt-3 text-ink-soft"><strong className="text-ink">Relief sought:</strong> {matter.reliefSought}</p>}
          </div>
        </section>

        {/* Document Intelligence & RAG */}
        <section>
          <SectionHeader eyebrow="Document Intelligence" title="Documents" />
          <DocumentUpload matterId={id} existing={documents} />
        </section>

        {/* Q&A — RAG over documents + knowledge base together */}
        <section>
          <SectionHeader eyebrow="Retrieval-Augmented Q&A" title="Ask About This Matter" action={<span className="flex items-center gap-1 text-xs text-ink-faint"><MessagesSquare size={12} /> documents + legal knowledge base</span>} />
          <QaPanel matterId={id} initialHistory={qaHistory} />
        </section>

        {/* Smart Search — natural-language + exact-text search over this matter's documents */}
        <section>
          <SectionHeader eyebrow="Document Search" title="Smart Search" action={<span className="flex items-center gap-1 text-xs text-ink-faint"><SearchCode size={12} /> semantic + exact-text</span>} />
          <SmartSearchPanel matterId={id} />
        </section>

        {/* Evidence Intelligence — fact matrix, contradiction detection, missing-support flags */}
        <section>
          <SectionHeader eyebrow="Evidence Intelligence" title="Fact Matrix & Contradiction Check" action={<span className="flex items-center gap-1 text-xs text-ink-faint"><ShieldAlert size={12} /> facts + documents cross-referenced</span>} />
          <EvidencePanel matterId={id} initial={evidenceAnalysis ?? null} />
        </section>

        {/* Legal Coverage Score */}
        <section>
          <SectionHeader eyebrow="Quality Control" title="Legal Coverage Audit" />
          <div className="paper-card p-5">
            <div className="mb-4 flex items-center gap-4">
              <div className="font-display text-4xl font-bold" style={{ color: coverage.scorePercent >= 80 ? "var(--verified)" : coverage.scorePercent >= 50 ? "var(--unverified)" : "var(--flagged)" }}>
                {coverage.scorePercent}%
              </div>
              <p className="text-sm text-ink-soft">
                Reflects what has actually been checked for this matter — never presented as a guarantee of legal completeness.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {coverage.items.map((item) => (
                <div key={item.label} className="flex items-start gap-2 text-sm">
                  {item.checked ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "var(--verified)" }} /> : <XCircle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--ink-faint)" }} />}
                  <div>
                    <div className="font-medium">{item.label}</div>
                    {item.note && <div className="text-xs text-ink-faint">{item.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Legal Map */}
        <section>
          <SectionHeader eyebrow="Legal Map" title="What Laws May Apply to This Matter" />
          <ApplicableLawTable rows={sweep.rows} conflictFlag={sweep.conflictFlag} statePackNote={sweep.statePackNote} />
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Chronology */}
          <section>
            <SectionHeader eyebrow="Case Chronology Engine" title="Timeline" />
            <div className="paper-card p-5">
              <ol className="space-y-4 border-l pl-4" style={{ borderColor: "var(--hairline)" }}>
                {chronology.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full" style={{ background: "var(--oxblood)" }} />
                    <div className="text-xs font-semibold text-ink-faint">{formatDateDisplay(e.eventDate)}</div>
                    <div className="text-sm">{e.description}</div>
                    {e.person && <div className="text-xs text-ink-faint">{e.person}</div>}
                  </li>
                ))}
                {chronology.length === 0 && <div className="text-sm text-ink-faint">No chronology events recorded yet.</div>}
              </ol>
            </div>
          </section>

          {/* Deadlines */}
          <section>
            <SectionHeader eyebrow="Deadline Engine" title="Deadlines" />
            <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
              {deadlines.map((d) => {
                const days = daysUntil(d.dueDate);
                return (
                  <div key={d.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{d.label}</span>
                      <span className="text-xs font-semibold" style={{ color: days <= 7 ? "var(--flagged)" : "var(--ink-soft)" }}>{formatDateDisplay(d.dueDate)}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-faint">{d.basis}</p>
                    <div className="mt-1.5"><VerificationBadge status={d.source === "lawyer_verified" ? "verified" : "unverified"} /></div>
                  </div>
                );
              })}
              {deadlines.length === 0 && <div className="p-4 text-sm text-ink-faint">No deadlines computed yet.</div>}
            </div>
          </section>

          {/* Parties */}
          <section>
            <SectionHeader eyebrow="Matter File" title="Parties" />
            <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
              {parties.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-4">
                  <Users2 size={16} className="text-ink-faint" />
                  <div>
                    <div className="text-sm font-medium">{p.fullName}</div>
                    <div className="text-xs capitalize text-ink-faint">{p.role.replaceAll("_", " ")}{p.personType ? ` · ${p.personType.replaceAll("_", " ")}` : ""}</div>
                  </div>
                </div>
              ))}
              {parties.length === 0 && <div className="p-4 text-sm text-ink-faint">No parties on file yet.</div>}
            </div>
          </section>

          {/* Drafts */}
          <section>
            <SectionHeader eyebrow="Drafting Studio" title="Drafts on this Matter" />
            <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
              {drafts.map((d) => (
                <a key={d.id} href={`/review/${d.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-[var(--paper-sunken)]">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-ink-faint" />
                    <span className="text-sm font-medium">{d.title}</span>
                  </div>
                  <Pill>{d.status.replaceAll("_", " ")}</Pill>
                </a>
              ))}
              {drafts.length === 0 && <div className="p-4 text-sm text-ink-faint">No drafts generated yet for this matter.</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
