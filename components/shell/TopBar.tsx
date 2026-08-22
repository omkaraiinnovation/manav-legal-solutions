import { UserMenu } from "./UserMenu";
import type { User } from "@/lib/types";
import { isLiveMode } from "@/lib/agents/model-client";

export function TopBar({ currentUser, title, subtitle }: { currentUser: User; title?: string; subtitle?: string }) {
  const live = isLiveMode();
  return (
    <header
      className="flex h-16 shrink-0 items-center justify-between border-b px-6"
      style={{ borderColor: "var(--hairline)", background: "color-mix(in srgb, var(--paper) 92%, transparent)", backdropFilter: "blur(6px)" }}
    >
      <div>
        {title && <h1 className="font-display text-lg font-semibold leading-tight">{title}</h1>}
        {subtitle && <p className="text-xs text-ink-faint">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span
          className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex"
          style={{
            color: live ? "var(--verified)" : "var(--info)",
            background: live ? "var(--verified-tint)" : "var(--info-tint)",
          }}
          title={live ? "A live LLM provider is configured — agents call it for real" : "No LLM API key set — agents run in deterministic mock mode, grounded in the seeded knowledge base"}
        >
          <span className="relative flex h-1.5 w-1.5">
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "currentColor" }} />}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
          </span>
          {live ? "Live AI Mode" : "Mock AI Mode"}
        </span>
        <UserMenu user={currentUser} />
      </div>
    </header>
  );
}
