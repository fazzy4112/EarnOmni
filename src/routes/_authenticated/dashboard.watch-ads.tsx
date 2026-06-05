import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, PlayCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  ad_url: string;
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
  const [activeAd, setActiveAd] = useState<Ad | null>(null);
  const [remaining, setRemaining] = useState(0);

  const { data: ads = [] } = useQuery({
    queryKey: ["ads"],
    queryFn: async () => {
      const { data } = await supabase.from("ads").select("*").eq("is_active", true);
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
  const maxDaily = 10;

  useEffect(() => {
    if (!activeAd) return;
    setRemaining(activeAd.duration_seconds);
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [activeAd]);

  const claim = async () => {
    if (!activeAd || !user) return;
    const multiplier = profile?.plan === "gold" ? 4 : profile?.plan === "silver" ? 2 : 1;
    const pts = activeAd.reward_points * multiplier;
    const { error } = await supabase.from("ad_views").insert({
      user_id: user.id,
      ad_id: activeAd.id,
      points_earned: pts,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    // Update balance: 100 pts = $1
    const newPoints = (profile?.points ?? 0) + pts;
    const newBalance = Number(profile?.balance ?? 0) + pts / 100;
    await supabase.from("profiles").update({ points: newPoints, balance: newBalance }).eq("id", user.id);
    toast.success(`+${pts} points earned!`);
    setActiveAd(null);
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["today_views"] });
    qc.invalidateQueries({ queryKey: ["ad_views"] });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Today's Progress</h2>
            <p className="text-sm text-muted-foreground">{completed} of {maxDaily} ads watched</p>
          </div>
          <div className="text-3xl font-bold text-primary">{completed}/{maxDaily}</div>
        </div>
        <Progress value={(completed / maxDaily) * 100} className="mt-4" />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ads.map((ad) => {
          const done = watchedSet.has(ad.id);
          return (
            <Card key={ad.id} className="overflow-hidden border-border/50 bg-card/50">
              <div className="relative aspect-video bg-[image:var(--gradient-hero)]">
                {ad.thumbnail_url ? (
                  <img src={ad.thumbnail_url} alt={ad.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <PlayCircle className="h-16 w-16 text-primary-foreground/80" />
                  </div>
                )}
                {done && (
                  <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-1 text-xs font-medium text-white">
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{ad.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ad.description}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {ad.duration_seconds}s
                  </span>
                  <span className="font-semibold text-primary">+{ad.reward_points} pts</span>
                </div>
                <Button
                  className="mt-4 w-full bg-[image:var(--gradient-hero)]"
                  disabled={done || completed >= maxDaily}
                  onClick={() => setActiveAd(ad)}
                >
                  {done ? "Completed" : completed >= maxDaily ? "Limit reached" : "Watch Now"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {activeAd && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4">
          <div className="flex items-center justify-between text-white">
            <h3 className="text-lg font-semibold">{activeAd.title}</h3>
            {remaining === 0 && (
              <Button variant="ghost" size="icon" onClick={() => setActiveAd(null)}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
          <div className="relative mx-auto mt-4 w-full max-w-4xl flex-1">
            <iframe
              src={activeAd.ad_url}
              title={activeAd.title}
              className="h-full w-full rounded-lg"
              allow="autoplay; encrypted-media"
            />
            <div className="absolute right-4 top-4 rounded-full bg-black/70 px-4 py-2 text-white">
              {remaining > 0 ? (
                <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> {remaining}s</span>
              ) : (
                <span className="text-emerald-400">Ready!</span>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              size="lg"
              disabled={remaining > 0}
              onClick={claim}
              className="bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow)]"
            >
              {remaining > 0 ? `Wait ${remaining}s...` : `Claim +${activeAd.reward_points} points`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}