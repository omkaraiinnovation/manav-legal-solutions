/**
 * Drafting Agent — Mode B (source docs Part 1 & Section 40; Blueprint 3.4).
 * Generates a document from: facts + jurisdiction + court + procedural law +
 * general law + special act + state law + rules + evidence + precedents +
 * relief — using the document type's mandatory template skeleton.
 */
import type { Matter, DocumentType, Draft } from "@/lib/types";
import { completeText, isLiveMode } from "./model-client";
import { MASTER_SYSTEM_PROMPT, STANDARD_DISCLAIMER, currentDateContext } from "./prompts";
import { runApplicableLawSweep } from "./applicable-law-agent";

export interface DraftGenerationInput {
  matter: Matter;
  documentType: DocumentType;
  variables: Record<string, string>;
}

export interface DraftGenerationResult {
  content: string;
  mode: "live" | "mock";
}

export async function generateDraft(input: DraftGenerationInput): Promise<DraftGenerationResult> {
  const { matter, documentType, variables } = input;
  const sweep = await runApplicableLawSweep(matter.facts, matter.jurisdiction, matter.domains);

  if (isLiveMode()) {
    const context = sweep.rows.map((r) => `- [${r.category}] ${r.law}: ${r.reason}`).join("\n");
    const system = `${currentDateContext()}\n\n${MASTER_SYSTEM_PROMPT}\n\nYou are now in MODE B (Drafting). Generate: ${documentType.name}.
Mandatory sections, in order: ${documentType.templateSkeletonSections.join(" → ")}.
Every substantive legal assertion must cite a specific provision from the sweep below, or be marked [VERIFICATION REQUIRED: Source Not Confirmed]. Output clean Markdown suitable for a court filing draft. End with the standard disclaimer.

[APPLICABLE-LAW SWEEP]\n${context}`;
    const userMsg = `Matter facts: ${matter.facts}\nRelief sought: ${matter.reliefSought ?? "Not specified"}\nJurisdiction: ${JSON.stringify(matter.jurisdiction)}\nVariables provided: ${JSON.stringify(variables, null, 2)}`;
    const content = await completeText({ system, messages: [{ role: "user", content: userMsg }], model: "primary", maxTokens: 3000 });
    return { content, mode: "live" };
  }

  // Deterministic mock mode — assembles the template skeleton with the provided
  // variables and grounded law-sweep rows, flagging any unfilled mandatory field.
  const lines: string[] = [];
  lines.push(`## ${documentType.name}`);
  lines.push(`\n_Matter: ${matter.title}_\n`);
  for (const section of documentType.templateSkeletonSections) {
    lines.push(`### ${section}`);
    const relevantVars = documentType.variableSchema.filter((v) =>
      section.toLowerCase().includes(v.label.toLowerCase().split(" ")[0].toLowerCase())
    );
    if (relevantVars.length) {
      for (const v of relevantVars) {
        const val = variables[v.key];
        lines.push(val ? `${v.label}: ${val}` : `${v.label}: [VERIFICATION REQUIRED: field not yet provided]`);
      }
    } else {
      lines.push(`[Auto-drafted from matter facts: ${matter.facts.slice(0, 220)}${matter.facts.length > 220 ? "…" : ""}]`);
    }
    lines.push("");
  }
  lines.push(`### Applicable Law Referenced`);
  for (const row of sweep.rows.slice(0, 8)) {
    lines.push(`- ${row.law} — ${row.category}${row.verified ? "" : " [VERIFICATION REQUIRED: Source Not Confirmed]"}`);
  }
  lines.push(`\n---\n*${STANDARD_DISCLAIMER}*`);

  return { content: lines.join("\n"), mode: "mock" };
}
