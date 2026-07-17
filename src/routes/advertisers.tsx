import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight, PlayCircle, CheckCircle2, Users,
  Wallet, ShieldCheck, Crown, Menu, X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";

export const Route = createFileRoute("/advertisers")({
  head: () => ({
    meta: [
      { title: "Advertise on EarnOmni — Reach an Engaged Rewarded Audience" },
      { name: "description", content: "Run ads and sponsor tasks directly on EarnOmni. No network middleman — set your own reward, reach users who opt in, and only pay for reviewed completions." },
    ],
    links: [{ rel: "canonical", href: "https://earnomni.com/advertisers" }],
  }),
  component: AdvertisersPage,
});

function AdvertisersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
              <Logo className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">EarnOmni</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
            <a href="/#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
            <a href="/#plans" className="text-sm text-muted-foreground hover:text-foreground">Plans</a>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/advertisers" className="text-sm font-medium text-foreground">Advertisers</Link>
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
            <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">About</Link>
            <Link to="/advertisers" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm font-medium text-foreground">Advertisers</Link>
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
        <div className="pointer-events-none absolute inset-0 opacity-50"
          style={{ background: "radial-gradient(60% 60% at 50% 0%, oklch(0.4 0.2 280 / 0.5), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-3xl px-6 py-24 text-center lg:py-32">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Now onboarding our first direct advertisers
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Advertise directly.{" "}
            <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">
              Skip the network.
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            EarnOmni pays users in USDT to watch ads and complete tasks. Work with us directly instead of through an ad network — you set the reward, we handle delivery and review every completion.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href="mailto:advertisers@earnomni.com">
              <Button size="lg" className="bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
                Get in touch <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <a href="#formats">
              <Button size="lg" variant="outline">See how it works</Button>
            </a>
          </div>
        </div>
      </section>

      {/* What you can run */}
      <section id="formats" className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">What you can run</h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              { icon: PlayCircle, title: "Ad views", desc: "Your video or link is shown to users who watch for a set duration. View time is tracked server-side, not on the honour system." },
              { icon: CheckCircle2, title: "Sponsor tasks", desc: "Ask users to visit a page, follow an account, or try a product. Each submission is reviewed by us before the user is paid." },
              { icon: Users, title: "Referral reach", desc: "Our users invite others and earn commission for it, so campaigns spread beyond the people who see them first." },
            ].map((f) => (
              <Card key={f.title} className="border-border/50 bg-card/50 p-6">
                <f.icon className="h-8 w-8 text-accent" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why direct beats a network */}
      <section className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Why direct beats a network</h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              { icon: Wallet, title: "No middleman markup", desc: "Ad networks take a cut before anything reaches the user. Direct means more of your budget becomes real reward — which means better completion rates." },
              { icon: ShieldCheck, title: "Reviewed, not automated", desc: "Every task completion is checked before payout. You are not paying for bot traffic." },
              { icon: Crown, title: "Early partner attention", desc: "We are a new platform and we are small. Your campaign gets set up by a person, not a dashboard queue." },
            ].map((f) => (
              <Card key={f.title} className="border-border/50 bg-card/50 p-6">
                <f.icon className="h-8 w-8 text-accent" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Honest about where we are */}
      <section className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-display text-center text-3xl font-bold md:text-4xl">Honest about where we are</h2>
          <Card className="mt-10 border-border/50 bg-card/50 p-8 md:p-10">
            <p className="text-muted-foreground">
              EarnOmni launched in 2026 and is early-stage. We are not going to quote you inflated reach numbers. What we can tell you is exactly how many users saw your ad, how many completed your task, and which of those we approved — because we review each one. If you want scale today, a large network is a better fit. If you want a direct relationship, transparent reporting, and rates set with you rather than at you, talk to us.
            </p>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">How it works</h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", title: "Tell us your goal", desc: "Send us the link, the action you want, and your budget." },
              { n: "02", title: "We set it up", desc: "We configure the ad or task, set the reward, and put it in front of users." },
              { n: "03", title: "You get reviewed results", desc: "You see completions we have verified. No bot padding, no mystery numbers." },
            ].map((s) => (
              <Card key={s.n} className="relative overflow-hidden border-border/50 bg-[image:var(--gradient-card)] p-8">
                <span className="absolute right-6 top-6 text-5xl font-bold text-muted-foreground/10">{s.n}</span>
                <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Let's talk</h2>
          <p className="mt-4 text-muted-foreground">Email us with what you want to promote and we'll come back with a plan.</p>
          <a href="mailto:advertisers@earnomni.com">
            <Button size="lg" className="mt-8 bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
              advertisers@earnomni.com <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </section>

      <footer className="border-t border-border/40 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <Logo className="h-4 w-4 text-primary" />
            <span>© {new Date().getFullYear()} EarnOmni, a product of i5Digital Hub LLC. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/advertisers" className="hover:text-foreground">Advertisers</Link>
            <a href="mailto:support@earnomni.com" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
