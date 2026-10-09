// api/blog.ts  (/blog -> index, /blog/:slug -> article; see vercel.json rewrites)
// Server-rendered single blog article — dynamic (publish = instantly live)
// AND fully crawlable by Google + AI bots. The SPA app is untouched.
//
// Reads a published content_drafts row by slug (anon key + the
// public_read_published_drafts RLS policy), renders markdown -> HTML,
// and returns a complete SEO-optimized HTML document styled to match
// the EarnOmni dark theme.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { marked } from "marked";

const SITE = "https://www.earnomni.com";

// Same public project URL + anon (publishable) key the SPA ships in
// src/integrations/supabase/client.ts — keep the two in sync. The anon key is
// public by design (it is in every visitor's JS bundle); reads are limited by
// the public_read_published_drafts RLS policy. Vercel's VITE_SUPABASE_* env
// vars are intentionally NOT used: the SPA never reads them and they held an
// invalid value ("Invalid supabaseUrl" in production).
const SUPABASE_URL = "https://foofdltskckbrmihisll.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvb2ZkbHRza2NrYnJtaWhpc2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MzMwNDQsImV4cCI6MjA5NjIwOTA0NH0.bMu7t3XZlvRwqZ1vHe5tFTgtOlwh1LB8vO1G2S3Wwes";

let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

// Minimal HTML escaping for text injected into attributes / meta tags.
function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// The site's exact theme tokens (from src/styles.css) so the server-rendered
// page matches the app without needing the app's bundled CSS.
const THEME_CSS = `
  :root{
    /* Midnight Indigo — copied verbatim from src/styles.css :root */
    --background:oklch(0.13 0.04 280); --foreground:oklch(0.97 0.01 280);
    --card:oklch(0.18 0.05 280); --muted-foreground:oklch(0.72 0.03 280);
    --body-text:oklch(0.9 0.015 280);
    --primary:oklch(0.62 0.22 275); --primary-foreground:oklch(0.99 0.005 280);
    --border:oklch(0.3 0.05 280);
    --gradient-hero:linear-gradient(135deg,oklch(0.62 0.22 275) 0%,oklch(0.5 0.24 295) 100%);
    --gradient-card:linear-gradient(135deg,oklch(0.22 0.06 280) 0%,oklch(0.18 0.05 285) 100%);
    --shadow-glow:0 10px 40px -10px oklch(0.62 0.22 275 / 0.4);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--background);color:var(--foreground);
    font-family:'Sora',ui-sans-serif,system-ui,sans-serif;line-height:1.7;
    -webkit-font-smoothing:antialiased}
  .font-display{font-family:'Sora',sans-serif}
  a{color:var(--primary);text-decoration:none}
  a:hover{text-decoration:underline}
  .wrap{max-width:760px;margin:0 auto;padding:0 24px}
  header,footer{border-color:color-mix(in oklch,var(--border) 40%,transparent)}
  header{border-bottom:1px solid color-mix(in oklch,var(--border) 40%,transparent);padding:20px 0;
    position:sticky;top:0;background:color-mix(in oklch,var(--background) 80%,transparent);backdrop-filter:blur(8px);z-index:10}
  .nav{max-width:1100px;margin:0 auto;padding:0 24px;display:flex;
    align-items:center;justify-content:space-between}
  .logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px;color:var(--foreground)}
  .logo:hover{text-decoration:none}
  .logo-badge{width:32px;height:32px;border-radius:8px;
    background:var(--gradient-hero);display:flex;align-items:center;
    justify-content:center;color:#fff;font-weight:800}
  .nav-links{display:flex;gap:24px;font-size:14px;color:var(--muted-foreground)}
  main.wrap{padding:56px 24px}
  .nav-links a,.foot-links a{color:inherit}
  .nav-links a:hover,.foot-links a:hover{color:var(--foreground);text-decoration:none}
  .kicker{color:var(--primary);font-size:13px;font-weight:600;
    text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px}
  h1{font-family:'Sora',sans-serif;font-size:clamp(30px,5vw,44px);
    font-weight:800;line-height:1.15;margin-bottom:18px;letter-spacing:-.02em}
  .meta{color:var(--muted-foreground);font-size:14px;margin-bottom:40px;
    padding-bottom:24px;border-bottom:1px solid color-mix(in oklch,var(--border) 40%,transparent)}
  article h2{font-family:'Sora',sans-serif;font-size:26px;font-weight:700;
    margin:40px 0 14px;letter-spacing:-.01em}
  article h3{font-family:'Sora',sans-serif;font-size:20px;font-weight:600;margin:28px 0 10px}
  article p{margin:0 0 18px;color:var(--body-text)}
  article ul,article ol{margin:0 0 18px 24px;color:var(--body-text)}
  article li{margin:6px 0}
  article a{text-decoration:underline}
  article code{background:var(--card);padding:2px 6px;border-radius:4px;font-size:.9em}
  article pre{background:var(--card);padding:16px;border-radius:8px;
    overflow-x:auto;margin:0 0 18px;border:1px solid color-mix(in oklch,var(--border) 40%,transparent)}
  article blockquote{border-left:3px solid var(--primary);
    padding-left:16px;margin:0 0 18px;color:var(--muted-foreground)}
  .faq{margin-top:56px;border-top:1px solid color-mix(in oklch,var(--border) 40%,transparent);padding-top:40px}
  .faq h2{margin-top:0}
  .faq-item{margin-bottom:20px}
  .faq-q{font-weight:600;margin-bottom:6px;font-family:'Sora',sans-serif}
  .faq-a{color:var(--muted-foreground)}
  .cta{margin-top:56px;padding:32px;border-radius:16px;
    background:var(--gradient-card);box-shadow:var(--shadow-glow);border:1px solid color-mix(in oklch,var(--border) 40%,transparent);text-align:center}
  .cta h3{font-family:'Sora',sans-serif;font-size:22px;margin-bottom:10px}
  .cta p{color:var(--muted-foreground);margin-bottom:20px}
  .btn{display:inline-block;padding:12px 24px;border-radius:10px;
    background:var(--gradient-hero);color:#fff;font-weight:600}
  .btn:hover{text-decoration:none;opacity:.92}
  footer{border-top:1px solid color-mix(in oklch,var(--border) 40%,transparent);padding:32px 0;margin-top:64px;
    color:var(--muted-foreground);font-size:14px}
  .foot{max-width:1100px;margin:0 auto;padding:0 24px;display:flex;
    justify-content:space-between;flex-wrap:wrap;gap:16px}
  .foot-links{display:flex;gap:20px;flex-wrap:wrap}
  @media (max-width:560px){
    .nav,.foot{padding:0 16px} .wrap,main.wrap{padding-left:16px;padding-right:16px}
    .nav-links{gap:16px;font-size:13px}
    .nav-links a:nth-child(2),.nav-links a:nth-child(3){display:none}
    .cta{padding:24px 18px}
  }
  .lede{color:var(--muted-foreground);font-size:18px;margin-bottom:40px;max-width:620px}
  .posts{list-style:none;margin:0;padding:0;display:grid;gap:16px}
  .post{border:1px solid color-mix(in oklch,var(--border) 40%,transparent);border-radius:16px;
    background:var(--gradient-card);transition:border-color .15s,transform .15s}
  .post:hover{border-color:var(--primary);transform:translateY(-1px)}
  .post a{display:block;padding:24px;color:inherit;text-decoration:none}
  .post-date{color:var(--muted-foreground);font-size:13px;margin-bottom:8px}
  .post h2{font-size:21px;font-weight:700;line-height:1.3;margin:0 0 8px;letter-spacing:-.01em}
  .post p{color:var(--muted-foreground);font-size:15px;margin:0}
  .post-more{display:inline-block;margin-top:14px;color:var(--primary);font-size:14px;font-weight:600}
  .empty{color:var(--muted-foreground);padding:40px 0}
  .back{display:inline-block;margin-bottom:32px;font-size:14px;
    color:var(--muted-foreground)}
`;

function siteHeader(): string {
  return `<header><div class="nav">
    <a class="logo" href="${SITE}/">
      <span class="logo-badge">E</span><span>EarnOmni</span></a>
    <nav class="nav-links">
      <a href="${SITE}/blog">Blog</a>
      <a href="${SITE}/advertisers">Advertisers</a>
      <a href="${SITE}/about">About</a>
      <a href="${SITE}/auth">Sign in</a>
    </nav></div></header>`;
}

function siteFooter(): string {
  const year = new Date().getFullYear();
  return `<footer><div class="foot">
    <div>&copy; ${year} EarnOmni. Operated by i5Digital Hub LLC.</div>
    <div class="foot-links">
      <a href="${SITE}/about">About</a>
      <a href="${SITE}/advertisers">Advertisers</a>
      <a href="${SITE}/blog">Blog</a>
      <a href="${SITE}/terms">Terms</a>
      <a href="${SITE}/privacy">Privacy</a>
    </div></div></footer>`;
}

function notFound(res: any) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(404).send(`<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Article not found — EarnOmni</title><meta name="robots" content="noindex">
    <style>${THEME_CSS}</style>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    </head><body>${siteHeader()}
    <main class="wrap"><h1>Article not found</h1>
    <p style="color:var(--muted-foreground)">This post doesn't exist or hasn't been published yet.</p>
    <p style="margin-top:24px"><a href="${SITE}/blog">&larr; Back to the blog</a></p></main>
    ${siteFooter()}</body></html>`);
}

const INDEX_TITLE = "EarnOmni Blog — Guides to Earning USDT Online";
const INDEX_DESC =
  "Practical guides on earning USDT online: watching ads, completing tasks, referrals, withdrawals and avoiding scams.";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

async function renderIndex(res: any) {
  const { data, error } = await getSupabase()
    .from("content_drafts")
    .select("title, slug, excerpt, meta_description, published_at, updated_at")
    .eq("status", "published")
    .not("slug", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw new Error(`[blog] index query failed: ${error.message}`);
  const posts = (data || []).filter((p: any) => p.slug && p.title);
  const canonical = `${SITE}/blog`;

  const items = posts
    .map((p: any) => {
      const date = p.published_at || p.updated_at;
      const blurb = p.excerpt || p.meta_description || "";
      return `<li class="post"><a href="${SITE}/blog/${esc(p.slug)}">
        ${date ? `<div class="post-date"><time datetime="${esc(date)}">${fmtDate(date)}</time></div>` : ""}
        <h2>${esc(p.title)}</h2>
        ${blurb ? `<p>${esc(blurb)}</p>` : ""}
        <span class="post-more">Read article &rarr;</span></a></li>`;
    })
    .join("\n");

  const blogSchema = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "EarnOmni Blog",
    description: INDEX_DESC,
    url: canonical,
    publisher: { "@type": "Organization", name: "EarnOmni", url: SITE,
      logo: { "@type": "ImageObject", url: `${SITE}/logo-512.png` } },
    blogPost: posts.slice(0, 50).map((p: any) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `${SITE}/blog/${p.slug}`,
      ...(p.published_at ? { datePublished: p.published_at } : {}),
    })),
  }).replace(/</g, "\\u003c")}</script>`;

  const breadcrumbSchema = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Blog", item: canonical },
    ],
  })}</script>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.status(200).send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(INDEX_TITLE)}</title>
<meta name="description" content="${esc(INDEX_DESC)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(INDEX_TITLE)}">
<meta property="og:description" content="${esc(INDEX_DESC)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:site_name" content="EarnOmni">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(INDEX_TITLE)}">
<meta name="twitter:description" content="${esc(INDEX_DESC)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<link rel="icon" href="${SITE}/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${THEME_CSS}</style>
${blogSchema}
${breadcrumbSchema}
</head>
<body>
${siteHeader()}
<main class="wrap">
  <div class="kicker">EarnOmni Blog</div>
  <h1>Guides to earning USDT online</h1>
  <p class="lede">${esc(INDEX_DESC)}</p>
  ${posts.length ? `<ul class="posts">${items}</ul>` : `<p class="empty">No articles published yet — check back soon.</p>`}
  <div class="cta">
    <h3>Start earning real USDT</h3>
    <p>Watch ads, complete tasks, and withdraw from $10. Free to join.</p>
    <a class="btn" href="${SITE}/auth">Create your free account</a>
  </div>
</main>
${siteFooter()}
</body></html>`);
}

export default async function handler(req: any, res: any) {
  try {
    const slug = String(req.query.slug || "").trim();
    if (!slug) return await renderIndex(res);

    const { data: post, error } = await getSupabase()
      .from("content_drafts")
      .select("title, slug, body, meta_description, excerpt, published_at, updated_at, author_name, og_image_url, faq, status")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error || !post) return notFound(res);

    const title = esc(post.title);
    const metaDesc = esc(post.meta_description || post.excerpt || "");
    const canonical = `${SITE}/blog/${esc(post.slug)}`;
    const author = esc(post.author_name || "EarnOmni Team");
    const published = post.published_at || post.updated_at || new Date().toISOString();
    const modified = post.updated_at || published;
    const ogImage = esc(post.og_image_url || `${SITE}/og-image.png`);

    const bodyHtml = await marked.parse(post.body || "", { gfm: true, breaks: false });

    // Optional FAQ block + FAQPage schema
    let faqHtml = "";
    let faqSchema = "";
    if (Array.isArray(post.faq) && post.faq.length > 0) {
      const items = post.faq.filter(
        (f: any) => f && typeof f.q === "string" && typeof f.a === "string"
      );
      if (items.length > 0) {
        faqHtml =
          `<section class="faq"><h2>Frequently asked questions</h2>` +
          items
            .map(
              (f: any) =>
                `<div class="faq-item"><div class="faq-q">${esc(f.q)}</div><div class="faq-a">${esc(f.a)}</div></div>`
            )
            .join("") +
          `</section>`;
        faqSchema = `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((f: any) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        })}</script>`;
      }
    }

    const articleSchema = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.meta_description || post.excerpt || "",
      image: post.og_image_url || `${SITE}/og-image.png`,
      datePublished: published,
      dateModified: modified,
      author: { "@type": "Organization", name: post.author_name || "EarnOmni Team", url: `${SITE}/about` },
      publisher: {
        "@type": "Organization",
        name: "EarnOmni",
        url: SITE,
        logo: { "@type": "ImageObject", url: `${SITE}/logo-512.png` },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    })}</script>`;

    const breadcrumbSchema = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: canonical },
      ],
    })}</script>`;

    const dateStr = new Date(published).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Cache at the edge, allow stale-while-revalidate so publishes appear fast
    // but crawlers/users get cached HTML most of the time.
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=3600"
    );

    res.status(200).send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — EarnOmni</title>
<meta name="description" content="${metaDesc}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow">
<meta name="author" content="${author}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${metaDesc}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:site_name" content="EarnOmni">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${metaDesc}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="${SITE}/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${THEME_CSS}</style>
${articleSchema}
${breadcrumbSchema}
${faqSchema}
</head>
<body>
${siteHeader()}
<main class="wrap">
  <a class="back" href="${SITE}/blog">&larr; Back to the blog</a>
  <div class="kicker">EarnOmni Blog</div>
  <h1>${title}</h1>
  <div class="meta">By ${author} &middot; ${dateStr}</div>
  <article>${bodyHtml}</article>
  ${faqHtml}
  <div class="cta">
    <h3>Start earning real USDT</h3>
    <p>Watch ads, complete tasks, and withdraw from $10. Free to join.</p>
    <a class="btn" href="${SITE}/auth">Create your free account</a>
  </div>
</main>
${siteFooter()}
</body></html>`);
  } catch (e) {
    console.error("[blog] render failed:", e);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send("<!doctype html><title>Error</title><p>Something went wrong.</p>");
  }
}
