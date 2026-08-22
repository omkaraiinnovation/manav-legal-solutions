/**
 * Judgment Intelligence Agent — Supreme Court + High Court research (spec
 * §1-4, §14-19 of the judicial-intelligence spec).
 *
 * Architecture note (important): this does NOT scrape court websites, and it
 * does not call a separate search API. It uses Anthropic's server-side
 * `web_search` tool — Claude decides what to search, the search itself runs
 * inside Anthropic's infrastructure (Brave Search under the hood), and
 * real results with real URLs come back with citations. That satisfies
 * spec §16 ("no blind web scraping... prefer an API/permitted access
 * method") using the access method actually available to this app: the
 * same Anthropic API key already configured for the AI layer, no new
 * credential needed. It bills per-search on top of normal token costs
 * (see Anthropic's pricing) — this agent caps usage via `max_uses`.
 *
 * Deliberately NOT built: automated overruled/distinguished/modified
 * detection (spec §9) or a "legal evolution chain" (§10). Those need a real
 * citation graph (SCC Online / Manupatra / a paid Indian Kanoon API) that
 * this deployment does not have. Claiming a precedent's current validity
 * without one would be a fabrication risk this platform exists to avoid —
 * every result instead carries an explicit, unconditional reminder that its
 * current validity has not been independently verified.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/env";

export type CourtTier = "supreme_court" | "high_court" | "tribunal" | "other";
export type JudgmentStance = "supports" | "weakens" | "contextual" | "unclear";

export interface JudgmentResult {
  caseTitle: string;
  courtTier: CourtTier;
  courtName: string;
  dateText?: string;
  citation?: string;
  sourceUrl: string;
  sourceTitle: string;
  isOfficialSource: boolean;
  extract: string;
  relevanceExplanation: string;
  relevantTo?: string;
  stance: JudgmentStance;
}

export interface JudgmentResearchResult {
  summary: string;
  judgments: JudgmentResult[];
  verifiedSourceUrls: string[]; // URLs Claude's web_search tool actually returned citations for
  searchesUsed: number;
  modelUsed: string;
}

export class JudgmentResearchError extends Error {}

function webSearchTool(maxUses: number): Anthropic.WebSearchTool20250305 {
  return { type: "web_search_20250305", name: "web_search", max_uses: maxUses, user_location: { type: "approximate", country: "IN" } };
}

const TIER_ORDER: Record<CourtTier, number> = { supreme_court: 0, high_court: 1, tribunal: 2, other: 3 };

export function judgmentResearchAvailable(): boolean {
  return !!getAnthropicApiKey();
}

const DEFAULT_MAX_SEARCHES = 5; // each search is a sequential round-trip inside one Anthropic turn — kept low enough to fit a 60s serverless function

export async function researchJudgments(opts: { query: string; jurisdictionState?: string; actContext?: string; maxSearches?: number }): Promise<JudgmentResearchResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new JudgmentResearchError("Judgment research requires ANTHROPIC_API_KEY — it uses Claude's built-in web search tool, not a separate credential. Set it to enable this feature.");
  }
  const client = new Anthropic({ apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const jurisdictionNote = opts.jurisdictionState
    ? `The matter's jurisdiction is ${opts.jurisdictionState}, India. Prioritize Supreme Court authority and the ${opts.jurisdictionState} High Court; note persuasive judgments from other High Courts only where genuinely useful.`
    : "No specific state jurisdiction was given for this research — search Pan-India and flag which court each result is from.";

  const system = `You are the Judicial Research engine of an Indian legal paralegal platform. Today's date is ${today} — use it for any recency judgment. Use the web_search tool to find REAL, CURRENT Indian Supreme Court and High Court judgments relevant to the research topic given by the user. ${jurisdictionNote}

Search strategy:
- Run separate searches for: (1) Supreme Court authority on this issue, (2) the relevant High Court's position, (3) the most recently published judgments on this issue, (4) any landmark/leading precedent if this area of law has an established one.
- Prefer official sources (sci.gov.in, a High Court's .gov.in/.nic.in domain) and reputable Indian legal-research platforms (indiankanoon.org, livelaw.in, verdictum.in, barandbench.com) over generic pages.
- A judgment is only usable if you can identify, from an actual search result, the case name and court. Never invent a case name, date, or citation that did not appear in your search results — omit a field rather than guess at it.

After searching, output STRICT JSON only — no markdown fences, no commentary before or after — matching exactly this shape:
{
  "summary": "2-4 sentence plain-language synthesis of the current judicial landscape on this issue: Supreme Court position first, then the relevant High Court position, noting explicitly which is binding and which is persuasive",
  "judgments": [
    {
      "caseTitle": "exact case name as found in the source",
      "courtTier": "supreme_court" | "high_court" | "tribunal" | "other",
      "courtName": "e.g. Supreme Court of India / Patna High Court",
      "dateText": "date as stated in the source (omit the field entirely if not found — do not write 'unknown')",
      "citation": "citation as stated in the source (omit the field entirely if not found)",
      "sourceUrl": "the exact URL of the search result this came from",
      "sourceTitle": "the page title from the search result",
      "extract": "a short, near-verbatim quote or close paraphrase of what the source actually says — never invented",
      "relevanceExplanation": "why this judgment matters to the research topic",
      "relevantTo": "which aspect of the topic/issue this specifically addresses",
      "stance": "supports" | "weakens" | "contextual" | "unclear"
    }
  ]
}

Rules:
- Only include judgments you actually found via web_search in this session — every sourceUrl must be a real URL from your search results, never fabricated.
- Include both recent judgments AND landmark/foundational ones where relevant — do not return only the newest results.
- Do not state or imply whether an older judgment has been overruled, distinguished, or is still good law unless a search result explicitly says so — if you cannot verify current validity, do not claim it either way.
- Extract at most 10 judgments, prioritizing genuine relevance and precedential weight over quantity.
- If your searches found nothing genuinely relevant, return an empty "judgments" array and say so honestly in "summary" rather than padding the list with tangential results.`;

  const userContent = `Research topic: ${opts.query}${opts.actContext ? `\nRelevant statute/section: ${opts.actContext}` : ""}`;

  let response;
  try {
    response = await client.messages.create({
      model: process.env.MLS_MODEL_PRIMARY_ANTHROPIC || "claude-sonnet-5",
      max_tokens: 6000,
      system,
      messages: [{ role: "user", content: userContent }],
      tools: [webSearchTool(opts.maxSearches ?? DEFAULT_MAX_SEARCHES)],
      // Explicitly disabled — this model defaults to adaptive extended thinking,
      // which interleaves "thinking" blocks between each search round. Across a
      // multi-search tool-use loop that burns through max_tokens fast, leaving
      // nothing for the final JSON (confirmed in production: stop_reason
      // "max_tokens" with the last block cut off mid-"thinking", never reaching
      // a text block at all). Same root cause as the earlier consultation-chat
      // empty-reply bug — this call bypasses the shared completeText() wrapper
      // (it needs the web_search tool, which that wrapper doesn't support) so
      // it needed the same fix applied directly.
      thinking: { type: "disabled" },
    });
  } catch (err) {
    throw new JudgmentResearchError(`Judicial research failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  const verifiedSourceUrls = new Set<string>();
  let searchesUsed = 0;
  let finalText = "";
  for (const block of response.content) {
    if (block.type === "server_tool_use" && block.name === "web_search") searchesUsed++;
    if (block.type === "text") {
      finalText += block.text;
      for (const citation of block.citations ?? []) {
        if (citation.type === "web_search_result_location") verifiedSourceUrls.add(citation.url);
      }
    }
  }

  if (!finalText.trim()) {
    throw new JudgmentResearchError("Judicial research produced no output — this can happen if web search is disabled for this API key/organization, or the request was interrupted mid-search. Please try again.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(extractJson(finalText));
  } catch (parseErr) {
    // Diagnostic only — never logs the full finalText (could contain user-supplied
    // matter facts), just enough to tell "truncated mid-JSON" from "not JSON at all".
    console.error(
      "[judgment-research] Could not parse final text as JSON.",
      JSON.stringify({
        stopReason: response.stop_reason,
        finalTextLength: finalText.length,
        finalTextStart: finalText.slice(0, 200),
        finalTextEnd: finalText.slice(-200),
        parseErrorMessage: parseErr instanceof Error ? parseErr.message : String(parseErr),
        contentBlockTypes: response.content.map((b) => b.type),
      })
    );
    throw new JudgmentResearchError("The judicial research response could not be parsed as structured data. Please try again — this can happen with unusually broad research topics.");
  }

  const judgments: JudgmentResult[] = (Array.isArray(parsed.judgments) ? parsed.judgments : [])
    .filter((j: any) => j && typeof j.caseTitle === "string" && j.caseTitle.trim() && typeof j.sourceUrl === "string" && j.sourceUrl.trim())
    .map((j: any): JudgmentResult => ({
      caseTitle: j.caseTitle.trim(),
      courtTier: (["supreme_court", "high_court", "tribunal", "other"] as const).includes(j.courtTier) ? j.courtTier : "other",
      courtName: typeof j.courtName === "string" && j.courtName.trim() ? j.courtName.trim() : "Court not specified",
      dateText: typeof j.dateText === "string" && j.dateText.trim() ? j.dateText.trim() : undefined,
      citation: typeof j.citation === "string" && j.citation.trim() ? j.citation.trim() : undefined,
      sourceUrl: j.sourceUrl.trim(),
      sourceTitle: typeof j.sourceTitle === "string" && j.sourceTitle.trim() ? j.sourceTitle.trim() : j.sourceUrl,
      isOfficialSource: isOfficialDomain(j.sourceUrl),
      extract: typeof j.extract === "string" ? j.extract.trim() : "",
      relevanceExplanation: typeof j.relevanceExplanation === "string" ? j.relevanceExplanation.trim() : "",
      relevantTo: typeof j.relevantTo === "string" && j.relevantTo.trim() ? j.relevantTo.trim() : undefined,
      stance: (["supports", "weakens", "contextual", "unclear"] as const).includes(j.stance) ? j.stance : "unclear",
    }))
    .slice(0, 10)
    .sort((a: JudgmentResult, b: JudgmentResult) => TIER_ORDER[a.courtTier] - TIER_ORDER[b.courtTier]);

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    judgments,
    verifiedSourceUrls: Array.from(verifiedSourceUrls),
    searchesUsed,
    modelUsed: "anthropic-web-search",
  };
}

function isOfficialDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /\.gov\.in$|\.nic\.in$/i.test(host);
  } catch {
    return false;
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}
