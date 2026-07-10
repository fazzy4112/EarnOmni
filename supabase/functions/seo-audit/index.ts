// Supabase Edge Function: seo-audit
//
// Growth Engine / On-Page SEO Engine module.
// Crawls earnomni.com starting from the homepage and sitemap.xml,
// runs on-page SEO checks per page plus a PageSpeed Insights
// performance check on the homepage, and persists per-page audit
// rows into public.seo_audits for the Dashboard/Approval System.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = Deno.env.get("AUDIT_BASE_URL") ?? "https://earnomni.com";
const ORIGIN = new URL(BASE_URL).origin;
const USER_AGENT = "EarnOmniGrowthEngine-SEOAuditBot/1.0 (+https://earnomni.com)";

const MAX_PAGES_TO_AUDIT = Number(Deno.env.get("AUDIT_MAX_PAGES") ?? "15");
const MAX_LINKS_CHECKED_PER_PAGE = 15;
const REQUEST_TIMEOUT_MS = 10_000;
const PAGESPEED_TIMEOUT_MS = 25_000;

const TITLE_MIN_LENGTH = 30;
const TITLE_MAX_LENGTH = 60;
const DESCRIPTION_MIN_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 160;

type Severity = "critical" | "warning" | "good";

interface AuditIssue {
  check: string;
  severity: Severity;
  message: string;
}

interface PageAudit {
  page_url: string;
  issues: AuditIssue[];
  severity_summary: Record<Severity, number>;
  status: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, ...(options.headers ?? {}) },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"'#][^"']*)["']/gi)) {
    try {
      const resolved = new URL(match[1], baseUrl).toString();
      if (resolved.startsWith("http")) links.push(resolved);
    } catch {
      // Ignore malformed hrefs (mailto:, javascript:, etc.)
    }
  }
  return links;
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function getMetaContent(html: string, attr: "name" | "property", value: string): string | null {
  const metaTags = html.match(/<meta[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    if (!new RegExp(`${attr}=["']${value}["']`, "i").test(tag)) continue;
    const contentMatch = tag.match(/content=["']([^"']*)["']/i);
    if (contentMatch) return contentMatch[1].trim();
  }
  return null;
}

function extractHeadings(html: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  for (const match of html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    headings.push({
      level: Number(match[1]),
      text: match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    });
  }
  return headings;
}

function findHeadingHierarchyIssues(headings: { level: number; text: string }[]): string[] {
  const issues: string[] = [];
  let previousLevel = 0;
  for (const heading of headings) {
    if (previousLevel > 0 && heading.level > previousLevel + 1) {
      issues.push(`Jumps from H${previousLevel} to H${heading.level} ("${heading.text.slice(0, 60)}")`);
    }
    previousLevel = heading.level;
  }
  return issues;
}

function extractImages(html: string): { src: string; hasAlt: boolean }[] {
  const images: { src: string; hasAlt: boolean }[] = [];
  for (const match of html.matchAll(/<img[^>]*>/gi)) {
    const tag = match[0];
    const srcMatch = tag.match(/\bsrc=["']([^"']*)["']/i);
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    images.push({
      src: srcMatch ? srcMatch[1] : "(unknown)",
      hasAlt: Boolean(altMatch && altMatch[1].trim().length > 0),
    });
  }
  return images;
}

function extractCanonical(html: string): string | null {
  const linkTags = html.match(/<link[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    if (/rel=["']canonical["']/i.test(tag)) {
      const hrefMatch = tag.match(/href=["']([^"']*)["']/i);
      if (hrefMatch) return hrefMatch[1];
    }
  }
  return null;
}

async function checkLinkStatus(link: string): Promise<number> {
  const headResponse = await fetchWithTimeout(link, { method: "HEAD" });
  if (headResponse.status === 405) {
    const getResponse = await fetchWithTimeout(link, { method: "GET" });
    return getResponse.status;
  }
  return headResponse.status;
}

async function checkInternalLinks(
  html: string,
  pageUrl: string,
): Promise<{ checked: number; broken: { url: string; status: number | string }[] }> {
  const internalLinks = Array.from(
    new Set(extractLinks(html, pageUrl).filter((href) => href.startsWith(ORIGIN))),
  ).slice(0, MAX_LINKS_CHECKED_PER_PAGE);

  const results = await Promise.allSettled(internalLinks.map((link) => checkLinkStatus(link)));

  const broken: { url: string; status: number | string }[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      if (result.value >= 400) broken.push({ url: internalLinks[i], status: result.value });
    } else {
      broken.push({ url: internalLinks[i], status: "error" });
    }
  });

  return { checked: internalLinks.length, broken };
}

async function fetchPageSpeedScore(url: string): Promise<{ score: number | null; error?: string }> {
  try {
    const apiKey = Deno.env.get("PAGESPEED_API_KEY");
    const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("strategy", "mobile");
    endpoint.searchParams.set("category", "performance");
    if (apiKey) endpoint.searchParams.set("key", apiKey);

    const response = await fetchWithTimeout(endpoint.toString(), {}, PAGESPEED_TIMEOUT_MS);
    if (!response.ok) return { score: null, error: `PageSpeed API returned HTTP ${response.status}` };

    const data = await response.json();
    const score = data?.lighthouseResult?.categories?.performance?.score;
    if (typeof score !== "number") return { score: null, error: "PageSpeed response did not include a performance score" };
    return { score: Math.round(score * 100) };
  } catch (error) {
    return { score: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function discoverPageUrls(homepageHtml: string): Promise<string[]> {
  const urls = new Set<string>([BASE_URL]);

  try {
    const sitemapUrl = new URL("/sitemap.xml", BASE_URL).toString();
    const response = await fetchWithTimeout(sitemapUrl);
    if (response.ok) {
      const xml = await response.text();
      for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
        const loc = match[1].trim();
        if (loc.startsWith(ORIGIN)) urls.add(loc);
      }
    }
  } catch (error) {
    console.warn(`Could not fetch sitemap.xml: ${error instanceof Error ? error.message : error}`);
  }

  for (const href of extractLinks(homepageHtml, BASE_URL)) {
    if (href.startsWith(ORIGIN)) urls.add(href);
  }

  return Array.from(urls).slice(0, MAX_PAGES_TO_AUDIT);
}

function finalizeAudit(pageUrl: string, issues: AuditIssue[]): PageAudit {
  const severity_summary: Record<Severity, number> = { critical: 0, warning: 0, good: 0 };
  for (const issue of issues) severity_summary[issue.severity]++;
  return { page_url: pageUrl, issues, severity_summary, status: "completed" };
}

async function auditPage(pageUrl: string, isHomepage: boolean): Promise<PageAudit> {
  const issues: AuditIssue[] = [];

  let html: string;
  try {
    const response = await fetchWithTimeout(pageUrl);
    if (!response.ok) {
      issues.push({ check: "page_load", severity: "critical", message: `Page returned HTTP ${response.status}` });
      return finalizeAudit(pageUrl, issues);
    }
    html = await response.text();
  } catch (error) {
    issues.push({
      check: "page_load",
      severity: "critical",
      message: `Failed to load page: ${error instanceof Error ? error.message : String(error)}`,
    });
    return finalizeAudit(pageUrl, issues);
  }

  const title = extractTitle(html);
  if (!title) {
    issues.push({ check: "title", severity: "critical", message: "Missing <title> tag" });
  } else if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    issues.push({
      check: "title",
      severity: "warning",
      message: `Title tag length is ${title.length} characters (recommended ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH}): "${title}"`,
    });
  } else {
    issues.push({ check: "title", severity: "good", message: `Title tag OK (${title.length} chars): "${title}"` });
  }

  const description = getMetaContent(html, "name", "description");
  if (!description) {
    issues.push({ check: "meta_description", severity: "warning", message: "Missing meta description" });
  } else if (description.length < DESCRIPTION_MIN_LENGTH || description.length > DESCRIPTION_MAX_LENGTH) {
    issues.push({
      check: "meta_description",
      severity: "warning",
      message: `Meta description length is ${description.length} characters (recommended ${DESCRIPTION_MIN_LENGTH}-${DESCRIPTION_MAX_LENGTH})`,
    });
  } else {
    issues.push({
      check: "meta_description",
      severity: "good",
      message: `Meta description OK (${description.length} chars)`,
    });
  }

  const headings = extractHeadings(html);
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    issues.push({ check: "h1", severity: "critical", message: "Missing H1 tag" });
  } else if (h1s.length > 1) {
    issues.push({ check: "h1", severity: "critical", message: `Multiple H1 tags found (${h1s.length})` });
  } else {
    issues.push({ check: "h1", severity: "good", message: `Exactly one H1 tag found: "${h1s[0].text}"` });
  }

  const hierarchyIssues = findHeadingHierarchyIssues(headings);
  if (hierarchyIssues.length > 0) {
    issues.push({ check: "heading_hierarchy", severity: "warning", message: hierarchyIssues.join("; ") });
  } else if (headings.length > 0) {
    issues.push({ check: "heading_hierarchy", severity: "good", message: "Heading hierarchy looks correct" });
  }

  const images = extractImages(html);
  const missingAlt = images.filter((img) => !img.hasAlt);
  if (missingAlt.length > 0) {
    issues.push({
      check: "image_alt",
      severity: "warning",
      message: `${missingAlt.length} of ${images.length} image(s) missing alt text: ${
        missingAlt.slice(0, 5).map((img) => img.src).join(", ")
      }`,
    });
  } else if (images.length > 0) {
    issues.push({ check: "image_alt", severity: "good", message: `All ${images.length} images have alt text` });
  }

  const canonical = extractCanonical(html);
  if (!canonical) {
    issues.push({ check: "canonical", severity: "warning", message: "Missing canonical tag" });
  } else {
    issues.push({ check: "canonical", severity: "good", message: `Canonical tag present: ${canonical}` });
  }

  const ogTags = ["og:title", "og:description", "og:image"];
  const missingOg = ogTags.filter((tag) => !getMetaContent(html, "property", tag));
  if (missingOg.length > 0) {
    issues.push({
      check: "open_graph",
      severity: "warning",
      message: `Missing Open Graph tag(s): ${missingOg.join(", ")}`,
    });
  } else {
    issues.push({ check: "open_graph", severity: "good", message: "All core Open Graph tags present" });
  }

  const { checked, broken } = await checkInternalLinks(html, pageUrl);
  for (const brokenLink of broken) {
    issues.push({
      check: "broken_link",
      severity: "critical",
      message: `Internal link returned ${brokenLink.status}: ${brokenLink.url}`,
    });
  }
  if (checked > 0 && broken.length === 0) {
    issues.push({
      check: "broken_link",
      severity: "good",
      message: `All ${checked} internal links checked returned an OK status`,
    });
  }

  if (isHomepage) {
    const performance = await fetchPageSpeedScore(pageUrl);
    if (performance.score === null) {
      issues.push({
        check: "performance",
        severity: "warning",
        message: `Could not fetch PageSpeed Insights score: ${performance.error}`,
      });
    } else {
      issues.push({
        check: "performance",
        severity: performance.score >= 90 ? "good" : performance.score >= 50 ? "warning" : "critical",
        message: `PageSpeed performance score: ${performance.score}/100`,
      });
    }
  }

  return finalizeAudit(pageUrl, issues);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    let homepageHtml = "";
    try {
      const response = await fetchWithTimeout(BASE_URL);
      if (response.ok) homepageHtml = await response.text();
    } catch (error) {
      console.warn(`Could not load homepage for link discovery: ${error instanceof Error ? error.message : error}`);
    }

    const pageUrls = await discoverPageUrls(homepageHtml);

    const auditResults: PageAudit[] = [];
    for (const [index, pageUrl] of pageUrls.entries()) {
      const isHomepage = index === 0; // discoverPageUrls always places BASE_URL first
      try {
        auditResults.push(await auditPage(pageUrl, isHomepage));
      } catch (error) {
        console.error(`Unexpected error auditing ${pageUrl}:`, error);
        auditResults.push(
          finalizeAudit(pageUrl, [
            {
              check: "page_load",
              severity: "critical",
              message: `Unexpected error during audit: ${error instanceof Error ? error.message : String(error)}`,
            },
          ]),
        );
      }
    }

    let savedCount = 0;
    if (auditResults.length > 0) {
      const auditedUrls = auditResults.map((result) => result.page_url);

      const { error: deleteError } = await supabase.from("seo_audits").delete().in("page_url", auditedUrls);
      if (deleteError) throw new Error(`Failed to clear stale seo_audits rows: ${deleteError.message}`);

      const { error: insertError, count } = await supabase.from("seo_audits").insert(
        auditResults.map((result) => ({
          page_url: result.page_url,
          issues: result.issues,
          severity_summary: result.severity_summary,
          status: result.status,
        })),
        { count: "exact" },
      );
      if (insertError) throw new Error(`Failed to insert seo_audits rows: ${insertError.message}`);
      savedCount = count ?? auditResults.length;
    }

    const overallSeverityTotals = auditResults.reduce(
      (totals, result) => {
        totals.critical += result.severity_summary.critical;
        totals.warning += result.severity_summary.warning;
        totals.good += result.severity_summary.good;
        return totals;
      },
      { critical: 0, warning: 0, good: 0 },
    );

    return new Response(
      JSON.stringify({
        success: true,
        site: BASE_URL,
        pagesAudited: auditResults.length,
        savedCount,
        overallSeverityTotals,
        pages: auditResults.map((result) => ({
          page_url: result.page_url,
          severity_summary: result.severity_summary,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("seo-audit function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
