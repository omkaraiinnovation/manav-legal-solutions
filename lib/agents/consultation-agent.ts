/**
 * Consultation Agent — Mode A (source docs Part 1; Blueprint 3.1).
 * 7-part advisory structure: salutation → acknowledgement → analysis → action
 * plan → risk assessment → disclaimer → closing.
 */
import type { Jurisdiction } from "@/lib/types";
import { completeText, isLiveMode } from "./model-client";
import { MASTER_SYSTEM_PROMPT, STANDARD_DISCLAIMER, currentDateContext } from "./prompts";
import { runApplicableLawSweep } from "./applicable-law-agent";
import { Provisions } from "@/lib/db/repo";

export interface ConsultationInput {
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  jurisdiction: Jurisdiction;
  language: "en" | "hi" | "bilingual";
}

export interface ConsultationResult {
  reply: string;
  citedProvisionIds: string[];
  mode: "live" | "mock";
}

export async function runConsultation(input: ConsultationInput): Promise<ConsultationResult> {
  const sweep = runApplicableLawSweep(input.userMessage, input.jurisdiction);
  const citedProvisionIds = sweep.rows
    .map((r) => r.actId)
    .filter((id): id is string => !!id)
    .flatMap((actId) => Provisions.byAct(actId).slice(0, 2).map((p) => p.id));

  if (isLiveMode()) {
    const context = sweep.rows.map((r) => `- [${r.category}] ${r.law}: ${r.reason}`).join("\n");
    const system = `${currentDateContext()}\n\n${MASTER_SYSTEM_PROMPT}\n\nLanguage preference: ${input.language}.\n\n[APPLICABLE-LAW SWEEP RESULTS — ground your citations in these, mark anything else [VERIFICATION REQUIRED]]\n${context}`;
    const reply = await completeText({
      system,
      messages: [...input.history, { role: "user", content: input.userMessage }],
      model: "primary",
      maxTokens: 1400,
    });
    return { reply, citedProvisionIds, mode: "live" };
  }

  // Deterministic mock mode — grounded entirely in the sweep above.
  const lines: string[] = [];
  lines.push(`**Namaste / Hello.**`);
  lines.push(
    `Thank you for sharing this. I understand this situation may be stressful, and I'll walk through what our preliminary research surfaces — please treat this as a starting point for your advocate's review, not final advice.`
  );
  lines.push(`\n**Preliminary Legal Analysis**`);
  if (sweep.rows.length === 0) {
    lines.push(
      "Our automated sweep did not confidently match a specific statute to the facts as described. [VERIFICATION REQUIRED: Source Not Confirmed] — please share more specific facts (what happened, where, when, and who was involved) so we can narrow this down, or ask a paralegal to run manual research."
    );
  } else {
    for (const row of sweep.rows.slice(0, 6)) {
      lines.push(`- **${row.law}** _(${row.category}, confidence: ${row.confidence})_ — ${row.reason}`);
    }
  }
  lines.push(`\n${sweep.statePackNote}`);
  if (sweep.conflictFlag) lines.push(`\n⚠ ${sweep.conflictFlag}`);

  lines.push(`\n**Suggested Action Plan**`);
  lines.push("1. Share any documents/evidence relevant to these facts (FIR copy, notices, agreements, photos).");
  lines.push("2. We will open a Matter file and run the full \"What Laws May Apply?\" sweep with jurisdiction confirmed.");
  lines.push("3. A paralegal will prepare a chronology and applicable-law map for advocate review.");
  if (sweep.suggestedForums.length) lines.push(`4. Likely forum: ${sweep.suggestedForums[0]}.`);

  lines.push(`\n**Risk Assessment**`);
  lines.push(
    sweep.rows.some((r) => r.category === "Special Act")
      ? "This matter engages a Special Act with stringent procedural/bail consequences — time-sensitive. Please consult an advocate promptly rather than relying on this preliminary read."
      : "No special-act urgency flags detected from the facts given, but please confirm limitation/deadlines with an advocate promptly."
  );

  lines.push(`\n**Disclaimer**\n${STANDARD_DISCLAIMER}`);
  lines.push(`\n**Closing**\nWe're here to help prepare this properly — would you like us to open a Matter file and start the guided intake?`);

  return { reply: lines.join("\n"), citedProvisionIds, mode: "mock" };
}
