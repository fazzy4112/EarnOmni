import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — EarnOmni" },
      { name: "description", content: "Privacy Policy for EarnOmni, explaining what data we collect and how it's used." },
    ],
    links: [{ rel: "canonical", href: "https://earnomni.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
        <h1 className="font-display text-3xl font-bold md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground">
          <p>
            This Privacy Policy explains what information EarnOmni (operated by i5Digital Hub LLC)
            collects, how it's used, and the choices you have.
          </p>

          <div>
            <h2>1. Information we collect</h2>
            <p>
              We collect the information you provide when creating an account (name, email), activity
              data needed to run the platform (ads watched, tasks completed, referral relationships,
              deposit and withdrawal records), and technical data such as IP address and device type used
              for fraud prevention.
            </p>
          </div>

          <div>
            <h2>2. How we use your information</h2>
            <p>
              We use your information to operate your account, process earnings and withdrawals, prevent
              fraud and abuse, communicate with you about your account or support requests, and improve
              the platform.
            </p>
          </div>

          <div>
            <h2>3. Third-party services</h2>
            <p>
              EarnOmni integrates with third-party advertising and offer networks to deliver ads and
              paid offers. These providers may independently collect data (such as device or completion
              signals) under their own privacy policies when you interact with their ads or offers.
              We also use Supabase for our database and authentication infrastructure.
            </p>
          </div>

          <div>
            <h2>4. Data retention</h2>
            <p>
              We retain account and transaction data for as long as your account is active, and as
              needed to comply with legal, accounting, or fraud-prevention obligations after account
              closure.
            </p>
          </div>

          <div>
            <h2>5. Your choices</h2>
            <p>
              You can update your profile information from Settings at any time. To request account
              deletion or export of your data, please contact us using the details below.
            </p>
          </div>

          <div>
            <h2>6. Security</h2>
            <p>
              We use industry-standard practices (encrypted connections, access controls) to protect
              your data, but no online service can guarantee absolute security.
            </p>
          </div>

          <div>
            <h2>7. Changes to this policy</h2>
            <p>We may update this Privacy Policy from time to time. We'll post the updated version on this page with a new "last updated" date.</p>
          </div>

          <div>
            <h2>8. Contact</h2>
            <p>
              Questions about this policy or your data? Email us at{" "}
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
