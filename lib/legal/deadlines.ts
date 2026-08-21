/**
 * Deadline & Limitation Engine (source docs, Section 57 / Blueprint 3.8).
 *
 * Computes a small set of well-known, high-confidence statutory deadlines.
 * Every result is tagged `source: "ai_estimated"` — the product's own rule is
 * that AI-estimated deadlines are never presented as equivalent to a
 * lawyer-verified one (see Deadline type). This is intentionally narrow: a
 * general court-holiday-aware limitation calculator covering every Act is a
 * Phase 2+ build (Blueprint Section 8), not something to fake here.
 */
import { addDays, addMonths } from "./date-utils";

export interface DeadlineSuggestion {
  label: string;
  dueDate: string;
  basis: string;
}

/** NI Act s.142(b): complaint must be filed within one month of the cause of action
 *  (i.e. expiry of the 15-day payment window after the demand notice is received). */
export function chequeBounceComplaintDeadline(noticeExpiryDate: string): DeadlineSuggestion {
  return {
    label: "File Section 138 NI Act complaint",
    dueDate: addMonths(noticeExpiryDate, 1),
    basis: "Negotiable Instruments Act, 1881 s.142(b) — one month from the date the cause of action arises (expiry of the 15-day notice window). Court may condone delay for sufficient cause.",
  };
}

/** Section 138 NI Act: demand notice must be sent within 30 days of the dishonour memo,
 *  and the drawer gets 15 days from receipt to pay before cause of action arises. */
export function chequeBounceNoticeWindow(dishonourDate: string) {
  return {
    noticeDeadline: addDays(dishonourDate, 30),
    basis: "NI Act s.138 proviso (b) — demand notice must be issued within 30 days of the dishonour memo.",
  };
}

/** Limitation Act, 1963 Art. 137 residual period for applications where no specific
 *  article applies — a conservative, commonly-cited default, NOT a substitute for
 *  checking the specific applicable Article. */
export function residualApplicationLimitation(causeOfActionDate: string): DeadlineSuggestion {
  return {
    label: "Residual limitation to file application (Art. 137)",
    dueDate: addDays(causeOfActionDate, 3 * 365),
    basis: "Limitation Act, 1963, Article 137 (residual 3-year period for applications with no specific article) — verify a more specific Article does not apply before relying on this date.",
  };
}
