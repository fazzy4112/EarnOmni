import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Users, Wallet, PlayCircle, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Panel — AdEarn" }] }),
  component: AdminPanel,
});

type Tab = "users" | "withdrawals" | "ads";

function AdminPanel() {
  const { profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    setBusy(true);
    const [u, w, a] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }),
      supabase.from("ads").select("*").order("created_at", { ascending: false }),
    ]);
    setUsers(u.data ?? []);
    setWithdrawals(w.data ?? []);
    setAds(a.data ?? []);
    setBusy(false);
  };

  useEffect(() => {
    if (profile?.is_admin) loadAll();
  }, [profile?.is_admin]);

  if (loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!profile?.is_admin) {
    return (
      <Card className="mx-auto max-w-lg border-border/50 bg-card/80 p-8 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-xl font-bold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need administrator privileges to view this page. Ask a database
          admin to set <code className="rounded bg-muted px-1">is_admin = true</code> on your profile.
        </p>
      </Card>
    );
  }

  const updateWithdrawal = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("withdrawals").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Withdrawal ${status}`);
    loadAll();
  };

  const toggleAd = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("ads").update({ is_active: !is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    loadAll();
  };

  const totalBalance = users.reduce((s, u) => s + Number(u.balance ?? 0), 0);
  const pendingWd = withdrawals.filter((w) => w.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">Manage users, withdrawals and ads.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Users} label="Total users" value={users.length} />
        <Stat icon={DollarSign} label="Total balance" value={`$${totalBalance.toFixed(2)}`} />
        <Stat icon={Wallet} label="Pending withdrawals" value={pendingWd} />
        <Stat icon={PlayCircle} label="Active ads" value={ads.filter((a) => a.is_active).length} />
      </div>

      <div className="flex gap-2 border-b border-border/50">
        {(["users", "withdrawals", "ads"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize ${
              tab === t ? "border-b-2 border-primary font-semibold" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {busy && <Loader2 className="h-5 w-5 animate-spin" />}

      {tab === "users" && (
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Points</th>
                <th className="p-3">Admin</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border/40">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3 capitalize">{u.plan}</td>
                  <td className="p-3">${Number(u.balance).toFixed(2)}</td>
                  <td className="p-3">{u.points}</td>
                  <td className="p-3">{u.is_admin ? <Badge>admin</Badge> : "—"}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No users</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "withdrawals" && (
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Amount</th>
                <th className="p-3">Method</th>
                <th className="p-3">Wallet</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-t border-border/40">
                  <td className="p-3">${Number(w.amount).toFixed(2)}</td>
                  <td className="p-3">{w.payment_method}</td>
                  <td className="p-3 font-mono text-xs">{w.wallet_address?.slice(0, 14)}…</td>
                  <td className="p-3"><Badge variant={w.status === "pending" ? "secondary" : "default"}>{w.status}</Badge></td>
                  <td className="p-3">
                    {w.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateWithdrawal(w.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => updateWithdrawal(w.id, "rejected")}>Reject</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {withdrawals.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No withdrawals</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "ads" && (
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Title</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Reward</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((a) => (
                <tr key={a.id} className="border-t border-border/40">
                  <td className="p-3">{a.title}</td>
                  <td className="p-3">{a.duration_seconds}s</td>
                  <td className="p-3">+{a.reward_points}</td>
                  <td className="p-3"><Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "active" : "paused"}</Badge></td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => toggleAd(a.id, a.is_active)}>
                      {a.is_active ? "Pause" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <Card className="border-border/50 bg-card/80 p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[image:var(--gradient-hero)]">
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}