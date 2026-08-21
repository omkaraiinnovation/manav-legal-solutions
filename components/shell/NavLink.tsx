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
        "group flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-white" : "text-ink-soft hover:bg-[var(--paper-sunken)]"
      )}
      style={active ? { background: "var(--oxblood)" } : undefined}
    >
      <span className={active ? "opacity-100" : "opacity-70 group-hover:opacity-100"}>{icon}</span>
      {label}
    </Link>
  );
}
