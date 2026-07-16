// Supabase Edge Function: content-generator
//
// Growth Engine / Content Engine module.
// Picks the highest-priority seo_keywords rows that don't yet have a
// content draft, asks Claude to write an SEO-optimized article for
// each, scores the result, and persists it into content_drafts for
// the Dashboard/Approval System.

import Anthropic from "npm:@anthropic-ai/sdk@0.110.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-6";
const DEFAULT_BATCH_SIZE = Number(Deno.env.get("CONTENT_DRAFT_BATCH_SIZE") ?? "3");
const MAX_OUTPUT_TOKENS = 8000;

const TITLE_KEYWORD_POINTS = 20;
const FIRST_100_WORDS_KEYWORD_POINTS = 15;
const KEYWORD_DENSITY_POINTS = 20;
const H2_COUNT_POINTS = 15;
const META_DESCRIPTION_POINTS = 15;
const WORD_COUNT_POINTS = 15;

const MIN_KEYWORD_DENSITY_PERCENT = 0.5;
const MAX_KEYWORD_DENSITY_PERCENT = 2.5;
const MIN_H2_HEADINGS = 3;
const MAX_META_DESCRIPTION_LENGTH = 160;
const MIN_WORD_COUNT = 800;
const MAX_WORD_COUNT = 1200;

interface SeoKeywordRow {
  id: string;
  keyword: string;
  search_volume: number | null;
  difficulty_score: number | null;
  intent: string | null;
  target_country: string | null;
  priority: number | null;
}

interface GeneratedArticle {
  title: string;
  meta_description: string;
  body_markdown: string;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function firstNWords(text: string, n: number): string {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.toLowerCase().split(needle.toLowerCase()).length - 1;
}

function countH2Headings(markdown: string): number {
  return markdown.match(/^##\s+.+$/gm)?.length ?? 0;
}

function buildPrompt(keyword: SeoKeywordRow): string {
  return `You are an SEO content writer for EarnOmni, a USDT-based get-paid-to (GPT) \
earning platform where users earn crypto by watching ads, completing simple \
online tasks, and referring friends.

PLATFORM_FACTS (whenever the article mentions the Lucky Draw / $1 Game or the \
referral commission program, it must stick to exactly these facts — do not \
invent, embellish, or guess any additional details about how these two features \
work beyond what is listed here):

Lucky Draw / $1 Game:
- Entry costs $1, paid from the user's deposit balance.
- Unlimited entries are allowed per user; each entry is a separate ticket.
- The user's plan gives extra tickets per $1 entry: Basic plan = 1 ticket, Silver \
plan = 2 tickets, Gold plan = 4 tickets.
- Each round runs for 7 days.
- The prize is a fixed $100, regardless of how many people entered.
- The winner is selected automatically and randomly — there is no manual or admin \
selection.
- The winner's $100 is credited to their withdrawable earnings balance.

Referral Commission:
- Commission is earned ONLY when a referred user subscribes to a paid plan AND \
the admin approves that subscription request.
- Commission is NOT earned from a referred user watching ads or completing tasks.
- The commission percentage depends on the REFERRER's own plan tier: Basic = 5%, \
Silver = 10%, Gold = 20%.
- Commission amount = the referred user's plan price multiplied by the \
referrer's percentage.
- Do not say commission is earned from deposits or from the referred user simply \
"staying active" — be precise that it requires a plan subscription approved by \
the admin.

For any other EarnOmni feature you mention (watching ads, completing tasks, \
withdrawals, etc.) that isn't covered by PLATFORM_FACTS above, you may describe \
it at a reasonably general level, as you would for any GPT platform.

Write an SEO-optimized blog article targeting the keyword: "${keyword.keyword}"
${keyword.intent ? `Search intent: ${keyword.intent}` : ""}

Requirements:
- Naturally incorporate the target keyword in the title, in the first paragraph, \
in at least one H2 heading, and a few more times throughout the body. Do not \
keyword-stuff.
- Structure: a title, a meta description under 160 characters, an introduction, \
3-5 H2 sections with substantive content, and a conclusion with a call-to-action \
inviting the reader to try EarnOmni.
- Length: 800-1200 words in the body.
- The article must be genuinely relevant and useful, tied back to EarnOmni's \
ad-watching, task-completion, and referral earning model where appropriate.
- Body must be formatted as markdown, using "## " for H2 headings.

Respond with ONLY a single valid JSON object and nothing else - no markdown code \
fences, no commentary before or after. The JSON object must have exactly these keys:
{
  "title": "string",
  "meta_description": "string",
  "body_markdown": "string"
}`;
}

function extractJson(rawText: string): unknown {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    throw new Error("Could not parse JSON from Claude's response");
  }
}

function describeAnthropicError(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    return `Anthropic API error (${error.status ?? "unknown status"}): ${error.message}`;
  }
  if (error instanceof Error) {
    return `Anthropic API call failed: ${error.message}`;
  }
  return `Anthropic API call failed: ${String(error)}`;
}

async function generateArticle(anthropic: Anthropic, keyword: SeoKeywordRow): Promise<GeneratedArticle> {
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: buildPrompt(keyword) }],
    });
  } catch (error) {
    throw new Error(describeAnthropicError(error));
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return any text content");
  }

  const parsed = extractJson(textBlock.text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).title !== "string" ||
    typeof (parsed as Record<string, unknown>).meta_description !== "string" ||
    typeof (parsed as Record<string, unknown>).body_markdown !== "string"
  ) {
    throw new Error("Claude's response JSON is missing required fields");
  }

  const article = parsed as GeneratedArticle;
  return {
    title: article.title.trim(),
    meta_description: article.meta_description.trim(),
    body_markdown: article.body_markdown.trim(),
  };
}

function computeSeoScore(article: GeneratedArticle, keyword: string): { score: number; wordCount: number } {
  let score = 0;

  if (article.title.toLowerCase().includes(keyword.toLowerCase())) {
    score += TITLE_KEYWORD_POINTS;
  }

  const first100Words = firstNWords(article.body_markdown, 100);
  if (first100Words.toLowerCase().includes(keyword.toLowerCase())) {
    score += FIRST_100_WORDS_KEYWORD_POINTS;
  }

  const wordCount = countWords(article.body_markdown);
  const keywordOccurrences = countOccurrences(article.body_markdown, keyword);
  const keywordDensity = wordCount > 0 ? (keywordOccurrences / wordCount) * 100 : 0;
  if (keywordDensity >= MIN_KEYWORD_DENSITY_PERCENT && keywordDensity <= MAX_KEYWORD_DENSITY_PERCENT) {
    score += KEYWORD_DENSITY_POINTS;
  }

  if (countH2Headings(article.body_markdown) >= MIN_H2_HEADINGS) {
    score += H2_COUNT_POINTS;
  }

  if (article.meta_description.length > 0 && article.meta_description.length <= MAX_META_DESCRIPTION_LENGTH) {
    score += META_DESCRIPTION_POINTS;
  }

  if (wordCount >= MIN_WORD_COUNT && wordCount <= MAX_WORD_COUNT) {
    score += WORD_COUNT_POINTS;
  }

  return { score, wordCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!anthropicApiKey) throw new Error("Missing ANTHROPIC_API_KEY secret.");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    const { data: callerProfile } = await supabase.from("profiles").select("is_admin").eq("id", caller.id).single();
    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
    }

    let batchSize = DEFAULT_BATCH_SIZE;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.limit === "number" && body.limit > 0) batchSize = Math.min(Math.floor(body.limit), 10);
      } catch {
        // No/invalid JSON body — fall back to the default batch size.
      }
    }

    const { data: draftedRows, error: draftedError } = await supabase
      .from("content_drafts")
      .select("target_keyword_id")
      .not("target_keyword_id", "is", null);
    if (draftedError) throw new Error(`Failed to load existing content_drafts: ${draftedError.message}`);

    const draftedKeywordIds = Array.from(
      new Set((draftedRows ?? []).map((row) => row.target_keyword_id as string)),
    );

    let keywordQuery = supabase
      .from("seo_keywords")
      .select("id, keyword, search_volume, difficulty_score, intent, target_country, priority")
      .order("priority", { ascending: false })
      .limit(batchSize);

    if (draftedKeywordIds.length > 0) {
      keywordQuery = keywordQuery.not("id", "in", `(${draftedKeywordIds.join(",")})`);
    }

    const { data: keywords, error: keywordsError } = await keywordQuery;
    if (keywordsError) throw new Error(`Failed to load seo_keywords: ${keywordsError.message}`);

    const results: Array<{ keyword: string; title: string; seo_score: number; word_count: number }> = [];
    const failures: Array<{ keyword: string; error: string }> = [];

    for (const keyword of (keywords ?? []) as SeoKeywordRow[]) {
      try {
        const article = await generateArticle(anthropic, keyword);
        const { score, wordCount } = computeSeoScore(article, keyword.keyword);

        const { error: insertError } = await supabase.from("content_drafts").insert({
          title: article.title,
          target_keyword_id: keyword.id,
          body: article.body_markdown,
          seo_score: score,
          status: "draft",
        });
        if (insertError) throw new Error(`Failed to save content draft: ${insertError.message}`);

        results.push({ keyword: keyword.keyword, title: article.title, seo_score: score, word_count: wordCount });
      } catch (error) {
        console.error(`content-generator failed for keyword "${keyword.keyword}":`, error);
        failures.push({
          keyword: keyword.keyword,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        keywordsConsidered: keywords?.length ?? 0,
        draftsGenerated: results.length,
        draftsFailed: failures.length,
        results,
        failures,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("content-generator function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
