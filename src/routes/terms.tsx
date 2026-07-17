import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — EarnOmni" },
      { name: "description", content: "Terms of Service for EarnOmni, a task-completion and ad-watching earning platform operated by i5Digital Hub LLC." },
    ],
    links: [{ rel: "canonical", href: "https://earnomni.com/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-hero)]">
              <Logo className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">EarnOmni</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground">
          <p>
            These Terms of Service ("Terms") govern your use of EarnOmni (earnomni.com), operated by
            i5Digital Hub LLC ("EarnOmni", "we", "us"). By creating an account or using the platform,
            you agree to these Terms.
          </p>

          <div>
            <h2>1. Eligibility</h2>
            <p>You must be at least 18 years old to create an account and use EarnOmni. You are responsible for providing accurate information during sign-up.</p>
          </div>

          <div>
            <h2>2. How earning works</h2>
            <p>
              EarnOmni allows users to earn rewards by watching ads, completing tasks, participating in
              referrals, and other activities offered on the platform. Reward rates, daily limits, and
              available activities may change at any time at our discretion, including based on your
              subscription plan.
            </p>
          </div>

          <div>
            <h2>3. Withdrawals</h2>
            <p>
              Earnings are withdrawable in USDT (BEP20 network) once you reach the minimum withdrawal
              threshold shown in the app. We reserve the right to review withdrawal requests for fraud
              or abuse before processing them. Processing times are estimates, not guarantees.
            </p>
          </div>

          <div>
            <h2>4. Fraud and abuse</h2>
            <p>
              Any attempt to manipulate the platform — including automated clicking/watching, multiple
              accounts, VPN abuse to bypass geographic restrictions, or exploiting bugs — may result in
              suspension of your account and forfeiture of unpaid balance.
            </p>
          </div>

          <div>
            <h2>5. Deposits and paid plans</h2>
            <p>
              Paid plans are a <strong>one-time payment</strong> that unlocks higher earning rates and
              daily limits permanently on your account — there are no recurring charges or automatic
              renewals. Deposits and plan purchases are non-refundable except where required by
              applicable law. Deposited funds are separate from earned balance and are used only for
              features that explicitly require them (e.g. paid game entries).
            </p>
          </div>

          <div>
            <h2>6. Account termination</h2>
            <p>
              We may suspend or terminate accounts that violate these Terms, engage in fraudulent
              activity, or remain inactive for extended periods, subject to applicable law.
            </p>
          </div>

          <div>
            <h2>7. Limitation of liability</h2>
            <p>
              EarnOmni is provided "as is." We are not liable for indirect, incidental, or consequential
              damages arising from your use of the platform, including third-party advertising networks
              or offer providers integrated into the app.
            </p>
          </div>

          <div>
            <h2>8. Changes to these Terms</h2>
            <p>We may update these Terms from time to time. Continued use of EarnOmni after changes take effect constitutes acceptance of the updated Terms.</p>
          </div>

          <div>
            <h2>9. Contact</h2>
            <p>
              Questions about these Terms? Reach us through the{" "}
              <Link to="/auth" className="text-primary hover:underline">Support</Link> section after signing in, or email us at{" "}
              <a href="mailto:support@earnomni.com" className="text-primary hover:underline">support@earnomni.com</a>.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 py-10">
        <div className="mx-auto max-w-3xl px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} EarnOmni, a product of i5Digital Hub LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
