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
const MAX_CANDIDATE_KEYWORDS = 200;
const REQUEST_TIMEOUT_MS = 10_000;
const PAGESPEED_TIMEOUT_MS = 25_000;

const TITLE_MIN_LENGTH = 30;
const TITLE_MAX_LENGTH = 60;
const DESCRIPTION_MIN_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 160;
const H1_MIN_LENGTH = 20;
const H1_MAX_LENGTH = 70;
const KEYWORD_DENSITY_MIN = 0.5;
const KEYWORD_DENSITY_MAX = 2.5;
const KEYWORD_DENSITY_STUFFING = 5;

type Severity = "critical" | "warning" | "good" | "very_good" | "excellent";

// Higher is better; used to compute a single 0-100 score from a page's issue list.
const SEVERITY_SCORE: Record<Severity, number> = {
  critical: 0,
  warning: 40,
  good: 70,
  very_good: 90,
  excellent: 100,
};

interface AuditIssue {
  check: string;
  severity: Severity;
  message: string;
}

interface PageAudit {
  page_url: string;
  issues: AuditIssue[];
  severity_summary: Record<Severity, number>;
  score: number;
  status: string;
}

const POWER_WORD_PATTERNS = [
  /\bbest\b/i,
  /\bfree\b/i,
  /\bhow to\b/i,
  /\bguide\b/i,
  /\bproven\b/i,
  /\beasy\b/i,
  /\bfast\b/i,
  /\btop\b/i,
  /\bultimate\b/i,
  /\bearn\b/i,
  /\bget\b/i,
  /\bstart\b/i,
  /\bnow\b/i,
  /\d/,
  /%/,
  /[?!]/,
];

const CTA_PATTERNS = [
  /\bsign up\b/i,
  /\bget started\b/i,
  /\bstart earning\b/i,
  /\blearn more\b/i,
  /\bjoin\b/i,
  /\bclick\b/i,
  /\bdiscover\b/i,
  /\btry\b/i,
  /\bdownload\b/i,
  /\bclaim\b/i,
  /\bstart\b/i,
  /\bearn\b/i,
  /[?!]/,
];

const GENERIC_ANCHOR_TEXT = new Set([
  "click here",
  "read more",
  "here",
  "this",
  "more",
  "this page",
  "this article",
  "learn more",
  "link",
  "click",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPhrase(haystack: string, phrase: string): boolean {
  if (!haystack || !phrase) return false;
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i").test(haystack);
}

function countPhraseOccurrences(haystack: string, phrase: string): number {
  if (!haystack || !phrase) return 0;
  const matches = haystack.match(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi"));
  return matches ? matches.length : 0;
}

function isCompellingCopy(text: string): boolean {
  return POWER_WORD_PATTERNS.some((pattern) => pattern.test(text));
}

function hasCallToAction(text: string): boolean {
  return CTA_PATTERNS.some((pattern) => pattern.test(text));
}

function isGenericAltText(alt: string): boolean {
  const trimmed = alt.trim();
  if (trimmed.length < 8) return true;
  if (/\.(jpe?g|png|gif|webp|svg|avif)$/i.test(trimmed)) return true;
  if (/^(image|img|photo|picture|banner|icon|logo|untitled|screenshot|graphic)[\s\d_-]*$/i.test(trimmed)) return true;
  return false;
}

function isGenericAnchorText(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed || trimmed.length < 3) return true;
  return GENERIC_ANCHOR_TEXT.has(trimmed);
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
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

function extractInternalLinksWithAnchors(
  html: string,
  baseUrl: string,
): { url: string; anchorText: string }[] {
  const seen = new Map<string, string>();
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const resolved = new URL(match[1], baseUrl).toString();
      if (!resolved.startsWith(ORIGIN) || seen.has(resolved)) continue;
      const anchorText = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      seen.set(resolved, anchorText);
    } catch {
      // Ignore malformed hrefs
    }
  }
  return Array.from(seen.entries()).map(([url, anchorText]) => ({ url, anchorText }));
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

function extractImages(html: string): { src: string; alt: string; hasAlt: boolean }[] {
  const images: { src: string; alt: string; hasAlt: boolean }[] = [];
  for (const match of html.matchAll(/<img[^>]*>/gi)) {
    const tag = match[0];
    const srcMatch = tag.match(/\bsrc=["']([^"']*)["']/i);
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1].trim() : "";
    images.push({
      src: srcMatch ? srcMatch[1] : "(unknown)",
      alt,
      hasAlt: alt.length > 0,
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

function extractBodyText(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  return text.replace(/\s+/g, " ").trim();
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

function checkInternalLinkQuality(html: string, pageUrl: string): AuditIssue {
  const links = extractInternalLinksWithAnchors(html, pageUrl);
  const count = links.length;

  if (count === 0) {
    return { check: "internal_linking", severity: "warning", message: "No internal links found on this page" };
  }
  if (count === 1) {
    return {
      check: "internal_linking",
      severity: "warning",
      message: "Only 1 internal link found — add more links to related pages to strengthen site structure",
    };
  }

  const genericCount = links.filter((link) => isGenericAnchorText(link.anchorText)).length;
  const genericRatio = genericCount / count;

  if (genericRatio > 0.5) {
    return {
      check: "internal_linking",
      severity: "good",
      message: `${count} internal links found, but ${genericCount} use generic anchor text (e.g. "click here")`,
    };
  }
  if (count < 3) {
    return {
      check: "internal_linking",
      severity: "good",
      message: `${count} internal links found with descriptive anchor text (consider adding more)`,
    };
  }
  if (genericCount > 0) {
    return {
      check: "internal_linking",
      severity: "very_good",
      message: `${count} internal links found, mostly descriptive anchor text (${genericCount} generic)`,
    };
  }
  return {
    check: "internal_linking",
    severity: "excellent",
    message: `${count} internal links found, all using descriptive, keyword-relevant anchor text`,
  };
}

function checkKeywordDensity(bodyText: string, headings: { text: string }[], focusKeyword: string | null): AuditIssue | null {
  if (!focusKeyword) return null;

  const totalWords = countWords(bodyText);
  if (totalWords === 0) {
    return {
      check: "keyword_density",
      severity: "warning",
      message: "Could not analyze keyword density: no readable body text found",
    };
  }

  const occurrences = countPhraseOccurrences(bodyText, focusKeyword);
  const density = Math.round((occurrences / totalWords) * 10000) / 100;

  if (occurrences === 0) {
    return {
      check: "keyword_density",
      severity: "warning",
      message: `Focus keyword "${focusKeyword}" does not appear anywhere in the page content (0% density)`,
    };
  }
  if (density < KEYWORD_DENSITY_MIN) {
    return {
      check: "keyword_density",
      severity: "warning",
      message: `Keyword density is ${density}% for "${focusKeyword}" — below the optimal ${KEYWORD_DENSITY_MIN}-${KEYWORD_DENSITY_MAX}% range`,
    };
  }
  if (density > KEYWORD_DENSITY_MAX) {
    return {
      check: "keyword_density",
      severity: density > KEYWORD_DENSITY_STUFFING ? "critical" : "warning",
      message: `Keyword density is ${density}% for "${focusKeyword}" — above the optimal ${KEYWORD_DENSITY_MIN}-${KEYWORD_DENSITY_MAX}% range (risk of keyword stuffing)`,
    };
  }

  const first100Words = bodyText.split(/\s+/).slice(0, 100).join(" ");
  const inFirst100Words = containsPhrase(first100Words, focusKeyword);
  const inHeading = headings.some((heading) => containsPhrase(heading.text, focusKeyword));

  if (inFirst100Words && inHeading) {
    return {
      check: "keyword_density",
      severity: "excellent",
      message: `Keyword density is ${density}% for "${focusKeyword}" — optimal range, present early and in a heading`,
    };
  }
  if (inFirst100Words) {
    return {
      check: "keyword_density",
      severity: "very_good",
      message: `Keyword density is ${density}% for "${focusKeyword}" — optimal range and appears early in the content`,
    };
  }
  return {
    check: "keyword_density",
    severity: "good",
    message: `Keyword density is ${density}% for "${focusKeyword}" — within the optimal range`,
  };
}

function checkContentLength(bodyText: string): AuditIssue {
  const wordCount = countWords(bodyText);
  if (wordCount < 150) {
    return { check: "content_length", severity: "critical", message: `Very thin content (${wordCount} words) — add substantially more unique content` };
  }
  if (wordCount < 300) {
    return { check: "content_length", severity: "warning", message: `Thin content (${wordCount} words) — aim for at least 300-600 words` };
  }
  if (wordCount < 600) {
    return { check: "content_length", severity: "good", message: `Acceptable content length (${wordCount} words)` };
  }
  if (wordCount < 1500) {
    return { check: "content_length", severity: "very_good", message: `Strong content depth (${wordCount} words)` };
  }
  return { check: "content_length", severity: "excellent", message: `Comprehensive content (${wordCount} words)` };
}

async function fetchPageSpeedDetails(
  url: string,
): Promise<{ score: number | null; lcpMs: number | null; error?: string }> {
  try {
    const apiKey = Deno.env.get("PAGESPEED_API_KEY");
    const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("strategy", "mobile");
    endpoint.searchParams.set("category", "performance");
    if (apiKey) endpoint.searchParams.set("key", apiKey);

    const response = await fetchWithTimeout(endpoint.toString(), {}, PAGESPEED_TIMEOUT_MS);
    if (!response.ok) return { score: null, lcpMs: null, error: `PageSpeed API returned HTTP ${response.status}` };

    const data = await response.json();
    const score = data?.lighthouseResult?.categories?.performance?.score;
    const lcpMs = data?.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue;
    if (typeof score !== "number") return { score: null, lcpMs: null, error: "PageSpeed response did not include a performance score" };
    return {
      score: Math.round(score * 100),
      lcpMs: typeof lcpMs === "number" ? Math.round(lcpMs) : null,
    };
  } catch (error) {
    return { score: null, lcpMs: null, error: error instanceof Error ? error.message : String(error) };
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

async function loadCandidateKeywords(
  supabase: ReturnType<typeof createClient>,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("seo_keywords")
    .select("keyword")
    .order("priority", { ascending: false })
    .limit(MAX_CANDIDATE_KEYWORDS);
  if (error) {
    console.warn(`Could not load seo_keywords for focus-keyword detection: ${error.message}`);
    return [];
  }
  return (data ?? []).map((row: { keyword: string }) => row.keyword).filter(Boolean);
}

function detectFocusKeyword(candidates: string[], title: string, h1Text: string): string | null {
  for (const keyword of candidates) {
    if (containsPhrase(title, keyword) || (h1Text && containsPhrase(h1Text, keyword))) {
      return keyword;
    }
  }
  return null;
}

function finalizeAudit(pageUrl: string, issues: AuditIssue[]): PageAudit {
  const severity_summary: Record<Severity, number> = {
    critical: 0,
    warning: 0,
    good: 0,
    very_good: 0,
    excellent: 0,
  };
  for (const issue of issues) severity_summary[issue.severity]++;

  const score = issues.length > 0
    ? Math.round(issues.reduce((sum, issue) => sum + SEVERITY_SCORE[issue.severity], 0) / issues.length)
    : 0;

  return { page_url: pageUrl, issues, severity_summary, score, status: "completed" };
}

async function auditPage(pageUrl: string, isHomepage: boolean, candidateKeywords: string[]): Promise<PageAudit> {
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
  const headings = extractHeadings(html);
  const h1s = headings.filter((h) => h.level === 1);
  const focusKeyword = detectFocusKeyword(candidateKeywords, title, h1s[0]?.text ?? "");

  // --- Title tag ---
  if (!title) {
    issues.push({ check: "title", severity: "critical", message: "Missing <title> tag" });
  } else if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    issues.push({
      check: "title",
      severity: "warning",
      message: `Title tag length is ${title.length} characters (recommended ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH}): "${title}"`,
    });
  } else if (!focusKeyword || !containsPhrase(title, focusKeyword)) {
    issues.push({
      check: "title",
      severity: "good",
      message: `Title length is optimal (${title.length} chars) but does not include a detected focus keyword: "${title}"`,
    });
  } else if (!isCompellingCopy(title)) {
    issues.push({
      check: "title",
      severity: "very_good",
      message: `Title includes focus keyword "${focusKeyword}" and is optimally sized (${title.length} chars): "${title}"`,
    });
  } else {
    issues.push({
      check: "title",
      severity: "excellent",
      message: `Title is fully optimized: includes focus keyword "${focusKeyword}", ideal length (${title.length} chars), and compelling copy: "${title}"`,
    });
  }

  // --- Meta description ---
  const description = getMetaContent(html, "name", "description");
  if (!description) {
    issues.push({ check: "meta_description", severity: "critical", message: "Missing meta description" });
  } else if (description.length < DESCRIPTION_MIN_LENGTH || description.length > DESCRIPTION_MAX_LENGTH) {
    issues.push({
      check: "meta_description",
      severity: "warning",
      message: `Meta description length is ${description.length} characters (recommended ${DESCRIPTION_MIN_LENGTH}-${DESCRIPTION_MAX_LENGTH})`,
    });
  } else if (!focusKeyword || !containsPhrase(description, focusKeyword)) {
    issues.push({
      check: "meta_description",
      severity: "good",
      message: `Meta description length is optimal (${description.length} chars) but does not include a detected focus keyword`,
    });
  } else if (!hasCallToAction(description)) {
    issues.push({
      check: "meta_description",
      severity: "very_good",
      message: `Meta description includes focus keyword "${focusKeyword}" and is optimally sized (${description.length} chars)`,
    });
  } else {
    issues.push({
      check: "meta_description",
      severity: "excellent",
      message: `Meta description is fully optimized: includes focus keyword "${focusKeyword}", ideal length (${description.length} chars), and a clear call-to-action`,
    });
  }

  // --- H1 tag ---
  if (h1s.length === 0) {
    issues.push({ check: "h1", severity: "critical", message: "Missing H1 tag" });
  } else if (h1s.length > 1) {
    issues.push({ check: "h1", severity: "critical", message: `Multiple H1 tags found (${h1s.length})` });
  } else {
    const h1Text = h1s[0].text;
    if (!focusKeyword || !containsPhrase(h1Text, focusKeyword)) {
      issues.push({ check: "h1", severity: "good", message: `Exactly one H1 tag found with generic text: "${h1Text}"` });
    } else if (h1Text.length < H1_MIN_LENGTH || h1Text.length > H1_MAX_LENGTH) {
      issues.push({
        check: "h1",
        severity: "very_good",
        message: `H1 includes focus keyword "${focusKeyword}" but length (${h1Text.length} chars) is outside the optimal ${H1_MIN_LENGTH}-${H1_MAX_LENGTH}: "${h1Text}"`,
      });
    } else {
      issues.push({
        check: "h1",
        severity: "excellent",
        message: `H1 is fully optimized: includes focus keyword "${focusKeyword}" at ideal length (${h1Text.length} chars): "${h1Text}"`,
      });
    }
  }

  const hierarchyIssues = findHeadingHierarchyIssues(headings);
  if (hierarchyIssues.length > 0) {
    issues.push({ check: "heading_hierarchy", severity: "warning", message: hierarchyIssues.join("; ") });
  } else if (headings.length > 0) {
    issues.push({ check: "heading_hierarchy", severity: "good", message: "Heading hierarchy looks correct" });
  }

  // --- Images / alt text ---
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
    const genericAlt = images.filter((img) => isGenericAltText(img.alt));
    if (genericAlt.length > 0) {
      issues.push({
        check: "image_alt",
        severity: "good",
        message: `All ${images.length} images have alt text, but ${genericAlt.length} use generic descriptions`,
      });
    } else {
      const keywordImages = focusKeyword ? images.filter((img) => containsPhrase(img.alt, focusKeyword)) : [];
      if (keywordImages.length > 0) {
        issues.push({
          check: "image_alt",
          severity: "excellent",
          message: `All ${images.length} images have descriptive alt text, including ${keywordImages.length} referencing the focus keyword "${focusKeyword}"`,
        });
      } else {
        issues.push({
          check: "image_alt",
          severity: "very_good",
          message: `All ${images.length} images have descriptive, non-generic alt text`,
        });
      }
    }
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

  // --- New checks: internal linking quality, keyword density, content length ---
  issues.push(checkInternalLinkQuality(html, pageUrl));

  const bodyText = extractBodyText(html);
  const densityIssue = checkKeywordDensity(bodyText, headings, focusKeyword);
  if (densityIssue) issues.push(densityIssue);
  issues.push(checkContentLength(bodyText));

  if (isHomepage) {
    const performance = await fetchPageSpeedDetails(pageUrl);
    if (performance.score === null) {
      issues.push({
        check: "performance",
        severity: "warning",
        message: `Could not fetch PageSpeed Insights score: ${performance.error}`,
      });
    } else {
      const score = performance.score;
      const severity: Severity = score >= 95
        ? "excellent"
        : score >= 90
        ? "very_good"
        : score >= 70
        ? "good"
        : score >= 50
        ? "warning"
        : "critical";
      issues.push({ check: "performance", severity, message: `PageSpeed performance score: ${score}/100` });
    }

    if (performance.lcpMs === null) {
      issues.push({
        check: "page_load_time",
        severity: "warning",
        message: "Could not retrieve page load time (Largest Contentful Paint) from PageSpeed Insights",
      });
    } else {
      const lcpMs = performance.lcpMs;
      const severity: Severity = lcpMs <= 1200
        ? "excellent"
        : lcpMs <= 2500
        ? "very_good"
        : lcpMs <= 4000
        ? "good"
        : lcpMs <= 6000
        ? "warning"
        : "critical";
      issues.push({
        check: "page_load_time",
        severity,
        message: `Largest Contentful Paint: ${(lcpMs / 1000).toFixed(2)}s`,
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

    const candidateKeywords = await loadCandidateKeywords(supabase);

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
        auditResults.push(await auditPage(pageUrl, isHomepage, candidateKeywords));
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
          // severity_summary carries the 5-level breakdown plus the computed 0-100 score,
          // since seo_audits has no dedicated score column.
          severity_summary: { ...result.severity_summary, score: result.score },
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
        totals.very_good += result.severity_summary.very_good;
        totals.excellent += result.severity_summary.excellent;
        return totals;
      },
      { critical: 0, warning: 0, good: 0, very_good: 0, excellent: 0 },
    );

    const overallScore = auditResults.length > 0
      ? Math.round(auditResults.reduce((sum, result) => sum + result.score, 0) / auditResults.length)
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        site: BASE_URL,
        pagesAudited: auditResults.length,
        savedCount,
        overallScore,
        overallSeverityTotals,
        pages: auditResults.map((result) => ({
          page_url: result.page_url,
          score: result.score,
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
