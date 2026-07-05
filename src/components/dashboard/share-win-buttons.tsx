import { Button } from "@/components/ui/button";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareWinButtonsProps {
  prizeAmount: number;
  referralCode?: string | null;
}

export function ShareWinButtons({ prizeAmount, referralCode }: ShareWinButtonsProps) {
  const shareUrl = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode}`
    : window.location.origin;
  const shareText = `I just won $${prizeAmount} on EarnOmni's $1 Game! 🎉 Join and play:`;
  const fullShareText = `${shareText} ${shareUrl}`;

  const copyShare = () => {
    navigator.clipboard.writeText(fullShareText);
    toast.success("Copied — paste it anywhere!");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "EarnOmni", text: shareText, url: shareUrl });
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
  );
}
