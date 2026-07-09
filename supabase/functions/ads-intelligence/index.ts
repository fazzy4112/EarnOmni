// Supabase Edge Function: ads-intelligence
//
// Growth Engine / Ads Intelligence Engine module.
// Picks the highest-priority seo_keywords rows, asks Claude to draft a
// Google Ads + Meta Ads campaign brief for each, and persists them as
// two rows (one per platform) into ad_campaign_briefs for the
// Dashboard/Approval System and, later, the Social Design Engine.

import Anthropic from "npm:@anthropic-ai/sdk@0.110.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-6";
const DEFAULT_BATCH_SIZE = Number(Deno.env.get("ADS_INTELLIGENCE_BATCH_SIZE") ?? "5");
const MAX_OUTPUT_TOKENS = 8000;

const GOOGLE_HEADLINE_MAX_LENGTH = 30;
const GOOGLE_DESCRIPTION_MAX_LENGTH = 90;
const GOOGLE_MAX_AD_COPY_VARIATIONS = 5;
const META_MAX_AD_COPY_VARIATIONS = 3;
const VALID_MATCH_TYPES = new Set(["broad", "phrase", "exact"]);

interface SeoKeywordRow {
  id: string;
  keyword: string;
  search_volume: number | null;
  difficulty_score: number | null;
  intent: string | null;
  target_country: string | null;
  priority: number | null;
}

interface GoogleAdsCopyVariation {
  headline: string;
  description: string;
}

interface GoogleAdsBrief {
  ad_group_name: string;
  ad_copy_variations: GoogleAdsCopyVariation[];
  match_types: { type: string; reasoning: string }[];
  daily_budget_usd: { min: number; max: number; reasoning: string };
}

interface MetaAdsCopyVariation {
  primary_text: string;
  headline: string;
}

interface MetaAdsBrief {
  audience_targeting: { age_range: string; interests: string[]; geographic_focus: string };
  ad_copy_variations: MetaAdsCopyVariation[];
  creative_direction: string;
}

interface CampaignBrief {
  google_ads: GoogleAdsBrief;
  meta_ads: MetaAdsBrief;
}

// Shared with content-generator's prompt — keep these two in sync if the
// underlying platform mechanics ever change.
const PLATFORM_FACTS = `PLATFORM_FACTS (whenever the brief mentions the Lucky Draw / $1 Game or the \
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
it at a reasonably general level, as you would for any GPT platform.`;

function buildPrompt(keyword: SeoKeywordRow): string {
  const country = keyword.target_country || "US";
  return `You are a performance marketing strategist for EarnOmni, a USDT-based \
get-paid-to (GPT) earning platform where users earn crypto by watching ads, \
completing simple online tasks, and referring friends.

${PLATFORM_FACTS}

Do NOT invent fake statistics, fake user counts, fake testimonials, or any other \
unverifiable claims. Every claim in the ad copy must be a plain, honest \
description of how the platform works.

Write a Google Ads + Meta Ads campaign brief targeting the keyword: \
"${keyword.keyword}"
${keyword.intent ? `Search intent: ${keyword.intent}` : ""}
Target country: ${country}

Google Ads requirements:
- A suggested ad group name.
- 3-5 ad copy variations, each with a "headline" (STRICT max ${GOOGLE_HEADLINE_MAX_LENGTH} \
characters) and a "description" (STRICT max ${GOOGLE_DESCRIPTION_MAX_LENGTH} characters).
- Suggested match types for this keyword (choose from "broad", "phrase", "exact"), \
each with a short reasoning.
- A suggested daily budget range in USD (min and max) with reasoning.

Meta Ads requirements:
- Suggested audience targeting: an age range, a list of interests, and a \
geographic focus based on the target country (${country}).
- 2-3 ad copy variations suited for Facebook/Instagram feed format, each with a \
"primary_text" (main body copy) and a short "headline".
- A creative direction note describing what kind of visual or video would work \
well for this ad, to hand off to a design team.

Respond with ONLY a single valid JSON object and nothing else - no markdown code \
fences, no commentary before or after. The JSON object must have exactly this shape:
{
  "google_ads": {
    "ad_group_name": "string",
    "ad_copy_variations": [{ "headline": "string", "description": "string" }],
    "match_types": [{ "type": "broad | phrase | exact", "reasoning": "string" }],
    "daily_budget_usd": { "min": number, "max": number, "reasoning": "string" }
  },
  "meta_ads": {
    "audience_targeting": { "age_range": "string", "interests": ["string"], "geographic_focus": "string" },
    "ad_copy_variations": [{ "primary_text": "string", "headline": "string" }],
    "creative_direction": "string"
  }
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

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const hardCut = trimmed.slice(0, maxLength);
  const lastSpaceIndex = hardCut.lastIndexOf(" ");
  if (lastSpaceIndex === -1) {
    // No word boundary within the limit — the word itself exceeds it, hard-cut as a last resort.
    return hardCut;
  }
  return hardCut.slice(0, lastSpaceIndex);
}

function normalizeBrief(raw: unknown, keyword: SeoKeywordRow): CampaignBrief {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Claude's response is not a JSON object");
  }
  const { google_ads: googleAdsRaw, meta_ads: metaAdsRaw } = raw as Record<string, unknown>;
  if (typeof googleAdsRaw !== "object" || googleAdsRaw === null) {
    throw new Error("Claude's response is missing a valid google_ads object");
  }
  if (typeof metaAdsRaw !== "object" || metaAdsRaw === null) {
    throw new Error("Claude's response is missing a valid meta_ads object");
  }

  const googleAds = googleAdsRaw as Record<string, unknown>;
  const adCopyRaw = Array.isArray(googleAds.ad_copy_variations) ? googleAds.ad_copy_variations : [];
  const adCopyVariations: GoogleAdsCopyVariation[] = adCopyRaw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      headline: truncate(String(item.headline ?? ""), GOOGLE_HEADLINE_MAX_LENGTH),
      description: truncate(String(item.description ?? ""), GOOGLE_DESCRIPTION_MAX_LENGTH),
    }))
    .filter((item) => item.headline.length > 0 && item.description.length > 0)
    .slice(0, GOOGLE_MAX_AD_COPY_VARIATIONS);
  if (adCopyVariations.length === 0) {
    throw new Error("Claude's response has no usable Google Ads copy variations");
  }

  const matchTypesRaw = Array.isArray(googleAds.match_types) ? googleAds.match_types : [];
  const matchTypes = matchTypesRaw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({ type: String(item.type ?? "").toLowerCase(), reasoning: String(item.reasoning ?? "") }))
    .filter((item) => VALID_MATCH_TYPES.has(item.type));
  if (matchTypes.length === 0) {
    throw new Error("Claude's response has no valid Google Ads match types");
  }

  const budgetRaw = googleAds.daily_budget_usd;
  if (typeof budgetRaw !== "object" || budgetRaw === null) {
    throw new Error("Claude's response is missing a valid daily_budget_usd object");
  }
  const budget = budgetRaw as Record<string, unknown>;
  const budgetMin = Number(budget.min);
  const budgetMax = Number(budget.max);
  if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax)) {
    throw new Error("Claude's response has a non-numeric daily_budget_usd range");
  }

  const metaAds = metaAdsRaw as Record<string, unknown>;
  const audienceRaw = metaAds.audience_targeting;
  if (typeof audienceRaw !== "object" || audienceRaw === null) {
    throw new Error("Claude's response is missing a valid audience_targeting object");
  }
  const audience = audienceRaw as Record<string, unknown>;
  const interests = Array.isArray(audience.interests)
    ? audience.interests.map((i) => String(i)).filter((i) => i.trim().length > 0)
    : [];

  const metaCopyRaw = Array.isArray(metaAds.ad_copy_variations) ? metaAds.ad_copy_variations : [];
  const metaCopyVariations: MetaAdsCopyVariation[] = metaCopyRaw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      primary_text: String(item.primary_text ?? "").trim(),
      headline: String(item.headline ?? "").trim(),
    }))
    .filter((item) => item.primary_text.length > 0 && item.headline.length > 0)
    .slice(0, META_MAX_AD_COPY_VARIATIONS);
  if (metaCopyVariations.length === 0) {
    throw new Error("Claude's response has no usable Meta Ads copy variations");
  }

  const creativeDirection = String(metaAds.creative_direction ?? "").trim();
  if (!creativeDirection) {
    throw new Error("Claude's response is missing a creative_direction note");
  }

  return {
    google_ads: {
      ad_group_name: String(googleAds.ad_group_name ?? "").trim() || `${keyword.keyword} - EarnOmni`,
      ad_copy_variations: adCopyVariations,
      match_types: matchTypes,
      daily_budget_usd: {
        min: Math.min(budgetMin, budgetMax),
        max: Math.max(budgetMin, budgetMax),
        reasoning: String(budget.reasoning ?? "").trim(),
      },
    },
    meta_ads: {
      audience_targeting: {
        age_range: String(audience.age_range ?? "").trim() || "18-45",
        interests,
        geographic_focus: String(audience.geographic_focus ?? "").trim() || keyword.target_country || "US",
      },
      ad_copy_variations: metaCopyVariations,
      creative_direction: creativeDirection,
    },
  };
}

async function generateBrief(anthropic: Anthropic, keyword: SeoKeywordRow): Promise<CampaignBrief> {
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

  return normalizeBrief(extractJson(textBlock.text), keyword);
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

    let batchSize = DEFAULT_BATCH_SIZE;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.limit === "number" && body.limit > 0) batchSize = Math.floor(body.limit);
      } catch {
        // No/invalid JSON body — fall back to the default batch size.
      }
    }

    const { data: briefRows, error: briefRowsError } = await supabase
      .from("ad_campaign_briefs")
      .select("target_keyword_id, platform")
      .not("target_keyword_id", "is", null);
    if (briefRowsError) throw new Error(`Failed to load existing ad_campaign_briefs: ${briefRowsError.message}`);

    const platformsByKeywordId = new Map<string, Set<string>>();
    for (const row of briefRows ?? []) {
      const keywordId = row.target_keyword_id as string;
      const platforms = platformsByKeywordId.get(keywordId) ?? new Set<string>();
      platforms.add(row.platform as string);
      platformsByKeywordId.set(keywordId, platforms);
    }

    const fullyCoveredKeywordIds = Array.from(platformsByKeywordId.entries())
      .filter(([, platforms]) => platforms.has("google_ads") && platforms.has("meta_ads"))
      .map(([keywordId]) => keywordId);

    let keywordQuery = supabase
      .from("seo_keywords")
      .select("id, keyword, search_volume, difficulty_score, intent, target_country, priority")
      .order("priority", { ascending: false })
      .limit(batchSize);

    if (fullyCoveredKeywordIds.length > 0) {
      keywordQuery = keywordQuery.not("id", "in", `(${fullyCoveredKeywordIds.join(",")})`);
    }

    const { data: keywords, error: keywordsError } = await keywordQuery;
    if (keywordsError) throw new Error(`Failed to load seo_keywords: ${keywordsError.message}`);

    const results: Array<{ keyword: string; ad_group_name: string; creative_direction: string }> = [];
    const failures: Array<{ keyword: string; error: string }> = [];

    for (const keyword of (keywords ?? []) as SeoKeywordRow[]) {
      try {
        const brief = await generateBrief(anthropic, keyword);

        const { error: insertError } = await supabase.from("ad_campaign_briefs").insert([
          {
            platform: "google_ads",
            target_keyword_id: keyword.id,
            campaign_data: { keyword: keyword.keyword, ...brief.google_ads },
            status: "draft",
          },
          {
            platform: "meta_ads",
            target_keyword_id: keyword.id,
            campaign_data: { keyword: keyword.keyword, ...brief.meta_ads },
            status: "draft",
          },
        ]);
        if (insertError) throw new Error(`Failed to save ad campaign briefs: ${insertError.message}`);

        results.push({
          keyword: keyword.keyword,
          ad_group_name: brief.google_ads.ad_group_name,
          creative_direction: brief.meta_ads.creative_direction,
        });
      } catch (error) {
        console.error(`ads-intelligence failed for keyword "${keyword.keyword}":`, error);
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
        briefsGenerated: results.length,
        briefsFailed: failures.length,
        results,
        failures,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("ads-intelligence function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
