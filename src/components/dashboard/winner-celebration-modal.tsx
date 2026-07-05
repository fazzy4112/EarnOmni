import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { ShareWinButtons } from "@/components/dashboard/share-win-buttons";

export function WinnerCelebrationModal() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: win } = useQuery({
    queryKey: ["game_my_unseen_win", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "completed")
        .eq("winner_user_id", user!.id)
        .eq("winner_seen", false)
        .order("drawn_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (win) setOpen(true);
  }, [win]);

  const markSeen = async () => {
    if (!win) return;
    await supabase.from("game_rounds").update({ winner_seen: true }).eq("id", win.id);
    setOpen(false);
  };

  if (!win) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) markSeen(); }}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]">
            <Trophy className="h-8 w-8 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center text-2xl">Congratulations! 🎉</DialogTitle>
          <DialogDescription className="text-center">
            You won <span className="font-semibold text-primary">${win.prize_amount}</span> in Round #{win.round_number}
            {" "}of the EarnOmni $1 Game! It's already been added to your balance.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <p className="text-sm font-medium">Share your win</p>
          <ShareWinButtons prizeAmount={win.prize_amount} referralCode={profile?.referral_code} />
          <Button onClick={markSeen} className="w-full bg-[image:var(--gradient-hero)]">
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
