import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  ShieldCheck,
  Users,
  Wallet,
  Sparkles,
  PlayCircle,
  UserPlus,
  Banknote,
} from "lucide-react";
import heroImage from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdEarn — Watch Ads, Earn Real Money in USDT" },
      { name: "description", content: "Join 10,000+ users earning real USDT by watching ads and completing simple tasks. Free to start." },
      { property: "og:title", content: "AdEarn — Watch Ads, Earn Real Money" },
      { property: "og:description", content: "Join 10,000+ users earning real USDT by watching ads and completing simple tasks." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AdEarn</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#plans" className="text-sm text-muted-foreground hover:text-foreground">Plans</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm" className="bg-[image:var(--gradient-hero)]">Start free</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, oklch(0.4 0.2 280 / 0.5), transparent 70%)",
          }}
        />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-2 lg:py-32">
          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Live payouts — over $50,000 distributed
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl">
              Watch Ads,{" "}
              <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">
                Earn Real Money
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Complete simple tasks, watch advertisements and withdraw your earnings
              in USDT. No experience needed — just consistency.
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
            <img
              src={heroImage}
              alt="AdEarn earning platform"
              width={1536}
              height={1024}
              className="rounded-2xl border border-border/50 shadow-2xl"
            />
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
              { icon: Banknote, n: "03", title: "Withdraw earnings", desc: "Cash out your points as USDT directly to your wallet." },
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

      {/* Plans */}
      <section id="plans" className="border-t border-border/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Subscription Plans</h2>
            <p className="mt-4 text-muted-foreground">Boost your earnings with a paid plan — cancel anytime.</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <PlanCard name="Basic" price="$0" period="forever" perks={["10 ads/day", "1x earning", "Manual withdrawal"]} />
            <PlanCard featured name="Silver" price="$10" period="/month" perks={["10 ads/day", "2x earning multiplier", "Priority support"]} />
            <PlanCard name="Gold" price="$25" period="/month" perks={["10 ads/day", "4x earning multiplier", "Instant withdrawal"]} />
          </div>
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
              { icon: Wallet, title: "Crypto withdrawal", desc: "Withdraw to USDT on TRC20 or BEP20 networks." },
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
            <Sparkles className="h-4 w-4 text-primary" />
            <span>© {new Date().getFullYear()} AdEarn. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
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

function PlanCard({
  name,
  price,
  period,
  perks,
  featured,
}: {
  name: string;
  price: string;
  period: string;
  perks: string[];
  featured?: boolean;
}) {
  return (
    <Card
      className={`relative overflow-hidden border-border/50 p-8 ${
        featured ? "bg-[image:var(--gradient-card)] ring-2 ring-primary shadow-[var(--shadow-glow)]" : "bg-card/50"
      }`}
    >
      {featured && (
        <span className="absolute right-4 top-4 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-semibold">{name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-sm text-muted-foreground">{period}</span>
      </div>
      <ul className="mt-6 space-y-3">
        {perks.map((p) => (
          <li key={p} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" /> {p}
          </li>
        ))}
      </ul>
      <Link to="/auth">
        <Button className={`mt-8 w-full ${featured ? "bg-[image:var(--gradient-hero)]" : ""}`} variant={featured ? "default" : "outline"}>
          Get started
        </Button>
      </Link>
    </Card>
  );
}
