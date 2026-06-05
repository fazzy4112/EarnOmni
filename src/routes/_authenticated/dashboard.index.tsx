import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { DollarSign, PlayCircle, Clock, Users } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user, profile } = useAuth();

  const { data: views = [] } = useQuery({
    queryKey: ["ad_views", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data } = await supabase
        .from("ad_views")
        .select("*")
        .eq("user_id", user!.id)
        .gte("watched_at", since.toISOString())
        .order("watched_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: referralCommission = 0 } = useQuery({
    queryKey: ["referral_commission", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("commission_amount")
        .eq("referrer_id", user!.id);
      return (data ?? []).reduce((s, r: { commission_amount: number }) => s + Number(r.commission_amount), 0);
    },
  });

  const today = new Date().toDateString();
  const todayCount = views.filter((v) => new Date(v.watched_at).toDateString() === today).length;
  const remaining = Math.max(0, 10 - todayCount);

  // Last 7 days chart
  const chart = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    const points = views
      .filter((v) => new Date(v.watched_at).toDateString() === key)
      .reduce((s, v) => s + v.points_earned, 0);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), earnings: points / 100 };
  });

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Earnings" value={`$${(profile?.balance ?? 0).toFixed(2)}`} icon={DollarSign} color="from-emerald-500 to-emerald-700" />
        <StatCard label="Today's Ads" value={`${todayCount}/10`} icon={PlayCircle} color="from-blue-500 to-blue-700" />
        <StatCard label="Remaining Today" value={`${remaining}`} icon={Clock} color="from-orange-500 to-orange-700" />
        <StatCard label="Referral Commission" value={`$${Number(referralCommission).toFixed(2)}`} icon={Users} color="from-purple-500 to-purple-700" />
      </div>

      <Card className="border-border/50 bg-card/50 p-6">
        <h3 className="text-lg font-semibold">Weekly earnings</h3>
        <p className="text-sm text-muted-foreground">Last 7 days</p>
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.05 280)" />
              <XAxis dataKey="day" stroke="oklch(0.72 0.03 280)" />
              <YAxis stroke="oklch(0.72 0.03 280)" />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.18 0.05 280)",
                  border: "1px solid oklch(0.3 0.05 280)",
                  borderRadius: 8,
                }}
              />
              <Line type="monotone" dataKey="earnings" stroke="oklch(0.62 0.22 275)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="border-border/50 bg-card/50 p-6">
        <h3 className="text-lg font-semibold">Recent activity</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground">
                <th className="pb-2">Date</th>
                <th className="pb-2">Activity</th>
                <th className="pb-2">Points</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {views.slice(0, 8).map((v) => (
                <tr key={v.id} className="border-b border-border/30">
                  <td className="py-3">{new Date(v.watched_at).toLocaleDateString()}</td>
                  <td className="py-3">Watched ad</td>
                  <td className="py-3 text-primary">+{v.points_earned}</td>
                  <td className="py-3"><span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Credited</span></td>
                </tr>
              ))}
              {views.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No activity yet — start watching ads!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  color: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/50 bg-[image:var(--gradient-card)] p-6">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${color} opacity-20 blur-2xl`} />
      <Icon className="h-6 w-6 text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </Card>
  );
}