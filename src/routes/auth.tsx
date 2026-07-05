import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, MailCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — EarnOmni" },
      { name: "description", content: "Sign in or create your free EarnOmni account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ref } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(ref ? "signup" : "signin");
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(ref ? ref.toUpperCase() : "");
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const redirectUrl = `${window.location.origin}/dashboard`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName,
              referred_by: referralCode || null,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          // Email confirmation is disabled on this project — user is signed in right away.
          toast.success("Account created! Welcome to EarnOmni.");
          navigate({ to: "/dashboard" });
        } else {
          // Email confirmation required — nothing to sign in to yet.
          setPendingConfirmEmail(email);
          setResendCooldown(45);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    if (!pendingConfirmEmail || resendCooldown > 0) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingConfirmEmail,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast.success("Confirmation email resent.");
      setResendCooldown(45);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't resend email";
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, oklch(0.4 0.2 280 / 0.5), transparent 70%)" }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[image:var(--gradient-hero)]">
            <Logo className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">EarnOmni</span>
        </Link>

        <Card className="border-border/50 bg-card/80 p-8 backdrop-blur-xl">
          {pendingConfirmEmail ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[image:var(--gradient-hero)]">
                <MailCheck className="h-7 w-7 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">Confirm your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We've sent a confirmation link to{" "}
                <span className="font-medium text-foreground">{pendingConfirmEmail}</span>.
                Open it to activate your account — then come back and sign in.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={resending || resendCooldown > 0}
                onClick={resendConfirmation}
                className="mt-6 w-full"
              >
                {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {resendCooldown > 0 ? `Resend email (${resendCooldown}s)` : "Resend confirmation email"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setPendingConfirmEmail(null);
                  setMode("signup");
                }}
                className="mt-4 text-xs text-muted-foreground hover:text-foreground"
              >
                Wrong email? Go back and edit it
              </button>
            </div>
          ) : (
            <>
          <div className="mb-6 flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === "signin" ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === "signup" ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Sign up
            </button>
          </div>

          <h1 className="text-2xl font-bold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to continue earning."
              : "Start earning in less than a minute."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
              />
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="ref">Referral code (optional)</Label>
                <Input
                  id="ref"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="FRIEND123"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
            </>
          )}
        </Card>

        <Link to="/" className="mt-6 text-center text-xs text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
