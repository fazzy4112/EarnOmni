// Supabase Edge Function: send-growth-summary
//
// Growth Engine / Dashboard-Approval System module.
// Pulls a snapshot of research, SEO audit, content, and ads-intelligence
// activity out of the Growth Engine tables, compiles it into an HTML
// summary email, and sends it to the admin via Resend so approvals
// don't require logging into the dashboard to notice new work.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_PANEL_URL = Deno.env.get("ADMIN_PANEL_URL") ?? "https://earnomni.com/admin";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "EarnOmni Growth Engine <growth@earnomni.com>";
const TOP_KEYWORDS_LIMIT = 5;

type Severity = "critical" | "warning" | "good";

interface KeywordRow {
  keyword: string;
  priority: number | null;
  intent: string | null;
  search_volume: number | null;
}

interface ResearchSummary {
  totalKeywords: number;
  topKeywords: KeywordRow[];
}

interface AuditSummary {
  totalAudits: number;
  severityCounts: Record<Severity, number>;
}

interface ContentSummary {
  totalDrafts: number;
  countsByStatus: Record<string, number>;
}

interface AdsSummary {
  totalBriefs: number;
  countsByPlatformAndStatus: Record<string, Record<string, number>>;
}

interface GrowthSummary {
  research: ResearchSummary;
  audits: AuditSummary;
  content: ContentSummary;
  ads: AdsSummary;
  generatedAt: string;
}

function describeSupabaseError(context: string, error: { message: string }): Error {
  return new Error(`${context}: ${error.message}`);
}

function describeResendError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body);
    return `Resend API error (${status}): ${parsed.message ?? body}`;
  } catch {
    return `Resend API error (${status}): ${body}`;
  }
}

async function fetchResearchSummary(supabase: ReturnType<typeof createClient>): Promise<ResearchSummary> {
  const { count, error: countError } = await supabase
    .from("seo_keywords")
    .select("*", { count: "exact", head: true });
  if (countError) throw describeSupabaseError("Failed to count seo_keywords", countError);

  const { data, error } = await supabase
    .from("seo_keywords")
    .select("keyword, priority, intent, search_volume")
    .order("priority", { ascending: false })
    .limit(TOP_KEYWORDS_LIMIT);
  if (error) throw describeSupabaseError("Failed to load top seo_keywords", error);

  return { totalKeywords: count ?? 0, topKeywords: (data ?? []) as KeywordRow[] };
}

async function fetchAuditSummary(supabase: ReturnType<typeof createClient>): Promise<AuditSummary> {
  const { data, error } = await supabase.from("seo_audits").select("severity_summary");
  if (error) throw describeSupabaseError("Failed to load seo_audits", error);

  const severityCounts: Record<Severity, number> = { critical: 0, warning: 0, good: 0 };
  for (const row of data ?? []) {
    const summary = (row.severity_summary ?? {}) as Partial<Record<Severity, number>>;
    severityCounts.critical += summary.critical ?? 0;
    severityCounts.warning += summary.warning ?? 0;
    severityCounts.good += summary.good ?? 0;
  }

  return { totalAudits: data?.length ?? 0, severityCounts };
}

async function fetchContentSummary(supabase: ReturnType<typeof createClient>): Promise<ContentSummary> {
  const { data, error } = await supabase.from("content_drafts").select("status");
  if (error) throw describeSupabaseError("Failed to load content_drafts", error);

  const countsByStatus: Record<string, number> = {};
  for (const row of data ?? []) {
    const status = (row.status as string) ?? "unknown";
    countsByStatus[status] = (countsByStatus[status] ?? 0) + 1;
  }

  return { totalDrafts: data?.length ?? 0, countsByStatus };
}

async function fetchAdsSummary(supabase: ReturnType<typeof createClient>): Promise<AdsSummary> {
  const { data, error } = await supabase.from("ad_campaign_briefs").select("platform, status");
  if (error) throw describeSupabaseError("Failed to load ad_campaign_briefs", error);

  const countsByPlatformAndStatus: Record<string, Record<string, number>> = {};
  for (const row of data ?? []) {
    const platform = (row.platform as string) ?? "unknown";
    const status = (row.status as string) ?? "unknown";
    const forPlatform = countsByPlatformAndStatus[platform] ?? {};
    forPlatform[status] = (forPlatform[status] ?? 0) + 1;
    countsByPlatformAndStatus[platform] = forPlatform;
  }

  return { totalBriefs: data?.length ?? 0, countsByPlatformAndStatus };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderKeywordList(keywords: KeywordRow[]): string {
  if (keywords.length === 0) {
    return `<p style="margin:0;color:#6b7280;font-size:14px;">No keywords researched yet.</p>`;
  }
  const items = keywords
    .map(
      (k) => `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#111827;">${escapeHtml(k.keyword)}</td>
          <td style="padding:6px 0;font-size:12px;color:#6b7280;text-align:right;">
            priority ${k.priority ?? 0}${k.intent ? ` &middot; ${escapeHtml(k.intent)}` : ""}
          </td>
        </tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;">${items}</table>`;
}

function renderStatusCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return `<p style="margin:0;color:#6b7280;font-size:14px;">Nothing here yet.</p>`;
  }
  return entries
    .map(
      ([status, count]) => `
        <span style="display:inline-block;margin:0 8px 8px 0;padding:4px 10px;border-radius:9999px;background:#f3f4f6;font-size:12px;color:#374151;">
          ${escapeHtml(status)}: <strong>${count}</strong>
        </span>`,
    )
    .join("");
}

function buildEmailHtml(summary: GrowthSummary): string {
  const severityBadge = (label: string, count: number, color: string) => `
    <span style="display:inline-block;margin:0 8px 8px 0;padding:4px 10px;border-radius:9999px;background:${color}1a;font-size:12px;color:${color};">
      ${label}: <strong>${count}</strong>
    </span>`;

  const adsRows = Object.entries(summary.ads.countsByPlatformAndStatus)
    .map(([platform, statuses]) => `
      <div style="margin-bottom:8px;">
        <div style="font-size:13px;font-weight:600;color:#111827;text-transform:capitalize;">${escapeHtml(platform.replace("_", " "))}</div>
        <div>${renderStatusCounts(statuses)}</div>
      </div>`)
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table style="width:100%;max-width:640px;margin:0 auto;background:#ffffff;border-collapse:collapse;">
      <tr>
        <td style="background:#0f172a;padding:24px 32px;">
          <span style="font-size:20px;font-weight:bold;color:#ffffff;">EarnOmni Growth Engine</span>
          <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Weekly growth activity summary</div>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
          <h2 style="margin:0 0 4px;font-size:16px;color:#111827;">🔎 Research Engine</h2>
          <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${summary.research.totalKeywords} keyword(s) researched to date. Top priority:</p>
          ${renderKeywordList(summary.research.topKeywords)}
        </td>
      </tr>

      <tr>
        <td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
          <h2 style="margin:0 0 4px;font-size:16px;color:#111827;">🛠️ On-Page SEO Audits</h2>
          <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${summary.audits.totalAudits} page audit(s) on record.</p>
          ${severityBadge("Critical", summary.audits.severityCounts.critical, "#dc2626")}
          ${severityBadge("Warning", summary.audits.severityCounts.warning, "#d97706")}
          ${severityBadge("Good", summary.audits.severityCounts.good, "#16a34a")}
        </td>
      </tr>

      <tr>
        <td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
          <h2 style="margin:0 0 4px;font-size:16px;color:#111827;">✍️ Content Engine</h2>
          <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${summary.content.totalDrafts} draft(s) generated.</p>
          ${renderStatusCounts(summary.content.countsByStatus)}
        </td>
      </tr>

      <tr>
        <td style="padding:24px 32px;">
          <h2 style="margin:0 0 4px;font-size:16px;color:#111827;">📢 Ads Intelligence Engine</h2>
          <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${summary.ads.totalBriefs} campaign brief(s) generated.</p>
          ${adsRows || `<p style="margin:0;color:#6b7280;font-size:14px;">No campaign briefs yet.</p>`}
        </td>
      </tr>

      <tr>
        <td style="padding:24px 32px;background:#f9fafb;text-align:center;">
          <a href="${ADMIN_PANEL_URL}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
            Review in Admin Panel
          </a>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 32px;text-align:center;">
          <span style="font-size:11px;color:#9ca3af;">Generated ${escapeHtml(summary.generatedAt)}</span>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function fetchAdminEmail(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("is_admin", true)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) throw describeSupabaseError("Failed to load admin profile", error);
  if (!data?.email) throw new Error("No admin profile with an email address was found in profiles.");
  return data.email as string;
}

async function sendViaResend(resendApiKey: string, to: string, html: string): Promise<{ id: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: "EarnOmni Growth Engine — Weekly Summary",
      html,
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(describeResendError(response.status, bodyText));
  }

  const parsed = JSON.parse(bodyText);
  return { id: parsed.id ?? "unknown" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey) throw new Error("Missing RESEND_API_KEY secret.");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    let recipientOverride: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.to === "string" && body.to.trim()) recipientOverride = body.to.trim();
      } catch {
        // No/invalid JSON body — fall back to the admin's profile email.
      }
    }

    const [research, audits, content, ads] = await Promise.all([
      fetchResearchSummary(supabase),
      fetchAuditSummary(supabase),
      fetchContentSummary(supabase),
      fetchAdsSummary(supabase),
    ]);

    const summary: GrowthSummary = {
      research,
      audits,
      content,
      ads,
      generatedAt: new Date().toUTCString(),
    };

    const recipient = recipientOverride ?? (await fetchAdminEmail(supabase));
    const html = buildEmailHtml(summary);
    const { id } = await sendViaResend(resendApiKey, recipient, html);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent to ${recipient}`,
        emailId: id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("send-growth-summary function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
