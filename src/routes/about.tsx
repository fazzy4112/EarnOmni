import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight, ChevronDown, ShieldCheck, Users,
  Wallet, Sparkles, Menu, X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { FAQS, faqJsonLd } from "@/lib/faqs";

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "EarnOmni",
  url: "https://earnomni.com",
  description:
    "EarnOmni is a task-completion and ad-watching earning platform where users earn real USDT by completing simple online tasks.",
  foundingDate: "2026",
  creator: {
    "@type": "Organization",
    name: "i5Digital Hub LLC",
  },
};

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About EarnOmni — Our Story, Mission & FAQ" },
      {
        name: "description",
        content:
          "Learn about EarnOmni, a task-completion earning platform that pays real USDT for watching ads, completing tasks, and referring friends. Built by i5Digital Hub LLC.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
              <Logo className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">EarnOmni</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
            <a href="/#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
            <a href="/#plans" className="text-sm text-muted-foreground hover:text-foreground">Plans</a>
            <Link to="/about" className="text-sm font-medium text-foreground">About</Link>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm" className="bg-[image:var(--gradient-hero)]">Start free</Button></Link>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border/50 text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <nav className="flex flex-col gap-1 border-t border-border/40 bg-background px-6 py-4 md:hidden">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Home</Link>
            <a href="/#how" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">How it works</a>
            <a href="/#plans" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Plans</a>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm font-medium text-foreground">About</Link>
            <div className="mt-2 flex flex-col gap-2 border-t border-border/40 pt-3">
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">Sign in</Button>
              </Link>
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full bg-[image:var(--gradient-hero)]">Start free</Button>
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{ background: "radial-gradient(60% 60% at 50% 0%, oklch(0.4 0.2 280 / 0.4), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Our story
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            About{" "}
            <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">
              EarnOmni
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            EarnOmni is a task-completion and ad-watching earning platform built on a simple idea:
            anyone should be able to turn a few spare minutes online into real money — no experience,
            no upfront cost, just consistency.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <Card className="border-border/50 bg-card/50 p-8 md:p-10">
          <h2 className="text-2xl font-bold">Our story</h2>
          <div className="mt-4 space-y-4 text-muted-foreground">
            <p>
              EarnOmni started from a simple observation: most people who want to earn a little
              extra money online are stuck choosing between complicated freelance platforms that
              demand specific skills, or survey sites that pay too little to bother with. We wanted
              to build something in between — a platform where completing everyday digital tasks,
              like watching ads or referring friends, adds up to real, withdrawable earnings.
            </p>
            <p>
              That's why EarnOmni combines several simple earning methods — ad watching, daily
              tasks, and a referral program — into one dashboard, with earnings paid out in USDT
              so your balance holds its value and can be withdrawn without the friction of
              traditional banking.
            </p>
            <p>
              The name "EarnOmni" reflects that mission directly: <strong className="text-foreground">Earn</strong>{" "}
              for the real income users take home, and <strong className="text-foreground">Omni</strong> for the
              all-in-one, all-around approach we take to helping users earn — one platform, multiple ways to earn.
            </p>
          </div>
        </Card>
      </section>

      {/* What we offer */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-center text-2xl font-bold md:text-3xl">What EarnOmni offers</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Card className="border-border/50 bg-card/50 p-6">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[image:var(--gradient-hero)]">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">Real USDT earnings</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Every task you complete adds toward a balance you can actually withdraw — paid in USDT,
              a US-dollar-pegged cryptocurrency.
            </p>
          </Card>
          <Card className="border-border/50 bg-card/50 p-6">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[image:var(--gradient-hero)]">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">Referral commissions</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Share your referral link and earn a commission on every friend's earnings — a passive
              way to grow your income over time.
            </p>
          </Card>
          <Card className="border-border/50 bg-card/50 p-6">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[image:var(--gradient-hero)]">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">Fair, secure by design</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Encrypted accounts and built-in fraud-detection safeguards keep task completion and
              earnings fair for every user on the platform.
            </p>
          </Card>
        </div>
      </section>

      {/* Built by */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <Card className="border-border/50 bg-card/50 p-8 text-center md:p-10">
          <h2 className="text-2xl font-bold">Built by i5Digital Hub LLC</h2>
          <p className="mt-4 text-muted-foreground">
            EarnOmni is developed and maintained by{" "}
            <strong className="text-foreground">i5Digital Hub LLC</strong>, a software development
            company focused on building practical, user-first digital products. i5Digital Hub LLC
            owns and operates EarnOmni end-to-end — from the platform's engineering to its ongoing
            support and updates.
          </p>
        </Card>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="text-center text-2xl font-bold md:text-3xl">Frequently asked questions</h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((faq, i) => (
            <Card key={faq.q} className="border-border/50 bg-card/50 p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={openFaq === i}
              >
                <span className="font-medium">{faq.q}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-5 text-sm text-muted-foreground">{faq.a}</div>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold md:text-3xl">Ready to start earning?</h2>
        <p className="mt-3 text-muted-foreground">
          Join EarnOmni today — it's free, and you can start completing tasks in minutes.
        </p>
        <Link to="/auth">
          <Button size="lg" className="mt-6 bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
            Start earning free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <Logo className="h-4 w-4 text-primary" />
            <span>© {new Date().getFullYear()} EarnOmni, a product of i5Digital Hub LLC. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <a href="/terms" className="hover:text-foreground">Terms</a>
            <a href="/privacy" className="hover:text-foreground">Privacy</a>
            <Link to="/advertisers" className="hover:text-foreground">Advertisers</Link>
            <a href="mailto:support@earnomni.com" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
