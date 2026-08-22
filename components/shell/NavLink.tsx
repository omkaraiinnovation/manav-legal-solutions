"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function NavLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium transition-all duration-150",
        active ? "text-white" : "text-ink-soft hover:translate-x-0.5 hover:bg-[var(--paper-sunken)]"
      )}
      style={
        active
          ? {
              backgroundImage: "linear-gradient(160deg, var(--oxblood) 0%, var(--oxblood-deep) 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 12px color-mix(in srgb, var(--oxblood) 35%, transparent)",
            }
          : undefined
      }
    >
      {active && <span className="absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full" style={{ background: "var(--brass)" }} />}
      <span className={active ? "opacity-100" : "opacity-70 group-hover:opacity-100"}>{icon}</span>
      {label}
    </Link>
  );
}
