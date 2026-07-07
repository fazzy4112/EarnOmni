import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Crown, Copy, AlertCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/subscription")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [txHash, setTxHash] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load plans from DATABASE — not hardcoded!
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("id", 1)
        .single();
      return data;
    },
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pending_subscriptions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", false)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const platformAddress = settings?.usdt_bep20_address ?? "";

  const copyAddress = () => {
    navigator.clipboard.writeText(platformAddress);
    toast.success("Address copied!");
  };

  const submitPayment = async () => {
    if (!user || !selectedPlan) return;
    if (!txHash || txHash.length < 10) {
      toast.error("Please enter a valid transaction hash!");
      return;
    }
    setSubmitting(true);
    const end = new Date();
    end.setDate(end.getDate() + (selectedPlan.duration_days || 30));

    const { error } = await supabase.from("subscriptions").insert({
      user_id: user.id,
      plan_name: selectedPlan.name,
      multiplier: selectedPlan.multiplier,
      price_usd: selectedPlan.price_usd,
      end_date: end.toISOString(),
      is_active: false,
    });

    if (error) { toast.error(error.message); setSubmitting(false); return; }
    toast.success("✅ Payment submitted! Admin will verify and activate within 24 hours.");
    setSelectedPlan(null);
    setTxHash("");
    setSubmitting(false);
    refreshProfile();
  };

  if (plansLoading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Upgrade Plans</h2>
        <p className="text-muted-foreground">
          One-time payment, lifetime benefits — no recurring charges. Current plan:{" "}
          <span className="font-semibold text-primary capitalize">
            {profile?.plan ?? "basic"}
          </span>
        </p>
      </div>

      {/* Plans Grid — loaded from database */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p: any) => {
          const active = profile?.plan === p.name;
          const isPaid = p.price_usd > 0;
          return (
            <Card key={p.name}
              className={`relative overflow-hidden p-6 transition-all ${
                active
                  ? "border-primary ring-2 ring-primary bg-[image:var(--gradient-card)]"
                  : selectedPlan?.name === p.name
                  ? "border-emerald-500 ring-2 ring-emerald-500"
                  : "border-border/50 bg-card/50 hover:border-border"
              }`}
            >
              {p.is_popular && (
                <div className="absolute -top-0 left-0 right-0 flex justify-center">
                  <span className="bg-primary text-white text-xs px-4 py-1 rounded-b-lg">
                    ⭐ Most Popular
                  </span>
                </div>
              )}
              {p.name === "gold" && <Crown className="absolute right-4 top-4 h-5 w-5 text-yellow-400" />}
              {active && (
                <span className="absolute left-4 top-4 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}

              <h3 className="text-xl font-bold mt-5">{p.label}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">${p.price_usd}</span>
                <span className="text-sm text-muted-foreground">
                  {p.price_usd === 0 ? "/forever" : "one-time"}
                </span>
              </div>
              <div className="mt-1 text-sm font-semibold text-emerald-400">
                {p.multiplier}x earning multiplier
              </div>

              <ul className="mt-4 space-y-2">
                {(p.features ?? []).map((feat: string) => (
                  <li key={feat} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>

              <Button
                className={`mt-6 w-full ${
                  active ? "" : isPaid ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""
                }`}
                variant={active ? "outline" : "default"}
                disabled={active}
                onClick={() => { if (!active && isPaid) setSelectedPlan(p); }}
              >
                {active ? "✅ Current Plan" : isPaid ? `Upgrade to ${p.label}` : "Downgrade"}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Payment Instructions */}
      {selectedPlan && (
        <Card className="border-emerald-500/50 bg-card/80 p-6">
          <h3 className="text-lg font-semibold mb-1">
            💳 Pay for {selectedPlan.label} Plan — ${selectedPlan.price_usd} USDT
          </h3>
          <p className="text-sm text-muted-foreground mb-5">
            Send exact amount and submit transaction hash below
          </p>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-sm font-semibold mb-2">Step 1 — Send USDT to this address</p>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded">BSC</span>
                <span className="text-sm font-medium">USDT BEP20 (BNB Smart Chain)</span>
              </div>
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">Only send on <strong>BEP20 (BSC)</strong> network! Wrong network = permanent loss!</p>
              </div>
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 mb-3">
                <span className="text-sm text-muted-foreground">Amount to send:</span>
                <span className="text-xl font-bold text-emerald-400">${selectedPlan.price_usd} USDT</span>
              </div>
              <p className="text-xs text-muted-foreground mb-1">Platform Wallet Address:</p>
              <div className="flex items-center gap-2 bg-background rounded-lg border border-border px-3 py-2">
                <p className="text-sm font-mono text-primary flex-1 break-all">{platformAddress || "Loading..."}</p>
                <button onClick={copyAddress} className="flex-shrink-0 text-muted-foreground hover:text-foreground p-1">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-sm font-semibold mb-3">Step 2 — Submit Transaction Hash</p>
              <p className="text-xs text-muted-foreground mb-2">After sending, copy transaction hash from your wallet:</p>
              <Input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x... transaction hash" className="font-mono text-sm" />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-3">
              <Clock className="h-4 w-4 flex-shrink-0" />
              Admin will verify and activate your plan within 24 hours
            </div>

            <div className="flex gap-3">
              <Button onClick={submitPayment} disabled={submitting || !txHash} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">
                {submitting ? "Submitting..." : "✅ Submit Payment"}
              </Button>
              <Button variant="outline" onClick={() => { setSelectedPlan(null); setTxHash(""); }}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-border/50 bg-card/80 p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-400" /> Pending Plan Requests
          </h3>
          <div className="space-y-2">
            {pendingRequests.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
                <div>
                  <p className="font-medium capitalize">{req.plan_name} Plan</p>
                  <p className="text-xs text-muted-foreground">Submitted: {new Date(req.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full">⏳ Pending</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}