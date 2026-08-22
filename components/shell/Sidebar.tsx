import { NavLink } from "./NavLink";
import Link from "next/link";
import {
  LayoutDashboard, MessageSquareText, ClipboardList, Scale, FolderKanban,
  FileCheck2, BookOpenText, Users, Settings, UserRound, Gavel, UploadCloud,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

const STAFF_NAV = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/consultation", label: "Consultation Chat", Icon: MessageSquareText },
  { href: "/intake", label: "Matter Intake", Icon: ClipboardList },
  { href: "/laws-may-apply", label: "What Laws May Apply?", Icon: Scale },
  { href: "/matters", label: "Case Workspace", Icon: FolderKanban },
  { href: "/drafting", label: "Drafting Studio", Icon: Gavel },
  { href: "/review", label: "Lawyer Review Console", Icon: FileCheck2 },
  { href: "/knowledge-base", label: "Knowledge Base", Icon: BookOpenText },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Firm Admin", Icon: Settings },
];

const CLIENT_NAV = [
  { href: "/portal", label: "My Matters", Icon: UserRound },
  { href: "/consultation", label: "Ask a Question", Icon: MessageSquareText },
];

export function Sidebar({ role }: { role: UserRole }) {
  const nav = role === "client" ? CLIENT_NAV : STAFF_NAV;
  const showAdmin = role === "firm_admin" || role === "platform_admin";
  const iconSize = 16;
  const strokeWidth = 2;

  return (
    <aside
      className="flex h-screen w-64 shrink-0 flex-col border-r px-3 py-4"
      style={{ borderColor: "var(--hairline)", background: "var(--paper-raised)" }}
    >
      <div className="flex items-center gap-2.5 px-2 pb-5 pt-1">
        <div
          className="seal-ring flex h-9 w-9 shrink-0 items-center justify-center text-sm font-bold font-display"
          style={{ color: "var(--brass)" }}
        >
          MLS
        </div>
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold">Manav Legal Solutions</div>
          <div className="text-[11px] text-ink-faint">Pan-India Paralegal OS</div>
        </div>
      </div>

      {role !== "client" && (
        <Link
          href="/intake"
          className="mb-3 flex items-center justify-center gap-2 rounded-[8px] px-3 py-2.5 text-sm font-medium text-white transition-transform duration-150 hover:-translate-y-px active:translate-y-0"
          style={{
            backgroundImage: "linear-gradient(160deg, var(--oxblood) 0%, var(--oxblood-deep) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 4px 12px color-mix(in srgb, var(--oxblood) 30%, transparent)",
          }}
        >
          <UploadCloud size={15} />
          Upload Matter / Add Files
        </Link>
      )}

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {nav.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={<item.Icon size={iconSize} strokeWidth={strokeWidth} />} />
        ))}
        {showAdmin && (
          <>
            <div className="mt-3 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Administration
            </div>
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={<item.Icon size={iconSize} strokeWidth={strokeWidth} />} />
            ))}
          </>
        )}
      </nav>

      <div className="mt-3 rounded-[10px] border px-3 py-2.5 text-[11px] leading-snug text-ink-faint" style={{ borderColor: "var(--hairline)" }}>
        MLS is a paralegal support platform. It researches, drafts and verifies —
        an authorized advocate retains final judgment and filing authority.
      </div>
    </aside>
  );
}
