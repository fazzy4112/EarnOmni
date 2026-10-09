// api/sitemap.ts  (served at /sitemap.xml via vercel.json rewrite)
// Dynamic sitemap: static public pages + every published blog post, read live
// from content_drafts, so a newly published article appears without a deploy.

import { createClient } from "@supabase/supabase-js";

const SITE = "https://www.earnomni.com";

// Same public project URL + anon key as src/integrations/supabase/client.ts
// and api/blog.ts — keep in sync. Reads are limited by the
// public_read_published_drafts RLS policy.
const SUPABASE_URL = "https://foofdltskckbrmihisll.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb2ZkbHRza2NrYnJtaWhpc2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MzMwNDQsImV4cCI6MjA5NjIwOTA0NH0.bMu7t3XZlvRwqZ1vHe5tFTgtOlwh1LB8vO1G2S3Wwes";

// Public, indexable pages only. /auth, /dashboard and /admin are disallowed
// in robots.txt and must not be listed here.
const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/blog", changefreq: "daily", priority: "0.9" },
  { path: "/advertisers", changefreq: "monthly", priority: "0.6" },
  { path: "/about", changefreq: "monthly", priority: "0.6" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
];

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function urlEntry(loc: string, opts: { lastmod?: string | null; changefreq?: string; priority?: string }) {
  return [
    "  <url>",
    `    <loc>${xmlEsc(loc)}</loc>`,
    opts.lastmod ? `    <lastmod>${opts.lastmod}</lastmod>` : "",
    opts.changefreq ? `    <changefreq>${opts.changefreq}</changefreq>` : "",
    opts.priority ? `    <priority>${opts.priority}</priority>` : "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

export default async function handler(_req: any, res: any) {
  let posts: { slug: string; published_at: string | null; updated_at: string | null }[] = [];
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("content_drafts")
      .select("slug, published_at, updated_at")
      .eq("status", "published")
      .not("slug", "is", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(5000);
    if (error) throw error;
    posts = (data || []).filter((p: any) => typeof p.slug === "string" && p.slug.length > 0);
  } catch (e) {
    // Still serve the static pages rather than failing the whole sitemap.
    console.error("[sitemap] post query failed:", e);
  }

  const newestPost = posts
    .map((p) => isoDate(p.updated_at) || isoDate(p.published_at))
    .filter(Boolean)
    .sort()
    .pop();

  const entries = [
    ...STATIC_PAGES.map((p) =>
      urlEntry(`${SITE}${p.path}`, {
        changefreq: p.changefreq,
        priority: p.priority,
        lastmod: p.path === "/blog" ? newestPost : null,
      })
    ),
    ...posts.map((p) =>
      urlEntry(`${SITE}/blog/${encodeURIComponent(p.slug)}`, {
        lastmod: isoDate(p.updated_at) || isoDate(p.published_at),
        changefreq: "monthly",
        priority: "0.7",
      })
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  res.status(200).send(xml);
}
