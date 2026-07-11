// Supabase Edge Function: social-design-generator
//
// Growth Engine / Social Media Design Engine module.
// Picks the latest content_drafts (draft or approved) that don't yet
// have designs for every platform, asks Claude to write a detailed,
// designer-ready image-generation prompt per platform size, and
// persists them into social_designs for the Dashboard/Approval System.

import Anthropic from "npm:@anthropic-ai/sdk@0.110.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-sonnet-4-6";
const DEFAULT_BATCH_SIZE = Number(Deno.env.get("SOCIAL_DESIGN_BATCH_SIZE") ?? "3");
const MAX_OUTPUT_TOKENS = 4000;
const EXCERPT_WORD_COUNT = 150;
const MIN_PROMPT_LENGTH = 80;

// platform column values stored on social_designs / used as the JSON keys Claude must return.
const PLATFORM_SIZES = {
  instagram: { label: "Instagram Square", width: 1080, height: 1080 },
  facebook: { label: "Facebook Feed", width: 1200, height: 628 },
  twitter: { label: "Twitter/X", width: 1600, height: 900 },
} as const;

type Platform = keyof typeof PLATFORM_SIZES;
const PLATFORMS = Object.keys(PLATFORM_SIZES) as Platform[];

interface ContentDraftRow {
  id: string;
  title: string;
  body: string | null;
  seo_keywords: { keyword: string } | { keyword: string }[] | null;
}

type DesignPrompts = Record<Platform, string>;

const BRANDING_GUIDELINES = `
EARNOMNI BRAND SPECIFICATIONS (Use in all social designs):

COLORS - Use exact hex codes:
- Background: #1B0A17 (Void Indigo - dark, never pure black)
- Primary Accent: #6570FF (Signal Violet)
- Secondary Accent: #7C3AED (Deep Amethyst)
- Text/Foreground: #F3F4FC (high contrast white-ish)
- Error/Destructive Only: #F52027 (Alert Red - never for accents)

GRADIENTS:
- Hero Gradient: linear-gradient 135deg from #6570ff to #742ad9
- Glow Shadow (primary CTA only): box-shadow 0 18px 40px -18px rgba(181, 112, 255, 0.4)

LOGO & BRANDING:
- Include EarnOmni app icon (E mark in purple/violet, rounded square)
- Use full lockup with wordmark "EarnOmni" if space allows
- Logo should be prominent, not small

TYPOGRAPHY:
- Headlines: Bold, modern sans-serif (Sora-style or similar)
- Body: Clean, readable sans-serif (system fonts)
- Ensure high contrast for mobile readability
- No pure black text - use #F3F4FC on dark backgrounds

UI ELEMENTS:
- Border radius: 12-24px for rounded corners
- Primary CTA button: Gradient fill (#6570ff→#742ad9) + glow shadow
- Secondary buttons: Solid color, no gradient
- Dark theme: #1B0A17 background, never #000000

DESIGN AESTHETIC:
- Modern, professional, trustworthy crypto/fintech vibe
- Crypto theme elements welcome: coins, charts, growth indicators, USDT mentions
- Clean composition, high contrast
- Fully-rounded design (no sharp corners)

PLATFORM-SPECIFIC:
- Instagram (1080x1080): Square format, centered logo, bold text
- Facebook (1200x628): Landscape, left-text + right-visual split layout
- Twitter (1600x900): Wide format, bold messaging, quick readability
`;

// Shared with content-generator's and ads-intelligence's prompts — keep these
// in sync if the underlying platform mechanics ever change.
const PLATFORM_FACTS = `PLATFORM_FACTS (whenever a design prompt references the Lucky Draw / $1 \
Game or the referral commission program, it must stick to exactly these facts \
— do not invent, embellish, or guess any additional details about how these \
two features work beyond what is listed here):

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

For any other EarnOmni feature you reference (watching ads, completing tasks, \
withdrawals, etc.) that isn't covered by PLATFORM_FACTS above, describe it at a \
reasonably general level, as you would for any GPT platform.`;

function excerpt(body: string | null, wordCount: number): string {
  if (!body) return "";
  return body.trim().split(/\s+/).filter(Boolean).slice(0, wordCount).join(" ");
}

function extractKeyword(row: ContentDraftRow): string | null {
  const joined = row.seo_keywords;
  if (!joined) return null;
  const single = Array.isArray(joined) ? joined[0] : joined;
  return single?.keyword?.trim() || null;
}

function buildPrompt(draft: ContentDraftRow, keyword: string | null): string {
  return `You are a senior brand designer briefing document writer for EarnOmni, \
a USDT-based get-paid-to (GPT) earning platform where users earn crypto by \
watching ads, completing simple online tasks, and referring friends.

${BRANDING_GUIDELINES}

${PLATFORM_FACTS}

Do NOT invent fake statistics, fake user counts, fake testimonials, or any other \
unverifiable claims.

Source article:
Title: "${draft.title}"
${keyword ? `Target keyword: "${keyword}"` : ""}
Excerpt: """${excerpt(draft.body, EXCERPT_WORD_COUNT)}"""

Write three DETAILED, standalone image-generation prompts — the exact kind of \
brief you would hand a professional graphic designer, or paste directly into \
an AI image tool like Canva AI or Google Nano Banana — to turn this article \
into promotional social media graphics. Write one prompt for each of these \
exact platform sizes:

1. instagram — Instagram Square, ${PLATFORM_SIZES.instagram.width}x${PLATFORM_SIZES.instagram.height}px
2. facebook — Facebook Feed, ${PLATFORM_SIZES.facebook.width}x${PLATFORM_SIZES.facebook.height}px
3. twitter — Twitter/X, ${PLATFORM_SIZES.twitter.width}x${PLATFORM_SIZES.twitter.height}px

Each prompt MUST:
- State the exact canvas size in pixels for that platform.
- Reference the article's title or core key message so the design is clearly tied to it.
- Mention EarnOmni branding: it is a USDT (crypto) earning platform where users \
earn money by watching ads, completing tasks, and referring friends.
- Specify a visual style: modern, professional, trustworthy, bold accent colors, \
a crypto/fintech aesthetic (e.g. subtle coin/USDT iconography, clean sans-serif \
typography, dark or high-contrast background with a vivid accent color).
- Specify concrete composition details: headline text to overlay, where it sits, \
any supporting icons/graphics, and a color palette (e.g. specific hex codes or \
named colors).
- Include a clear call-to-action line to render on the graphic (e.g. "Start Earning \
USDT Today" or similar, adapted to the article's topic).
- Be a single dense paragraph of 4-8 sentences, detailed enough that an AI image \
generator or human designer could produce a polished result without asking \
follow-up questions.
- Be tailored to that platform's aspect ratio (e.g. the Instagram square prompt \
should describe a centered, symmetrical layout; the Facebook and Twitter \
landscape prompts should describe a layout that uses the wider canvas, such as \
text on one side and imagery on the other).
- End with this exact sentence, verbatim: "Apply exact EarnOmni branding from \
guidelines: use #1B0A17 background, #6570FF accent, include logo, gradient CTA \
button with glow effect, Sora-style bold headlines, high contrast text #F3F4FC."

Respond with ONLY a single valid JSON object and nothing else - no markdown code \
fences, no commentary before or after. The JSON object must have exactly these keys:
{
  "instagram": "string",
  "facebook": "string",
  "twitter": "string"
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
  // Some SDK/network failure paths reject with a plain object shaped like
  // { error: { message, type } } instead of an Error/APIError instance —
  // guard for that shape explicitly rather than reading `.error` off it
  // unchecked further downstream.
  if (typeof error === "object" && error !== null && "error" in error) {
    const nested = (error as Record<string, unknown>).error;
    if (typeof nested === "object" && nested !== null && "message" in nested) {
      return `Anthropic API call failed: ${String((nested as Record<string, unknown>).message)}`;
    }
  }
  return `Anthropic API call failed: ${String(error)}`;
}

function normalizeDesignPrompts(raw: unknown): DesignPrompts {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Claude's response is not a JSON object");
  }
  const record = raw as Record<string, unknown>;

  const prompts = {} as DesignPrompts;
  for (const platform of PLATFORMS) {
    const value = record[platform];
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length < MIN_PROMPT_LENGTH) {
      throw new Error(`Claude's response is missing a usable "${platform}" design prompt`);
    }
    prompts[platform] = text;
  }
  return prompts;
}

async function generateDesignPrompts(
  anthropic: Anthropic,
  draft: ContentDraftRow,
  keyword: string | null,
): Promise<DesignPrompts> {
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: buildPrompt(draft, keyword) }],
    });
  } catch (error) {
    throw new Error(describeAnthropicError(error));
  }

  if (!response || !Array.isArray(response.content)) {
    throw new Error("Anthropic API returned an unexpected response shape");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return any text content");
  }

  return normalizeDesignPrompts(extractJson(textBlock.text));
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

    const { data: designRows, error: designRowsError } = await supabase
      .from("social_designs")
      .select("content_draft_id, platform")
      .not("content_draft_id", "is", null);
    if (designRowsError) throw new Error(`Failed to load existing social_designs: ${designRowsError.message}`);

    const platformsByDraftId = new Map<string, Set<string>>();
    for (const row of designRows ?? []) {
      const draftId = row.content_draft_id as string;
      const platforms = platformsByDraftId.get(draftId) ?? new Set<string>();
      platforms.add(row.platform as string);
      platformsByDraftId.set(draftId, platforms);
    }

    const fullyCoveredDraftIds = Array.from(platformsByDraftId.entries())
      .filter(([, platforms]) => PLATFORMS.every((platform) => platforms.has(platform)))
      .map(([draftId]) => draftId);

    let draftQuery = supabase
      .from("content_drafts")
      .select("id, title, body, seo_keywords(keyword)")
      .in("status", ["draft", "approved"])
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (fullyCoveredDraftIds.length > 0) {
      draftQuery = draftQuery.not("id", "in", `(${fullyCoveredDraftIds.join(",")})`);
    }

    const { data: drafts, error: draftsError } = await draftQuery;
    if (draftsError) throw new Error(`Failed to load content_drafts: ${draftsError.message}`);

    const results: Array<{ content_draft_id: string; title: string; platforms: Platform[] }> = [];
    const failures: Array<{ content_draft_id: string; title: string; error: string }> = [];
    let promptsGenerated = 0;

    for (const draft of (drafts ?? []) as ContentDraftRow[]) {
      try {
        const keyword = extractKeyword(draft);
        const prompts = await generateDesignPrompts(anthropic, draft, keyword);

        const { error: insertError } = await supabase.from("social_designs").insert(
          PLATFORMS.map((platform) => ({
            content_draft_id: draft.id,
            design_type: PLATFORM_SIZES[platform].label,
            platform,
            image_url: null,
            status: "draft",
            campaign_data: {
              platform_size: `${PLATFORM_SIZES[platform].width}x${PLATFORM_SIZES[platform].height}`,
              prompt_text: prompts[platform],
              target_keywords: keyword ? [keyword] : [],
            },
          })),
        );
        if (insertError) throw new Error(`Failed to save social designs: ${insertError.message}`);

        promptsGenerated += PLATFORMS.length;
        results.push({ content_draft_id: draft.id, title: draft.title, platforms: PLATFORMS });
      } catch (error) {
        console.error(`social-design-generator failed for content draft "${draft.title}":`, error);
        failures.push({
          content_draft_id: draft.id,
          title: draft.title,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        contentProcessed: (drafts ?? []).length,
        promptsGenerated,
        results,
        failures,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("social-design-generator function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
