/**
 * Judgment-Backed Draft Enhancement (spec §5-7, §11-12): the "Draft
 * Intelligence Engine" — analyzes an actual draft's content, extracts the
 * legal propositions most likely to benefit from judicial authority, then
 * researches each one via the Judgment Research Agent and maps results back
 * to the specific sentence/clause in the draft they'd support.
 *
 * Two-stage pipeline, not a keyword search: stage 1 (a plain LLM call, no
 * web search) identifies WHAT to research from the draft's actual content;
 * stage 2 (the judgment research agent, real web search) finds real
 * judgments for each identified issue. Every result still traces to a real,
 * citable source — this stage only decides what to look for.
 */
import { completeText } from "./model-client";
import { researchJudgments, judgmentResearchAvailable, type JudgmentResult } from "./judgment-research-agent";

export interface DraftLegalIssue {
  issue: string;
  actSectionContext?: string;
  draftExcerpt: string;
}

export interface JudgmentEnhancementSuggestion {
  issue: DraftLegalIssue;
  judgments: JudgmentResult[];
  summary: string;
}

export interface JudgmentEnhancementReport {
  issuesAnalyzed: DraftLegalIssue[];
  suggestions: JudgmentEnhancementSuggestion[];
}

const MAX_ISSUES = 3;

export async function runJudgmentEnhancementReview(draftContent: string, jurisdictionState?: string): Promise<JudgmentEnhancementReport> {
  if (!judgmentResearchAvailable()) {
    throw new Error("Judicial enhancement review requires ANTHROPIC_API_KEY — it uses Claude's web search tool.");
  }
  if (!draftContent.trim()) {
    throw new Error("This draft has no content to analyze yet.");
  }

  const extractionSystem = `You analyze an Indian legal draft to identify the propositions that would most benefit from citing Supreme Court/High Court authority. Output STRICT JSON only, no markdown fences, no commentary: {"issues":[{"issue":"one-sentence legal proposition or issue stated or implied in the draft","actSectionContext":"the Act/Section this relates to, if identifiable from the draft — omit the field if none","draftExcerpt":"the exact sentence or clause from the draft this comes from, quoted verbatim"}]}. Extract at most ${MAX_ISSUES} issues — the ones most central to the draft's legal argument and most likely to be strengthened by a citation. If the draft is too short or thin to identify distinct issues, return fewer, even zero.`;

  const extractionRaw = await completeText({
    system: extractionSystem,
    messages: [{ role: "user", content: draftContent.slice(0, 12000) }],
    model: "primary",
    maxTokens: 1200,
  });

  let issues: DraftLegalIssue[];
  try {
    const parsed = JSON.parse(extractJson(extractionRaw));
    issues = (Array.isArray(parsed.issues) ? parsed.issues : [])
      .filter((i: any) => i && typeof i.issue === "string" && i.issue.trim())
      .map((i: any) => ({
        issue: i.issue.trim(),
        actSectionContext: typeof i.actSectionContext === "string" && i.actSectionContext.trim() ? i.actSectionContext.trim() : undefined,
        draftExcerpt: typeof i.draftExcerpt === "string" ? i.draftExcerpt.trim() : "",
      }))
      .slice(0, MAX_ISSUES);
  } catch {
    throw new Error("Could not identify legal issues from this draft to research — it may be too short or in an unexpected format.");
  }

  if (issues.length === 0) {
    return { issuesAnalyzed: [], suggestions: [] };
  }

  // Researched concurrently, each with a reduced search budget, so the combined
  // pipeline fits inside one serverless function's time limit.
  const perIssueSearches = issues.length > 2 ? 3 : 4;
  const suggestions = await Promise.all(
    issues.map(async (issue): Promise<JudgmentEnhancementSuggestion> => {
      try {
        const result = await researchJudgments({ query: issue.issue, jurisdictionState, actContext: issue.actSectionContext, maxSearches: perIssueSearches });
        return { issue, judgments: result.judgments, summary: result.summary };
      } catch (err) {
        return { issue, judgments: [], summary: err instanceof Error ? err.message : "Research failed for this issue." };
      }
    })
  );

  return { issuesAnalyzed: issues, suggestions };
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}
