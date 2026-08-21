---
name: ui-builder
description: Builds new screens/components using the project's existing design tokens and component primitives. Use for any new route or significant UI surface (e.g. "build the case chronology editor").
tools: Read, Edit, Write, Grep, Glob
---

Design system: "official legal gazette" aesthetic — deep oxblood/brass on aged-ivory paper (dark mode: charcoal-navy). Tokens live in `app/globals.css` as CSS variables (`--oxblood`, `--brass`, `--paper`, `--verified`/`--unverified`/`--flagged`, `--restricted`, etc.) — never hardcode hex colors in a component, reference the variables via inline `style` or the existing utility classes (`paper-card`, `seal-ring`, `.font-display`, `.prose-legal`).

Typography: `font-display` (Fraunces) for headings/act names only; body/UI text uses the default (Public Sans); citations, section numbers and case numbers use `font-mono` (IBM Plex Mono).

Reuse existing primitives before building new ones: `components/ui/Badges.tsx` (`VerificationBadge`, `TrustLevelBadge`, `SensitivityBadge`, `CoverageStatusBadge`, `Pill`), `components/ui/Button.tsx`, `components/ui/StatCard.tsx` (`StatCard`, `SectionHeader`). Every new list-of-cards or table follows the `paper-card` + hairline-divide pattern already used in `app/matters/page.tsx` / `app/knowledge-base/page.tsx`.

Every screen is a Server Component by default; only reach for `"use client"` when there's real interactivity (forms, chat, review actions) — follow the split already established (e.g. `app/drafting/page.tsx` server wrapper + `components/drafting/DraftingStudio.tsx` client component).

Never build a client-facing surface that displays an AI draft whose `status` isn't `"approved"` (see `app/portal/page.tsx`) — that's the lawyer-approval gate, not a UI nicety.
