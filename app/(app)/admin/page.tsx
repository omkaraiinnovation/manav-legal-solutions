import { TopBar } from "@/components/shell/TopBar";
import { SectionHeader } from "@/components/ui/StatCard";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { getCurrentUser, getCurrentTenant } from "@/lib/session";
import { Users, Acts, Provisions, AuditLogs, StateOnboarding, Matters, DocumentTypes } from "@/lib/db/repo";
import { LEGAL_DOMAIN_LABELS } from "@/lib/types";
import { formatDateDisplay } from "@/lib/legal/date-utils";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (user.role !== "firm_admin" && user.role !== "platform_admin") redirect("/");

  const tenant = await getCurrentTenant();
  const [users, acts, provisions, auditLog, statePacks, matters, documentTypes] = await Promise.all([
    Users.byTenant(tenant.id), Acts.all(), Provisions.all(), AuditLogs.all(),
    StateOnboarding.all(), Matters.byTenant(tenant.id), DocumentTypes.all(),
  ]);

  const domainCoverage = Object.entries(LEGAL_DOMAIN_LABELS).map(([domain, label]) => {
    const domainActs = acts.filter((a) => a.domains.includes(domain as any));
    return { domain, label, total: domainActs.length, seeded: domainActs.filter((a) => a.coverageStatus === "seeded").length };
  }).filter((d) => d.total > 0);

  return (
    <div>
      <TopBar currentUser={user} title="Firm Administration" subtitle={tenant.name} />
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-6">

        <section>
          <SectionHeader eyebrow="Multi-Tenant Console" title={tenant.name} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="paper-card p-4"><div className="text-xs text-ink-faint">Users</div><div className="font-display text-2xl font-semibold">{users.length}</div></div>
            <div className="paper-card p-4"><div className="text-xs text-ink-faint">Matters</div><div className="font-display text-2xl font-semibold">{matters.length}</div></div>
            <div className="paper-card p-4"><div className="text-xs text-ink-faint">Document Types</div><div className="font-display text-2xl font-semibold">{documentTypes.length}</div></div>
            <div className="paper-card p-4"><div className="text-xs text-ink-faint">Acts / Provisions</div><div className="font-display text-2xl font-semibold">{acts.length}/{provisions.length}</div></div>
          </div>
        </section>

        <section>
          <SectionHeader title="Users & Roles" action={<span className="text-xs text-ink-faint">Change a user's role directly — takes effect on their next page load</span>} />
          <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium">{u.fullName}</div>
                  <div className="text-xs text-ink-faint">{u.email}</div>
                </div>
                <RoleSelect userId={u.id} currentRole={u.role} disabled={u.id === user.id} />
              </div>
            ))}
            {users.length === 0 && <div className="p-4 text-sm text-ink-faint">No users yet — accounts appear here once someone signs up.</div>}
          </div>
        </section>

        <section>
          <SectionHeader title="State Legal Pack Rollout" />
          <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
            {statePacks.map((s) => (
              <div key={s.state} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="text-sm font-medium">{s.state}</div>
                  <div className="text-xs text-ink-faint">{s.notes}</div>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    color: s.packStatus === "live" ? "var(--verified)" : "var(--ink-faint)",
                    background: s.packStatus === "live" ? "var(--verified-tint)" : "var(--paper-sunken)",
                  }}
                >
                  {s.packStatus === "live" ? `Live · ${s.actsSeeded} Acts` : "Planned"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Knowledge Base Coverage by Domain" />
          <div className="paper-card p-5">
            {domainCoverage.map((d) => (
              <div key={d.domain} className="mb-3 last:mb-0">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-soft">{d.label}</span>
                  <span className="font-medium">{d.seeded}/{d.total} Acts fully seeded</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--paper-sunken)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(d.seeded / d.total) * 100}%`, background: "var(--verified)" }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Recent Audit Log" />
          <div className="paper-card divide-y font-mono text-xs" style={{ borderColor: "var(--hairline)" }}>
            {auditLog.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
                <span>{a.action} <span className="text-ink-faint">({a.entityType}:{a.entityId.slice(0, 8)})</span></span>
                <span className="text-ink-faint">{formatDateDisplay(a.createdAt)}</span>
              </div>
            ))}
            {auditLog.length === 0 && <div className="p-4 text-ink-faint">No audit events yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
