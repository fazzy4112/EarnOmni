import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard/earnings")({
  component: EarningsPage,
});

interface HistoryRow {
  id: string;
  date: string;
  source: string;
  points: number | null;
  usd: number;
}

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
        .limit(100);
      return data ?? [];
    },
  });

  const { data: taskEarnings = [] } = useQuery({
    queryKey: ["task_earnings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_completions")
        .select("*, tasks(title)")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .order("completed_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: gameWins = [] } = useQuery({
    queryKey: ["game_earnings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("winner_user_id", user!.id)
        .eq("status", "completed")
        .order("drawn_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: referralCommissions = [] } = useQuery({
    queryKey: ["referral_earnings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const history: HistoryRow[] = [
    ...views.map((v) => ({
      id: `ad-${v.id}`,
      date: v.watched_at,
      source: "Ad view",
      points: v.points_earned,
      usd: v.points_earned / 100,
    })),
    ...taskEarnings.map((tc) => ({
      id: `task-${tc.id}`,
      date: tc.completed_at,
      source: `Task: ${tc.tasks?.title ?? "Task"}`,
      points: tc.points_awarded,
      usd: tc.points_awarded ? Number(tc.points_awarded) / 1000 : 0,
    })),
    ...gameWins.map((r) => ({
      id: `game-${r.id}`,
      date: r.drawn_at,
      source: `$1 Game win (Round #${r.round_number})`,
      points: null,
      usd: Number(r.prize_amount),
    })),
    ...referralCommissions.map((r) => ({
      id: `ref-${r.id}`,
      date: r.created_at,
      source: "Referral commission (from a referral's plan purchase)",
      points: null,
      usd: Number(r.commission_amount),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
        <p className="mt-1 text-sm text-muted-foreground">
          Every source of earnings — ads, tasks, the $1 Game, and referral commissions — all in one place.
        </p>
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
              {history.map((h) => (
                <tr key={h.id} className="border-b border-border/30">
                  <td className="py-3">{new Date(h.date).toLocaleString()}</td>
                  <td className="py-3">{h.source}</td>
                  <td className="py-3 text-right text-primary">{h.points != null ? `+${h.points}` : "—"}</td>
                  <td className="py-3 text-right">${h.usd.toFixed(2)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No earnings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
