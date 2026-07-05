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
import { Trophy, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

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

  const referralCode = profile?.referral_code;
  const shareUrl = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode}`
    : window.location.origin;
  const shareText = `I just won $${win.prize_amount} on EarnOmni's $1 Game! 🎉 Join and play:`;
  const fullShareText = `${shareText} ${shareUrl}`;

  const copyShare = () => {
    navigator.clipboard.writeText(fullShareText);
    toast.success("Copied — paste it anywhere!");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url: shareUrl });
      } catch {
        // user cancelled — ignore
      }
    } else {
      copyShare();
    }
  };

  const waLink = `https://wa.me/?text=${encodeURIComponent(fullShareText)}`;
  const twitterLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullShareText)}`;
  const fbLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;

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
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={nativeShare} className="justify-center gap-2">
              <Share2 className="h-4 w-4" /> Share
            </Button>
            <Button variant="outline" onClick={copyShare} className="justify-center gap-2">
              <Copy className="h-4 w-4" /> Copy link
            </Button>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              WhatsApp
            </a>
            <a
              href={twitterLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              X / Twitter
            </a>
            <a
              href={fbLink}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Facebook
            </a>
          </div>

          <Button onClick={markSeen} className="w-full bg-[image:var(--gradient-hero)]">
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
