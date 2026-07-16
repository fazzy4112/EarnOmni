// Supabase Edge Function: seo-research
//
// Growth Engine / Research Engine module.
// Pulls Google Search Console performance data for earnomni.com,
// mines it for opportunity keywords, and persists the results into
// public.seo_keywords for the Content and Ads Intelligence engines
// to consume downstream.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GSC_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GSC_SITE_URL = Deno.env.get("GSC_SITE_URL") ?? "sc-domain:earnomni.com";
const DEFAULT_TARGET_COUNTRY = Deno.env.get("GSC_TARGET_COUNTRY") ?? "US";

// GSC data has a 2-3 day reporting lag, so the 28-day window ends 3 days ago.
const REPORT_LAG_DAYS = 3;
const WINDOW_DAYS = 28;

// Thresholds for classifying rows into actionable buckets.
const TOP_PERFORMER_LIMIT = 20;
const OPPORTUNITY_MIN_IMPRESSIONS = 50;
const OPPORTUNITY_MAX_CTR = 0.02;
const PAGE_2_3_MIN_POSITION = 11;
const PAGE_2_3_MAX_POSITION = 30;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface KeywordRecord {
  keyword: string;
  search_volume: number;
  difficulty_score: null;
  intent: "informational" | "commercial" | "navigational";
  target_country: string;
  priority: number;
}

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

// Exchanges the service account key for a short-lived GSC access token
// via the OAuth2 JWT-bearer flow (no user consent screen required).
async function getAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncode(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: GSC_SCOPE,
      aud: GSC_TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    }),
  );

  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const jwt = `${header}.${claims}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenResponse = await fetch(GSC_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google OAuth token request failed (${tokenResponse.status}): ${await tokenResponse.text()}`);
  }

  const { access_token } = await tokenResponse.json();
  if (!access_token) throw new Error("Google OAuth token response did not include an access_token.");
  return access_token;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getReportDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - REPORT_LAG_DAYS);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1));
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

async function fetchSearchAnalytics(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<GscRow[]> {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${
    encodeURIComponent(GSC_SITE_URL)
  }/searchAnalytics/query`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search Console API error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return data.rows ?? [];
}

// Cheap heuristic since GSC doesn't classify intent; good enough as a
// starting point for the Content Engine to refine later.
function classifyIntent(keyword: string): KeywordRecord["intent"] {
  const lower = keyword.toLowerCase();
  if (lower.includes("earnomni")) return "navigational";
  if (/\b(best|top|vs|review|price|pricing|cheap|buy|discount|alternative|coupon)\b/.test(lower)) {
    return "commercial";
  }
  return "informational";
}

function computePriority(row: GscRow, isOpportunity: boolean, isPageTwoOrThree: boolean): number {
  let score = 0;
  if (isOpportunity) score += 40;
  if (isPageTwoOrThree) score += 30 + Math.max(0, PAGE_2_3_MAX_POSITION - row.position);
  score += Math.min(Math.round(row.impressions / 50), 20);
  return Math.min(score, 100);
}

function buildKeywordRecords(rows: GscRow[]): {
  records: KeywordRecord[];
  topPerformers: GscRow[];
  opportunityKeywords: GscRow[];
  pageTwoThreeKeywords: GscRow[];
} {
  const topPerformers = [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, TOP_PERFORMER_LIMIT);

  const opportunityKeywords = rows.filter(
    (row) => row.impressions >= OPPORTUNITY_MIN_IMPRESSIONS && row.ctr < OPPORTUNITY_MAX_CTR,
  );

  const pageTwoThreeKeywords = rows.filter(
    (row) => row.position >= PAGE_2_3_MIN_POSITION && row.position <= PAGE_2_3_MAX_POSITION,
  );

  const opportunitySet = new Set(opportunityKeywords.map((row) => row.keys[0]));
  const pageTwoThreeSet = new Set(pageTwoThreeKeywords.map((row) => row.keys[0]));

  const records = rows.map((row) => {
    const keyword = row.keys[0];
    const isOpportunity = opportunitySet.has(keyword);
    const isPageTwoOrThree = pageTwoThreeSet.has(keyword);
    return {
      keyword,
      search_volume: Math.round(row.impressions),
      difficulty_score: null,
      intent: classifyIntent(keyword),
      target_country: DEFAULT_TARGET_COUNTRY,
      priority: computePriority(row, isOpportunity, isPageTwoOrThree),
    };
  });

  return { records, topPerformers, opportunityKeywords, pageTwoThreeKeywords };
}

function summarizeRow(row: GscRow) {
  return {
    keyword: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawServiceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!rawServiceAccountKey) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY secret.");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    let serviceAccount: ServiceAccountKey;
    try {
      serviceAccount = JSON.parse(rawServiceAccountKey);
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.");
    }
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email or private_key.");
    }

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

    const { startDate, endDate } = getReportDateRange();
    const accessToken = await getAccessToken(serviceAccount);
    const rows = await fetchSearchAnalytics(accessToken, startDate, endDate);

    const { records, topPerformers, opportunityKeywords, pageTwoThreeKeywords } = buildKeywordRecords(rows);

    let savedCount = 0;
    if (records.length > 0) {
      const keywords = records.map((record) => record.keyword);

      const { error: deleteError } = await supabase
        .from("seo_keywords")
        .delete()
        .eq("target_country", DEFAULT_TARGET_COUNTRY)
        .in("keyword", keywords);
      if (deleteError) throw new Error(`Failed to clear stale seo_keywords rows: ${deleteError.message}`);

      const { error: insertError, count } = await supabase
        .from("seo_keywords")
        .insert(records, { count: "exact" });
      if (insertError) throw new Error(`Failed to insert seo_keywords rows: ${insertError.message}`);
      savedCount = count ?? records.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        site: GSC_SITE_URL,
        dateRange: { startDate, endDate },
        totalKeywordsFetched: rows.length,
        savedCount,
        topPerformers: topPerformers.slice(0, 10).map(summarizeRow),
        opportunityKeywords: opportunityKeywords.slice(0, 10).map(summarizeRow),
        pageTwoThreeKeywords: pageTwoThreeKeywords.slice(0, 10).map(summarizeRow),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("seo-research function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
