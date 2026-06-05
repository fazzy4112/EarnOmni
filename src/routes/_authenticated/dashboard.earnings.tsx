import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard/earnings")({
  component: EarningsPage,
});

function EarningsPage() {
  const { user, profile } = useAuth();
  const { data: views = [] } = useQuery({
    queryKey: ["all_views", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("ad_views")
        .select("*")
        .eq("user_id", user!.id)
        .order("watched_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6">
          <p className="text-sm text-muted-foreground">Available balance</p>
          <p className="mt-2 text-3xl font-bold text-primary">${(profile?.balance ?? 0).toFixed(2)}</p>
        </Card>
        <Card className="border-border/50 bg-card/50 p-6">
          <p className="text-sm text-muted-foreground">Total points</p>
          <p className="mt-2 text-3xl font-bold">{profile?.points ?? 0}</p>
        </Card>
        <Card className="border-border/50 bg-card/50 p-6">
          <p className="text-sm text-muted-foreground">Ads watched (all-time)</p>
          <p className="mt-2 text-3xl font-bold">{views.length}</p>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 p-6">
        <h3 className="text-lg font-semibold">Earning history</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground">
                <th className="pb-2">Date</th>
                <th className="pb-2">Source</th>
                <th className="pb-2 text-right">Points</th>
                <th className="pb-2 text-right">USD</th>
              </tr>
            </thead>
            <tbody>
              {views.map((v) => (
                <tr key={v.id} className="border-b border-border/30">
                  <td className="py-3">{new Date(v.watched_at).toLocaleString()}</td>
                  <td className="py-3">Ad view</td>
                  <td className="py-3 text-right text-primary">+{v.points_earned}</td>
                  <td className="py-3 text-right">${(v.points_earned / 100).toFixed(2)}</td>
                </tr>
              ))}
              {views.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No earnings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}