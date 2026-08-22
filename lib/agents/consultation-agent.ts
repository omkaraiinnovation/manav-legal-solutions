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

export interface ConsultationAttachment {
  fileName: string;
  sourceKind: "document" | "image" | "audio" | "video";
  text: string;
  lowConfidence: boolean;
}

export interface ConsultationInput {
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  jurisdiction: Jurisdiction;
  language: "en" | "hi" | "bilingual";
  /** Documents/images/audio/video the user attached to this message, already OCR'd/transcribed
   *  via the universal ingestion pipeline (spec §12: "Speak → Upload Documents → Submit"). */
  attachments?: ConsultationAttachment[];
}

export interface ConsultationResult {
  reply: string;
  citedProvisionIds: string[];
  mode: "live" | "mock";
}

export async function runConsultation(input: ConsultationInput): Promise<ConsultationResult> {
  const sweep = await runApplicableLawSweep(input.userMessage, input.jurisdiction);
  const actIds = sweep.rows.map((r) => r.actId).filter((id): id is string => !!id);
  const provisionsByAct = await Promise.all(actIds.map((actId) => Provisions.byAct(actId)));
  const citedProvisionIds = provisionsByAct.flatMap((ps) => ps.slice(0, 2).map((p) => p.id));

  const attachmentsBlock = buildAttachmentsBlock(input.attachments);

  if (isLiveMode()) {
    const context = sweep.rows.map((r) => `- [${r.category}] ${r.law}: ${r.reason}`).join("\n");
    const system = `${currentDateContext()}\n\n${MASTER_SYSTEM_PROMPT}\n\nLanguage preference: ${input.language}.\n\n[APPLICABLE-LAW SWEEP RESULTS — ground your citations in these, mark anything else [VERIFICATION REQUIRED]]\n${context}${attachmentsBlock}`;
    const reply = await completeText({
      system,
      messages: [...input.history, { role: "user", content: input.userMessage }],
      model: "primary",
      // Bullet-point breakdowns (BNS+IPC dual-regime cross-references, multi-offence
      // fact patterns) run longer than the dense table-style output they replaced —
      // 1400 was truncating real answers mid-sentence on exactly these queries, and
      // a genuinely dense 5-offence test case still hit 3000. There's timeout
      // headroom (well under 60s even at this size), so budget for it rather than
      // relying solely on the truncation notice to paper over an undersized cap.
      maxTokens: 4500,
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

  if (input.attachments?.length) {
    lines.push(`\n**Attached Material Received**`);
    for (const a of input.attachments) {
      const kindLabel = a.sourceKind === "audio" || a.sourceKind === "video" ? "transcribed" : a.sourceKind === "image" ? "OCR'd" : "extracted";
      lines.push(`- **${a.fileName}** _(${kindLabel}${a.lowConfidence ? ", flagged for verification" : ""})_ — ${a.text.length.toLocaleString()} characters of text captured.`);
    }
    lines.push("This material will be considered alongside your description once a Matter file is opened and the full document pipeline runs.");
  }

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

/** Renders attached documents/audio/video into the live-mode system prompt, truncated per
 *  attachment to keep the request bounded — full text lives in the eventual Matter's document
 *  pipeline once one is opened; this is enough for the consultation reply to actually use it. */
function buildAttachmentsBlock(attachments: ConsultationAttachment[] | undefined): string {
  if (!attachments?.length) return "";
  const MAX_CHARS_PER_ATTACHMENT = 6000;
  const rendered = attachments
    .map((a) => {
      const truncated = a.text.length > MAX_CHARS_PER_ATTACHMENT;
      const body = a.text.slice(0, MAX_CHARS_PER_ATTACHMENT);
      const confidenceNote = a.lowConfidence ? " [low-confidence extraction — treat uncertain details cautiously]" : "";
      return `--- ${a.fileName} (${a.sourceKind})${confidenceNote} ---\n${body}${truncated ? "\n[...truncated...]" : ""}`;
    })
    .join("\n\n");
  return `\n\n[ATTACHED MATERIAL — extracted via OCR/speech-to-text, ground your analysis in this alongside the user's message; note extraction uncertainty where flagged rather than treating it as verified fact]\n${rendered}`;
}
