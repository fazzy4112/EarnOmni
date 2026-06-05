import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Crown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/subscription")({
  component: SubscriptionPage,
});

const PLANS = [
  { name: "basic", label: "Basic", price: 0, mult: 1, perks: ["10 ads/day", "1x earning", "Manual withdrawal"] },
  { name: "silver", label: "Silver", price: 10, mult: 2, perks: ["10 ads/day", "2x earning multiplier", "Priority support"] },
  { name: "gold", label: "Gold", price: 25, mult: 4, perks: ["10 ads/day", "4x earning multiplier", "Instant withdrawal"] },
];

function SubscriptionPage() {
  const { user, profile, refreshProfile } = useAuth();

  const upgrade = async (planName: string, price: number, mult: number) => {
    if (!user) return;
    const end = new Date();
    end.setDate(end.getDate() + 30);
    await supabase.from("subscriptions").insert({
      user_id: user.id,
      plan_name: planName,
      multiplier: mult,
      price_usd: price,
      end_date: end.toISOString(),
      is_active: true,
    });
    await supabase.from("profiles").update({ plan: planName }).eq("id", user.id);
    toast.success(`Upgraded to ${planName}!`);
    refreshProfile();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Subscription Plans</h2>
        <p className="text-muted-foreground">Current plan: <span className="font-semibold text-primary capitalize">{profile?.plan ?? "basic"}</span></p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((p) => {
          const active = profile?.plan === p.name;
          return (
            <Card key={p.name} className={`relative overflow-hidden p-8 ${active ? "border-primary bg-[image:var(--gradient-card)] ring-2 ring-primary" : "border-border/50 bg-card/50"}`}>
              {p.name === "gold" && <Crown className="absolute right-4 top-4 h-5 w-5 text-yellow-400" />}
              <h3 className="text-xl font-bold">{p.label}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">${p.price}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 space-y-2">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> {perk}
                  </li>
                ))}
              </ul>
              <Button
                className={`mt-8 w-full ${active ? "" : "bg-[image:var(--gradient-hero)]"}`}
                variant={active ? "outline" : "default"}
                disabled={active}
                onClick={() => upgrade(p.name, p.price, p.mult)}
              >
                {active ? "Current plan" : p.price === 0 ? "Downgrade" : "Upgrade"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}