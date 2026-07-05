import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ticket, Trophy, Clock, Users, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/game")({
  component: GamePage,
});

function useCountdown(endsAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!endsAt) return null;
  const diff = Math.max(0, new Date(endsAt).getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, isOver: diff <= 0 };
}

function GamePage() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const { data: round, isLoading: roundLoading } = useQuery({
    queryKey: ["game_round_current"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "open")
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: myEntryCount = 0 } = useQuery({
    queryKey: ["game_my_entries", round?.id, user?.id],
    enabled: !!round?.id && !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("game_entries")
        .select("id", { count: "exact", head: true })
        .eq("round_id", round!.id)
        .eq("user_id", user!.id);
      return count ?? 0;
    },
  });

  const { data: multiplier = 1 } = useQuery({
    queryKey: ["game_multiplier", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("multiplier")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("multiplier", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.multiplier ?? 1;
    },
  });

  const { data: pastWinners = [] } = useQuery({
    queryKey: ["game_past_winners"],
    queryFn: async () => {
      const { data: rounds } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "completed")
        .order("drawn_at", { ascending: false })
        .limit(5);
      if (!rounds?.length) return [];
      const winnerIds = rounds.map((r) => r.winner_user_id).filter(Boolean);
      const { data: winners } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", winnerIds as string[]);
      return rounds.map((r) => ({
        ...r,
        winner: winners?.find((w) => w.id === r.winner_user_id),
      }));
    },
  });

  const countdown = useCountdown(round?.ends_at ?? null);

  const enterMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("enter_game_round");
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Entry confirmed — good luck!");
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["game_round_current"] });
      queryClient.invalidateQueries({ queryKey: ["game_my_entries"] });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Couldn't enter the game";
      toast.error(msg);
    },
  });

  const depositBalance = Number(profile?.deposit_balance ?? 0);
  const entryFee = Number(round?.entry_fee ?? 1);
  const canEnter = depositBalance >= entryFee && !countdown?.isOver;

  const maskedName = (name: string | null | undefined, email: string | null | undefined) => {
    if (name && name.trim()) return name;
    if (email) return email.slice(0, 3) + "***";
    return "A lucky winner";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">$1 Game</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay $1 for a chance to win a ${round?.prize_amount ?? 100} prize. A winner is drawn automatically every round.
        </p>
      </div>

      <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6 md:p-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4" /> Prize
            </p>
            <p className="mt-1 text-3xl font-bold text-primary">${round?.prize_amount ?? 100}</p>
          </div>
          <div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> Total entries this round
            </p>
            <p className="mt-1 text-3xl font-bold">{round?.total_entries ?? 0}</p>
          </div>
          <div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> Round ends in
            </p>
            {countdown ? (
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">Loading…</p>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start gap-4 border-t border-border/40 pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Your tickets this round: <span className="font-semibold text-foreground">{myEntryCount}</span>
            </p>
            {multiplier > 1 && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Your plan gives you {multiplier}x tickets per $1 entry
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              Deposit balance: <span className="font-medium text-foreground">${depositBalance.toFixed(2)}</span>
              {" · "}Entries can only be paid from deposited funds.
            </p>
          </div>
          <Button
            size="lg"
            disabled={!canEnter || enterMutation.isPending || roundLoading}
            onClick={() => enterMutation.mutate()}
            className="bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]"
          >
            {enterMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Ticket className="mr-2 h-4 w-4" />
            Enter for ${entryFee.toFixed(2)}
          </Button>
        </div>
        {!canEnter && depositBalance < entryFee && (
          <p className="mt-3 text-sm text-warning">
            You need at least ${entryFee.toFixed(2)} in your deposit balance to enter. Deposits are coming soon.
          </p>
        )}
      </Card>

      <Card className="border-border/50 bg-card/50 p-6">
        <h2 className="text-lg font-semibold">Past winners</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every draw is automatic and random — no manual selection, ever.
        </p>
        <div className="mt-4 space-y-3">
          {pastWinners.length === 0 && (
            <p className="text-sm text-muted-foreground">No rounds completed yet — be the first winner!</p>
          )}
          {pastWinners.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[image:var(--gradient-hero)]">
                  <Trophy className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{maskedName(r.winner?.full_name, r.winner?.email)}</p>
                  <p className="text-xs text-muted-foreground">
                    Round #{r.round_number} · {r.total_entries} entries
                  </p>
                </div>
              </div>
              <p className="font-semibold text-primary">${r.prize_amount}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
