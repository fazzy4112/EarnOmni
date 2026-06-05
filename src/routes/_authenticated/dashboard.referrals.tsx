import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/referrals")({
  component: ReferralsPage,
});

function ReferralsPage() {
  const { user, profile } = useAuth();
  const link = typeof window !== "undefined" && profile?.referral_code
    ? `${window.location.origin}/auth?ref=${profile.referral_code}`
    : "";

  const { data: referrals = [] } = useQuery({
    queryKey: ["referrals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user!.id);
      return data ?? [];
    },
  });

  const total = referrals.reduce((s, r: { commission_amount: number }) => s + Number(r.commission_amount), 0);

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
          <p className="text-3xl font-bold">{referrals.length}</p>
        </Card>
        <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6">
          <p className="text-sm text-muted-foreground">Lifetime commission</p>
          <p className="text-3xl font-bold text-primary">${total.toFixed(2)}</p>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 p-6">
        <h3 className="text-lg font-semibold">Your referral code</h3>
        <p className="mt-1 text-sm text-muted-foreground">Share this to earn 10% commission on every referral's earnings.</p>
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
    </div>
  );
}