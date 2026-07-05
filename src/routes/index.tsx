import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight, CheckCircle2, Crown, ShieldCheck,
  Users, Wallet, PlayCircle, UserPlus,
  Banknote, Loader2, Menu, X, ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { FAQS, faqJsonLd } from "@/lib/faqs";
import heroImage from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EarnOmni — Complete Tasks & Earn Real Money in USDT" },
      { name: "description", content: "Join 10,000+ users earning real USDT by completing simple online tasks — watch ads, refer friends, and cash out fast. Free to start, no experience needed." },
    ],
  }),
  component: Index,
});

function Index() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Adsterra Popunder — passive site monetization on the home/landing
  // page only. Not tied to the ad-watch reward system in any way; it
  // doesn't count toward the daily ad quota or pay users.
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://pl30196373.effectivecpmnetwork.com/3b/fe/10/3bfe100f92e01abb1c430124b9c6616e.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Load plans from DATABASE — auto updates when admin changes!
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["public_plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
            <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#plans" className="text-sm text-muted-foreground hover:text-foreground">Plans</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</a>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground">About</Link>
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
            <a href="#how" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">How it works</a>
            <a href="#plans" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Plans</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Features</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">FAQ</a>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">About</Link>
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
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-2 lg:py-32">
          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Live payouts — over $50,000 distributed
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl">
              Complete Simple Tasks,{" "}
              <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">
                Earn Real Money
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Watch ads, refer friends, and complete daily tasks — then withdraw your earnings in USDT. No experience needed — just consistency.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/auth">
                <Button size="lg" className="bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
                  Start Earning Free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="outline">Learn More</Button>
              </a>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-border/50 pt-8">
              <Stat label="Users" value="10,000+" />
              <Stat label="Paid Out" value="$50K+" />
              <Stat label="Uptime" value="99.9%" />
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-[image:var(--gradient-hero)] opacity-30 blur-3xl" />
            <img src={heroImage} alt="EarnOmni earning platform" width={1536} height={1024}
              className="rounded-2xl border border-border/50 shadow-2xl" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How it works</h2>
            <p className="mt-4 text-muted-foreground">Three steps from sign-up to your first payout.</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              { icon: UserPlus, n: "01", title: "Create free account", desc: "Sign up in 30 seconds with email. No credit card required." },
              { icon: PlayCircle, n: "02", title: "Watch ads daily", desc: "Watch up to 10 ads per day and earn points for every view." },
              { icon: Banknote, n: "03", title: "Withdraw earnings", desc: "Cash out your points as USDT directly to your BEP20 wallet." },
            ].map((s) => (
              <Card key={s.n} className="relative overflow-hidden border-border/50 bg-[image:var(--gradient-card)] p-8">
                <span className="absolute right-6 top-6 text-5xl font-bold text-muted-foreground/10">{s.n}</span>
                <s.icon className="h-10 w-10 text-primary" />
                <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Plans — DYNAMIC from database */}
      <section id="plans" className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Subscription Plans</h2>
            <p className="mt-4 text-muted-foreground">Boost your earnings with a paid plan — cancel anytime.</p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {plans.map((plan: any) => (
                <Card key={plan.id}
                  className={`relative overflow-hidden border-border/50 p-8 transition-all ${
                    plan.is_popular
                      ? "bg-[image:var(--gradient-card)] ring-2 ring-primary shadow-[var(--shadow-glow)]"
                      : "bg-card/50 hover:bg-card/80"
                  }`}
                >
                  {/* Most Popular Badge */}
                  {plan.is_popular && (
                    <span className="absolute right-4 top-4 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
                      Most popular
                    </span>
                  )}

                  {/* Gold Crown */}
                  {plan.name === "gold" && (
                    <Crown className="absolute left-4 top-4 h-5 w-5 text-yellow-400" />
                  )}

                  <h3 className="text-lg font-semibold mt-2">{plan.label}</h3>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${plan.price_usd}</span>
                    <span className="text-sm text-muted-foreground">
                      {plan.price_usd === 0 ? "/forever" : "/month"}
                    </span>
                  </div>

                  {/* Multiplier badge */}
                  <div className="mt-2">
                    <span className="text-sm font-semibold text-emerald-400">
                      {plan.multiplier}x earning multiplier
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {(plan.features ?? []).map((perk: string) => (
                      <li key={perk} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        {perk}
                      </li>
                    ))}
                  </ul>

                  <Link to="/auth">
                    <Button
                      className={`mt-8 w-full ${plan.is_popular ? "bg-[image:var(--gradient-hero)]" : ""}`}
                      variant={plan.is_popular ? "default" : "outline"}
                    >
                      Get started
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Built for serious earners</h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, title: "Anti-fraud system", desc: "Smart detection blocks bots so real users get paid." },
              { icon: Users, title: "Referral rewards", desc: "Earn lifetime commission on every friend you invite." },
              { icon: Wallet, title: "Crypto withdrawal", desc: "Withdraw to USDT on BEP20 (BNB Smart Chain) network." },
              { icon: Crown, title: "Investor tasks", desc: "Premium tasks from verified advertisers pay even more." },
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

      {/* FAQ */}
      <section id="faq" className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-3xl font-bold md:text-4xl">Frequently asked questions</h2>
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
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Start earning today</h2>
          <p className="mt-4 text-muted-foreground">Join thousands of users already cashing out weekly.</p>
          <Link to="/auth">
            <Button size="lg" className="mt-8 bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
              Create your free account <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
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
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-bold md:text-3xl">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}