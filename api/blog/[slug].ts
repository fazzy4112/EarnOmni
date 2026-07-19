// api/blog/[slug].ts
// Server-rendered single blog article — dynamic (publish = instantly live)
// AND fully crawlable by Google + AI bots. The SPA app is untouched.
//
// Reads a published content_drafts row by slug (anon key + the
// public_read_published_drafts RLS policy), renders markdown -> HTML,
// and returns a complete SEO-optimized HTML document styled to match
// the EarnOmni dark theme.

import { createClient } from "@supabase/supabase-js";
import { marked } from "marked";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SITE = "https://earnomni.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Minimal HTML escaping for text injected into attributes / meta tags.
function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// The site's exact theme tokens (from src/index.css) so the server-rendered
// page matches the app without needing the app's bundled CSS.
const THEME_CSS = `
  :root{
    --background:240 6% 6%; --foreground:0 0% 98%;
    --card:240 5% 9%; --muted-foreground:240 5% 65%;
    --primary:158 64% 42%; --primary-foreground:0 0% 100%;
    --border:240 5% 16%;
    --gradient-hero:linear-gradient(135deg,hsl(158 64% 42%),hsl(190 80% 45%));
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:hsl(var(--background));color:hsl(var(--foreground));
    font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.7;
    -webkit-font-smoothing:antialiased}
  .font-display{font-family:'Sora',sans-serif}
  a{color:hsl(var(--primary));text-decoration:none}
  a:hover{text-decoration:underline}
  .wrap{max-width:760px;margin:0 auto;padding:0 24px}
  header,footer{border-color:hsl(var(--border)/0.4)}
  header{border-bottom:1px solid hsl(var(--border)/0.4);padding:20px 0;
    position:sticky;top:0;background:hsl(var(--background)/0.8);backdrop-filter:blur(8px);z-index:10}
  .nav{max-width:1100px;margin:0 auto;padding:0 24px;display:flex;
    align-items:center;justify-content:space-between}
  .logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px}
  .logo-badge{width:32px;height:32px;border-radius:8px;
    background:var(--gradient-hero);display:flex;align-items:center;
    justify-content:center;color:#fff;font-weight:800}
  .nav-links{display:flex;gap:24px;font-size:14px;color:hsl(var(--muted-foreground))}
  main{padding:56px 0}
  .kicker{color:hsl(var(--primary));font-size:13px;font-weight:600;
    text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px}
  h1{font-family:'Sora',sans-serif;font-size:clamp(30px,5vw,44px);
    font-weight:800;line-height:1.15;margin-bottom:18px;letter-spacing:-.02em}
  .meta{color:hsl(var(--muted-foreground));font-size:14px;margin-bottom:40px;
    padding-bottom:24px;border-bottom:1px solid hsl(var(--border)/0.4)}
  article h2{font-family:'Sora',sans-serif;font-size:26px;font-weight:700;
    margin:40px 0 14px;letter-spacing:-.01em}
  article h3{font-family:'Sora',sans-serif;font-size:20px;font-weight:600;margin:28px 0 10px}
  article p{margin:0 0 18px;color:hsl(0 0% 90%)}
  article ul,article ol{margin:0 0 18px 24px;color:hsl(0 0% 90%)}
  article li{margin:6px 0}
  article a{text-decoration:underline}
  article code{background:hsl(var(--card));padding:2px 6px;border-radius:4px;font-size:.9em}
  article pre{background:hsl(var(--card));padding:16px;border-radius:8px;
    overflow-x:auto;margin:0 0 18px;border:1px solid hsl(var(--border)/0.4)}
  article blockquote{border-left:3px solid hsl(var(--primary));
    padding-left:16px;margin:0 0 18px;color:hsl(var(--muted-foreground))}
  .faq{margin-top:56px;border-top:1px solid hsl(var(--border)/0.4);padding-top:40px}
  .faq h2{margin-top:0}
  .faq-item{margin-bottom:20px}
  .faq-q{font-weight:600;margin-bottom:6px;font-family:'Sora',sans-serif}
  .faq-a{color:hsl(var(--muted-foreground))}
  .cta{margin-top:56px;padding:32px;border-radius:16px;
    background:hsl(var(--card));border:1px solid hsl(var(--border)/0.4);text-align:center}
  .cta h3{font-family:'Sora',sans-serif;font-size:22px;margin-bottom:10px}
  .cta p{color:hsl(var(--muted-foreground));margin-bottom:20px}
  .btn{display:inline-block;padding:12px 24px;border-radius:10px;
    background:var(--gradient-hero);color:#fff;font-weight:600}
  .btn:hover{text-decoration:none;opacity:.92}
  footer{border-top:1px solid hsl(var(--border)/0.4);padding:32px 0;margin-top:64px;
    color:hsl(var(--muted-foreground));font-size:14px}
  .foot{max-width:1100px;margin:0 auto;padding:0 24px;display:flex;
    justify-content:space-between;flex-wrap:wrap;gap:16px}
  .foot-links{display:flex;gap:20px;flex-wrap:wrap}
  .back{display:inline-block;margin-bottom:32px;font-size:14px;
    color:hsl(var(--muted-foreground))}
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
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
    </head><body>${siteHeader()}
    <main class="wrap"><h1>Article not found</h1>
    <p style="color:hsl(var(--muted-foreground))">This post doesn't exist or hasn't been published yet.</p>
    <p style="margin-top:24px"><a href="${SITE}/blog">&larr; Back to the blog</a></p></main>
    ${siteFooter()}</body></html>`);
}

export default async function handler(req: any, res: any) {
  try {
    const slug = String(req.query.slug || "").trim();
    if (!slug) return notFound(res);

    const { data: post, error } = await supabase
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
    const ogImage = esc(post.og_image_url || `${SITE}/og-default.png`);

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
      image: post.og_image_url || `${SITE}/og-default.png`,
      datePublished: published,
      dateModified: modified,
      author: { "@type": "Organization", name: author },
      publisher: {
        "@type": "Organization",
        name: "EarnOmni",
        logo: { "@type": "ImageObject", url: `${SITE}/logo.png` },
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
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
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(500).send("<!doctype html><title>Error</title><p>Something went wrong.</p>");
  }
}
