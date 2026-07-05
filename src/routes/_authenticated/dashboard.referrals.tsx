import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/referrals")({
  component: ReferralsPage,
});

function ReferralsPage() {
  const { user, profile } = useAuth();
  const link = typeof window !== "undefined" && profile?.referral_code
    ? `${window.location.origin}/auth?ref=${profile.referral_code}`
    : "";

  // People who actually signed up with my referral code — this is the
  // real "total referrals" count, independent of whether they've earned
  // (and therefore triggered a commission) yet.
  const { data: referredUsers = [] } = useQuery({
    queryKey: ["referred_users", profile?.referral_code],
    enabled: !!profile?.referral_code,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_number, created_at")
        .eq("referred_by", profile!.referral_code)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Commission earned so far (logged whenever a referred user earns).
  const { data: commissions = [] } = useQuery({
    queryKey: ["referral_commissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user!.id);
      return data ?? [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["platform_settings_referrals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("referral_commission_basic, referral_commission_silver, referral_commission_gold")
        .eq("id", 1)
        .single();
      return data;
    },
  });

  const myCommissionPercent =
    profile?.plan === "gold" ? (settings?.referral_commission_gold ?? 20)
    : profile?.plan === "silver" ? (settings?.referral_commission_silver ?? 10)
    : (settings?.referral_commission_basic ?? 5);

  const totalCommission = commissions.reduce((s, r: { commission_amount: number }) => s + Number(r.commission_amount), 0);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6">
          <Users className="h-6 w-6 text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Total referrals</p>
          <p className="text-3xl font-bold">{referredUsers.length}</p>
        </Card>
        <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6">
          <p className="text-sm text-muted-foreground">Lifetime commission</p>
          <p className="text-3xl font-bold text-primary">${totalCommission.toFixed(2)}</p>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 p-6">
        <h3 className="text-lg font-semibold">Your referral code</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Share this to earn <span className="font-semibold text-primary">{myCommissionPercent}%</span> commission
          on every referral's earnings — your {profile?.plan ?? "basic"} plan's rate.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg border border-border bg-input px-4 py-3 font-mono text-lg">
              {profile?.referral_code ?? "—"}
            </div>
            <Button onClick={() => copy(profile?.referral_code ?? "")} variant="outline" size="lg">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 truncate rounded-lg border border-border bg-input px-4 py-3 text-sm">
              {link}
            </div>
            <Button onClick={() => copy(link)} variant="outline" size="lg">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-border/50 bg-card/50 p-6">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">People you've referred</h3>
        </div>
        <div className="mt-4 space-y-2">
          {referredUsers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No one has joined with your link yet — share it to start earning commission.
            </p>
          )}
          {referredUsers.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{r.full_name || r.email}</p>
                <p className="text-xs text-muted-foreground">UID-{r.user_number}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Joined {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
