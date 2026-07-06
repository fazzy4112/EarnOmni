import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, PlayCircle, CheckCircle2, X, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  ad_type: string;
  ad_url: string;
  banner_image_url: string | null;
  click_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  reward_points: number;
}

export const Route = createFileRoute("/_authenticated/dashboard/watch-ads")({
  component: WatchAdsPage,
});

function WatchAdsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeAd, setActiveAd] = useState<Ad | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [videoStarted, setVideoStarted] = useState(false);
  const [isTabActive, setIsTabActive] = useState(true);
  const [tabWarning, setTabWarning] = useState(false);
  const [pauseReason, setPauseReason] = useState<"tab_switch" | "returned_early" | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adWindowRef = useRef<Window | null>(null);
  // Timestamp (ms) when our own tab became hidden — used to bank real
  // elapsed wall-clock time for "link" ads instead of trusting a ticking
  // interval (which browsers throttle in background tabs anyway).
  const hiddenSinceRef = useRef<number | null>(null);

  const { data: ads = [] } = useQuery({
    queryKey: ["ads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ads")
        .select("*")
        .eq("is_active", true);
      return (data ?? []) as Ad[];
    },
  });

  const { data: todayViews = [] } = useQuery({
    queryKey: ["today_views", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("ad_views")
        .select("ad_id")
        .eq("user_id", user!.id)
        .gte("watched_at", start.toISOString());
      return (data ?? []).map((v) => v.ad_id as string);
    },
  });

  const watchedSet = useMemo(() => new Set(todayViews), [todayViews]);
  const completed = todayViews.length;
  const maxDaily = profile?.plan === "gold" ? 40 : profile?.plan === "silver" ? 20 : 10;
  const multiplier = profile?.plan === "gold" ? 4 : profile?.plan === "silver" ? 2 : 1;
  const displayPoints = (base: number) => base * multiplier;
  const quotaReached = completed >= maxDaily;

  // Tab visibility detection.
  //
  // For "link" (Direct Link / Smartlink) ads, we can't reliably detect via
  // window.open()'s returned reference whether the user closed that tab —
  // many mobile browsers don't keep that reference's `.closed` flag in
  // sync for real tabs (as opposed to popups). So instead of trusting the
  // opened window at all, we bank real wall-clock time based on when OUR
  // OWN tab is hidden vs visible: progress only counts while our tab is
  // hidden (i.e. the user is presumably away looking at the ad). The
  // moment they come back to this tab, progress stops immediately —
  // regardless of whether the ad tab is still open, was closed instantly,
  // or never opened at all (e.g. popup blocked).
  useEffect(() => {
    const handleVisibility = () => {
      if (!activeAd || !videoStarted) return;

      if (activeAd.ad_type === "link") {
        if (document.hidden) {
          hiddenSinceRef.current = Date.now();
          setIsTabActive(true);
          setTabWarning(false);
          setPauseReason(null);
        } else {
          if (hiddenSinceRef.current) {
            const elapsedSec = Math.floor((Date.now() - hiddenSinceRef.current) / 1000);
            setRemaining((r) => {
              const newRemaining = r - elapsedSec;
              if (newRemaining <= 0) return 0; // genuinely watched the full duration
              // Came back early — restart from the full duration instead of
              // resuming, so repeatedly popping the tab open/closed can't
              // slowly chip away at it a second or two at a time.
              return activeAd.duration_seconds;
            });
            hiddenSinceRef.current = null;
          }
          setIsTabActive(false);
          setTabWarning(true);
          setPauseReason("returned_early");
        }
      } else {
        if (document.hidden) {
          setIsTabActive(false);
          setTabWarning(true);
          setPauseReason("tab_switch");
          toast.error("⚠️ Tab switch detected! Timer paused.", { duration: 3000 });
        } else {
          setIsTabActive(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeAd, videoStarted]);

  // Reset when new ad opens
  useEffect(() => {
    if (activeAd) {
      setVideoStarted(false);
      setIsTabActive(true);
      setTabWarning(false);
      setPauseReason(null);
      setRemaining(activeAd.duration_seconds);
      setVideoUrl(activeAd.ad_url);
      adWindowRef.current = null;
      hiddenSinceRef.current = null;
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [activeAd]);

  // Timer.
  // For "link" ads, progress is instead banked directly from real elapsed
  // hidden-time in the visibility handler above (background-tab timers get
  // throttled by browsers, so a ticking interval isn't trustworthy there).
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (activeAd?.ad_type === "link") return;
    if (!videoStarted || !isTabActive || remaining <= 0) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(intervalRef.current!); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [videoStarted, isTabActive, activeAd]);

  // Reflect the countdown in the browser tab title, so it stays visible
  // in the tab bar even after opening a Direct Link ad in a new tab.
  useEffect(() => {
    if (videoStarted && remaining > 0) {
      document.title = `⏳ ${remaining}s left — EarnOmni`;
    } else if (videoStarted && remaining === 0) {
      document.title = "✅ Ready to claim! — EarnOmni";
    } else {
      document.title = "EarnOmni";
    }
    return () => { document.title = "EarnOmni"; };
  }, [remaining, videoStarted]);

  const openAdWindow = () => {
    if (!activeAd) return;
    const win = window.open(activeAd.ad_url, "_blank", "noopener");
    adWindowRef.current = win;
    if (!win) {
      // Popup blocked — nothing opened, so our tab never goes hidden and
      // the timer correctly never progresses. Tell the user why.
      toast.error("Popup blocked! Please allow popups for this site, then tap the button again.", { duration: 5000 });
    }
  };

  const handlePlayVideo = () => {
    if (!activeAd) return;
    const adType = activeAd.ad_type ?? "youtube";
    if (adType === "youtube") {
      setVideoUrl(`${activeAd.ad_url}?autoplay=1`);
    } else if (adType === "link") {
      // Direct Link / Smartlink ads can't be iframed (most ad networks
      // block that). Open it in a real new tab and run our own timer —
      // switching to that tab is the expected flow here, not cheating.
      // (We deliberately don't use "noopener" here so we can detect if
      // the user closes that tab early — see the polling effect above.)
      openAdWindow();
    } else {
      setVideoUrl(activeAd.ad_url);
    }
    setVideoStarted(true);
    setIsTabActive(true);
    setTabWarning(false);
    setPauseReason(null);
  };

  const claim = async () => {
    if (!activeAd || !user || remaining > 0) return;
    const pts = activeAd.reward_points * multiplier;

    const { error } = await supabase.from("ad_views").insert({
      user_id: user.id,
      ad_id: activeAd.id,
      points_earned: pts,
    });
    if (error) { toast.error(error.message); return; }

    const newPoints = (profile?.points ?? 0) + pts;
    const newBalance = Number(profile?.balance ?? 0) + pts / 1000;
    await supabase.from("profiles")
      .update({ points: newPoints, balance: newBalance })
      .eq("id", user.id);

    // Note: referral commission is NOT paid on ad-watching earnings —
    // watching ads is a platform expense, not revenue. Commission is
    // only paid from a share of real revenue (plan subscriptions,
    // deposits), credited when those events happen instead.

    toast.success(`🎉 +${pts} points earned!`);
    setActiveAd(null);
    setVideoStarted(false);
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["today_views"] });
    qc.invalidateQueries({ queryKey: ["ad_views"] });
  };

  const getAdTypeLabel = (type: string) => {
    switch(type) {
      case "banner": return "🖼️ Banner Ad";
      case "video": return "📹 Video Ad";
      case "link": return "🔗 Link Ad";
      default: return "🎬 Video Ad";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Today's Progress</h2>
            <p className="text-sm text-muted-foreground">
              {completed} of {maxDaily} ads watched
              <span className="ml-1.5 rounded-full bg-muted/40 px-2 py-0.5 text-xs font-medium capitalize">
                {profile?.plan ?? "basic"} plan
              </span>
            </p>
          </div>
          <div className="text-3xl font-bold text-primary">{completed}/{maxDaily}</div>
        </div>
        <Progress value={(completed / maxDaily) * 100} className="mt-4" />
        {quotaReached && profile?.plan !== "gold" && (
          <button
            onClick={() => navigate({ to: "/dashboard/subscription" })}
            className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            🚀 Daily limit reached — Upgrade for {profile?.plan === "silver" ? "2x more ads (40/day) & 4x rewards" : "2-4x more ads & higher rewards"}
          </button>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ads.map((ad) => {
          const done = watchedSet.has(ad.id);
          const adType = ad.ad_type ?? "youtube";
          return (
            <Card key={ad.id} className="overflow-hidden border-border/50 bg-card/50">
              <div className="relative aspect-video bg-[image:var(--gradient-hero)] flex items-center justify-center">
                {ad.thumbnail_url ? (
                  <img src={ad.thumbnail_url} alt={ad.title} className="h-full w-full object-cover" />
                ) : adType === "banner" && ad.banner_image_url ? (
                  <img src={ad.banner_image_url} alt={ad.title} className="h-full w-full object-cover" />
                ) : (
                  <PlayCircle className="h-16 w-16 text-primary-foreground/80" />
                )}
                {done && (
                  <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-1 text-xs font-medium text-white">
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </div>
                )}
                <div className="absolute left-3 top-3 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">
                  {getAdTypeLabel(adType)}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{ad.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ad.description}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {ad.duration_seconds}s
                  </span>
                  <span className="font-semibold text-primary">+{displayPoints(ad.reward_points)} pts</span>
                </div>
                <Button
                  className="mt-4 w-full bg-[image:var(--gradient-hero)]"
                  disabled={done}
                  onClick={() => {
                    if (done) return;
                    if (quotaReached) {
                      toast.error(
                        profile?.plan === "gold"
                          ? "Daily limit reached! Come back tomorrow for more."
                          : "Daily limit reached! Upgrade your plan for more ads & higher rewards 🚀",
                        {
                          duration: 5000,
                          action: profile?.plan === "gold" ? undefined : {
                            label: "Upgrade",
                            onClick: () => navigate({ to: "/dashboard/subscription" }),
                          },
                        }
                      );
                      return;
                    }
                    setActiveAd(ad);
                  }}
                >
                  {done ? "Completed" : quotaReached ? "🔒 Upgrade to Unlock" : "Watch Now"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Ad Overlay */}
      {activeAd && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4">
          <div className="flex items-center justify-between text-white mb-4">
            <h3 className="text-lg font-semibold">{activeAd.title}</h3>
            {remaining === 0 && (
              <Button variant="ghost" size="icon" onClick={() => setActiveAd(null)}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>

          {tabWarning && videoStarted && (
            <div className="mb-3 flex items-center gap-2 bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-2 text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                {pauseReason === "returned_early"
                  ? "You came back early — timer restarted from the beginning. Stay on the ad tab this time!"
                  : "Tab switch detected! Timer was paused."}
              </span>
              <button onClick={() => setTabWarning(false)} className="ml-auto">✕</button>
            </div>
          )}

          <div className="relative mx-auto w-full max-w-4xl flex-1">
            {!videoStarted ? (
              <div className="h-full w-full rounded-lg bg-gray-900 flex flex-col items-center justify-center gap-6">
                <div className="text-center text-white space-y-2">
                  <p className="text-gray-400 text-sm">Press play to start watching</p>
                  <h4 className="text-xl font-bold">{activeAd.title}</h4>
                  <p className="text-gray-400 text-sm">{activeAd.description}</p>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 bg-white/10 text-white px-3 py-1 rounded-full">
                      <Clock className="h-4 w-4" /> {activeAd.duration_seconds}s
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full">
                      +{displayPoints(activeAd.reward_points)} pts
                    </span>
                  </div>
                  <Button size="lg" onClick={handlePlayVideo}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 text-lg rounded-full">
                    <PlayCircle className="h-6 w-6 mr-2" />
                    {activeAd.ad_type === "banner" ? "View Banner & Start Timer" : activeAd.ad_type === "link" ? "Open Ad & Start Timer" : "Play Video & Start Timer"}
                  </Button>
                  <div className="text-center text-gray-500 text-xs space-y-1">
                    <p>⚠️ Do not switch tabs — timer will pause</p>
                    <p>⚠️ Must watch full duration to claim reward</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative h-full w-full">

                {/* YouTube iframe */}
                {(activeAd.ad_type === "youtube" || !activeAd.ad_type) && (
                  <iframe
                    src={videoUrl}
                    title={activeAd.title}
                    className="h-full w-full rounded-lg"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                )}

                {/* Direct Link / Smartlink — opened in a real new tab */}
                {activeAd.ad_type === "link" && (
                  <div className="h-full w-full rounded-lg bg-gray-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <ExternalLink className="h-10 w-10 text-primary" />
                    <div>
                      <p className="text-lg font-semibold text-white">Ad opened in a new tab</p>
                      <p className="mt-1 text-sm text-gray-400">
                        Stay on that ad tab until the timer finishes — coming back here early pauses your progress.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={openAdWindow}
                    >
                      Didn't open? Click to open again
                    </Button>
                  </div>
                )}

                {/* Direct MP4 Video */}
                {activeAd.ad_type === "video" && (
                  <video
                    src={activeAd.ad_url}
                    className="h-full w-full rounded-lg object-contain bg-black"
                    autoPlay
                    controls={false}
                  />
                )}

                {/* Banner Image Ad */}
                {activeAd.ad_type === "banner" && (
                  <div className="h-full w-full rounded-lg bg-gray-900 flex flex-col items-center justify-center gap-4 p-6">
                    <p className="text-xs text-gray-400">Advertisement</p>
                    <a href={activeAd.click_url ?? "#"} target="_blank" rel="noopener noreferrer"
                      className="block max-w-2xl w-full">
                      <img src={activeAd.banner_image_url ?? ""} alt={activeAd.title}
                        className="w-full rounded-lg border border-white/10 hover:opacity-90 transition-opacity" />
                    </a>
                    <p className="text-xs text-gray-400">Click banner to visit advertiser — timer completes automatically</p>
                  </div>
                )}

                {/* Timer */}
                <div className={`absolute right-4 top-4 rounded-full px-4 py-2 text-white font-semibold ${!isTabActive ? "bg-red-600/90" : "bg-black/70"}`}>
                  {remaining > 0 ? (
                    <span className="flex items-center gap-2">
                      <Clock className={`h-4 w-4 ${isTabActive ? "text-emerald-400" : "text-red-400"}`} />
                      {remaining}s
                    </span>
                  ) : (
                    <span className="text-emerald-400">✓ Ready!</span>
                  )}
                </div>

                {/* Tab inactive overlay */}
                {!isTabActive && remaining > 0 && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg gap-3">
                    <AlertTriangle className="h-12 w-12 text-yellow-400 mb-1" />
                    <p className="text-white text-xl font-bold">Timer Restarted!</p>
                    <p className="text-gray-300 text-sm mt-1">
                      {pauseReason === "returned_early"
                        ? "You came back too early, so it reset to the full duration. Go back and stay this time."
                        : "You switched tabs. Come back to continue."}
                    </p>
                    <p className="text-yellow-400 text-sm font-semibold">{remaining}s remaining</p>
                    {pauseReason === "returned_early" && (
                      <Button size="sm" variant="outline" onClick={openAdWindow}>
                        Reopen ad
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-center">
            {!videoStarted ? (
              <Button variant="ghost" onClick={() => setActiveAd(null)} className="text-gray-400">Cancel</Button>
            ) : (
              <Button size="lg" disabled={remaining > 0} onClick={claim}
                className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg disabled:opacity-50">
                {remaining > 0 ? `⏳ Wait ${remaining}s...` : "🎉 Claim Points!"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}