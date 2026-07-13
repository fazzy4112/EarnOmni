import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, X } from "lucide-react";

export function LatestWinnerBanner() {
  const [dismissed, setDismissed] = useState(false);

  const { data: latest } = useQuery({
    queryKey: ["game_latest_winner_banner"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: round } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "completed")
        .order("drawn_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!round?.winner_user_id) return null;
      const { data: winners } = await supabase.rpc("get_public_profiles", { p_user_ids: [round.winner_user_id] });
      const winner = winners?.[0] ?? null;
      return { round, winner };
    },
  });

  if (!latest || dismissed) return null;

  const name = latest.winner?.full_name?.trim() || "A lucky user";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-[image:var(--gradient-hero)]/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[image:var(--gradient-hero)]">
          <Trophy className="h-4 w-4 text-primary-foreground" />
        </div>
        <p className="text-sm">
          <span className="font-semibold">{name}</span>
          {latest.winner?.user_number && (
            <span className="ml-1 text-xs text-muted-foreground">(UID-{latest.winner.user_number})</span>
          )}{" "}
          just won{" "}
          <span className="font-semibold text-primary">${latest.round.prize_amount}</span> in the $1 Game (Round #{latest.round.round_number})!{" "}
          <Link to="/dashboard/game" className="underline underline-offset-2 hover:text-primary">
            Join the next round →
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
