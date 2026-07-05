import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2, ShieldAlert, Users, Wallet, PlayCircle,
  DollarSign, Plus, Trash2, Edit2, Check, X,
  BarChart3, Settings, Info, Save, Crown, Star,
  CheckCircle2, ClipboardList, Briefcase, ExternalLink,
  Ticket, Trophy,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPanel,
});

type Tab = "overview" | "users" | "withdrawals" | "ads" | "plans" | "subscriptions" | "task_reviews" | "tasks_management" | "game" | "settings";

interface AdForm {
  title: string;
  description: string;
  ad_type: string;
  ad_url: string;
  banner_image_url: string;
  click_url: string;
  duration_seconds: number;
  platform_value: number;
  user_share_percent: number;
}

interface PlanForm {
  name: string;
  label: string;
  price_usd: number;
  multiplier: number;
  duration_days: number;
  features: string;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
}

const emptyAdForm: AdForm = {
  title: "", description: "", ad_type: "youtube",
  ad_url: "", banner_image_url: "", click_url: "",
  duration_seconds: 30, platform_value: 100, user_share_percent: 40,
};

const emptyPlanForm: PlanForm = {
  name: "", label: "", price_usd: 0, multiplier: 1,
  duration_days: 30, features: "", is_active: true,
  is_popular: false, sort_order: 0,
};

function AdminPanel() {
  const { profile, loading } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [taskCompletions, setTaskCompletions] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [gameRounds, setGameRounds] = useState<any[]>([]);
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState(10);
  const [crediting, setCrediting] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Ad form
  const [showAdForm, setShowAdForm] = useState(false);
  const [editingAd, setEditingAd] = useState<any | null>(null);
  const [adForm, setAdForm] = useState<AdForm>(emptyAdForm);
  const [savingAd, setSavingAd] = useState(false);

  // Plan form
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [savingPlan, setSavingPlan] = useState(false);

  // Settings
  const [settingsForm, setSettingsForm] = useState({
    usdt_bep20_address: "",
    min_withdrawal: 10,
    min_deposit: 5,
    points_per_dollar: 1000,
    referral_commission_basic: 5,
    referral_commission_silver: 10,
    referral_commission_gold: 20,
  });

  const loadAll = async () => {
    setBusy(true);
    const [u, w, a, p, s, st, tc, t, gr] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("ads").select("*").order("created_at", { ascending: false }),
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("subscriptions").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("platform_settings").select("*").eq("id", 1).single(),
      supabase.from("task_completions").select("*").order("completed_at", { ascending: false }),
      supabase.from("tasks").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),  // ✅ YE ADD KAR
      supabase.from("game_rounds").select("*").order("created_at", { ascending: false }),
    ]);
    setUsers(u.data ?? []);
    setWithdrawals(w.data ?? []);
    setAds(a.data ?? []);
    setTasks(t.data ?? []);
    setPlans(p.data ?? []);
    setSubscriptions(s.data ?? []);
    setGameRounds(gr.data ?? []);
    const tcRaw = tc.data ?? [];
const tcEnriched = await Promise.all(
  tcRaw.map(async (item: any) => {
    const [taskRes, profileRes] = await Promise.all([
      supabase.from("tasks").select("title, reward_points").eq("id", item.task_id).single(),
      supabase.from("profiles").select("full_name, email").eq("id", item.user_id).single(),
    ]);
    return { ...item, tasks: taskRes.data, profiles: profileRes.data };
  })
);
setTaskCompletions(tcEnriched);
    if (st.data) {
      setSettings(st.data);
      setSettingsForm({
        usdt_bep20_address: st.data.usdt_bep20_address ?? "",
        min_withdrawal: st.data.min_withdrawal ?? 10,
        min_deposit: st.data.min_deposit ?? 5,
        points_per_dollar: st.data.points_per_dollar ?? 1000,
        referral_commission_basic: st.data.referral_commission_basic ?? 5,
        referral_commission_silver: st.data.referral_commission_silver ?? 10,
        referral_commission_gold: st.data.referral_commission_gold ?? 20,
      });
    }
    setBusy(false);
  };

  useEffect(() => {
    if (profile?.is_admin) loadAll();
  }, [profile?.is_admin]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!profile?.is_admin) return (
    <Card className="mx-auto max-w-lg border-border/50 bg-card/80 p-8 text-center">
      <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
      <h1 className="mt-4 text-xl font-bold">Access Denied</h1>
    </Card>
  );

  const totalBalance = users.reduce((s, u) => s + Number(u.balance ?? 0), 0);
  const pendingWd = withdrawals.filter((w) => w.status === "pending").length;
  const referralCounts = users.reduce((acc: Record<string, number>, u) => {
    if (u.referred_by) acc[u.referred_by] = (acc[u.referred_by] ?? 0) + 1;
    return acc;
  }, {});
  const pendingSubs = subscriptions.filter((s) => !s.is_active).length;
  const pendingTasks = taskCompletions.filter((tc) => tc.status === "pending").length;
  const activeAds = ads.filter((a) => a.is_active).length;
  const totalWithdrawn = withdrawals.filter((w) => w.status === "approved").reduce((s, w) => s + Number(w.amount ?? 0), 0);

  // Withdrawal actions
  const updateWithdrawal = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("withdrawals").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Withdrawal ${status}!`);
    loadAll();
  };

  // Ad actions
  const calcReward = (pv: number, sp: number) => Math.round((pv * sp) / 100);
  const toggleAd = async (id: string, is_active: boolean) => {
    await supabase.from("ads").update({ is_active: !is_active }).eq("id", id);
    loadAll();
  };
  const deleteAd = async (id: string) => {
    if (!confirm("Delete this ad?")) return;
    await supabase.from("ads").delete().eq("id", id);
    toast.success("Ad deleted!"); loadAll();
  };
  const openEditAd = (ad: any) => {
    setEditingAd(ad);
    setAdForm({
      title: ad.title, description: ad.description ?? "",
      ad_type: ad.ad_type ?? "youtube", ad_url: ad.ad_url ?? "",
      banner_image_url: ad.banner_image_url ?? "", click_url: ad.click_url ?? "",
      duration_seconds: ad.duration_seconds, platform_value: ad.platform_value ?? 100,
      user_share_percent: ad.user_share_percent ?? 40,
    });
    setShowAdForm(true);
  };
  const saveAd = async () => {
    if (!adForm.title || !adForm.ad_url) { toast.error("Title and URL required!"); return; }
    const reward_points = calcReward(adForm.platform_value, adForm.user_share_percent);
    setSavingAd(true);
    const payload = {
      title: adForm.title, description: adForm.description, ad_type: adForm.ad_type,
      ad_url: adForm.ad_url, banner_image_url: adForm.banner_image_url, click_url: adForm.click_url,
      duration_seconds: adForm.duration_seconds, platform_value: adForm.platform_value,
      user_share_percent: adForm.user_share_percent, reward_points, is_active: true,
    };
    if (editingAd) {
      const { error } = await supabase.from("ads").update(payload).eq("id", editingAd.id);
      if (error) { toast.error(error.message); setSavingAd(false); return; }
      toast.success("Ad updated!");
    } else {
      const { error } = await supabase.from("ads").insert(payload);
      if (error) { toast.error(error.message); setSavingAd(false); return; }
      toast.success("Ad added!");
    }
    setSavingAd(false); setShowAdForm(false); loadAll();
  };

  // Plan actions
  const openNewPlan = () => { setEditingPlan(null); setPlanForm(emptyPlanForm); setShowPlanForm(true); };
  const openEditPlan = (plan: any) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name, label: plan.label, price_usd: plan.price_usd,
      multiplier: plan.multiplier, duration_days: plan.duration_days,
      features: (plan.features ?? []).join("\n"),
      is_active: plan.is_active, is_popular: plan.is_popular, sort_order: plan.sort_order,
    });
    setShowPlanForm(true);
  };
  const savePlan = async () => {
    if (!planForm.name || !planForm.label) { toast.error("Name and label required!"); return; }
    setSavingPlan(true);
    const featuresArr = planForm.features.split("\n").map(f => f.trim()).filter(Boolean);
    const finalPayload = {
      name: planForm.name, label: planForm.label, price_usd: planForm.price_usd,
      multiplier: planForm.multiplier, duration_days: planForm.duration_days,
      features: featuresArr, is_active: planForm.is_active,
      is_popular: planForm.is_popular, sort_order: planForm.sort_order,
    };
    if (editingPlan) {
      const { error } = await supabase.from("plans").update(finalPayload).eq("id", editingPlan.id);
      if (error) { toast.error(error.message); setSavingPlan(false); return; }
      toast.success("Plan updated!");
    } else {
      const { error } = await supabase.from("plans").insert(finalPayload);
      if (error) { toast.error(error.message); setSavingPlan(false); return; }
      toast.success("Plan created!");
    }
    setSavingPlan(false); setShowPlanForm(false); loadAll();
  };
  const deletePlan = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    await supabase.from("plans").delete().eq("id", id);
    toast.success("Plan deleted!"); loadAll();
  };
  const togglePlan = async (id: string, is_active: boolean) => {
    await supabase.from("plans").update({ is_active: !is_active }).eq("id", id);
    loadAll();
  };

  // User actions
  const toggleUserBlock = async (id: string, is_active: boolean) => {
    await supabase.from("profiles").update({ is_active: !is_active }).eq("id", id);
    toast.success(is_active ? "User blocked!" : "User unblocked!"); loadAll();
  };

  // Subscription actions
  const activateSubscription = async (sub: any) => {
    await supabase.from("subscriptions").update({ is_active: true }).eq("id", sub.id);
    await supabase.from("profiles").update({ plan: sub.plan_name }).eq("id", sub.user_id);

    // Referral commission — paid here because this is real revenue
    // (a plan purchase), unlike everyday ad/task earnings which are a
    // platform cost, not income to share.
    const { data: referredProfile } = await supabase
      .from("profiles")
      .select("referred_by")
      .eq("id", sub.user_id)
      .single();

    if (referredProfile?.referred_by) {
      const { data: referrer } = await supabase
        .from("profiles")
        .select("id, plan, balance")
        .eq("referral_code", referredProfile.referred_by)
        .single();

      if (referrer) {
        const { data: platformSettings } = await supabase
          .from("platform_settings")
          .select("referral_commission_basic, referral_commission_silver, referral_commission_gold")
          .eq("id", 1)
          .single();
        const commissionPercent =
          referrer.plan === "gold" ? (platformSettings?.referral_commission_gold ?? 20)
          : referrer.plan === "silver" ? (platformSettings?.referral_commission_silver ?? 10)
          : (platformSettings?.referral_commission_basic ?? 5);
        const commissionAmount = Number(((sub.price_usd ?? 0) * commissionPercent) / 100);

        if (commissionAmount > 0) {
          await supabase.from("profiles").update({
            balance: Number(referrer.balance ?? 0) + commissionAmount,
          }).eq("id", referrer.id);
          await supabase.from("referrals").insert({
            referrer_id: referrer.id,
            referred_id: sub.user_id,
            commission_amount: commissionAmount,
            commission_percent: commissionPercent,
            source: "plan_subscription",
          });
        }
      }
    }

    toast.success(`${sub.plan_name} plan activated!`); loadAll();
  };
  const rejectSubscription = async (sub: any) => {
    await supabase.from("subscriptions").delete().eq("id", sub.id);
    toast.success("Rejected!"); loadAll();
  };

  // Manual plan change — for support/bug-fix cases, independent of the
  // normal deposit-and-request flow. Deactivates any current active
  // subscription and creates a fresh active one for the chosen plan.
  const manualPlanChange = async (userId: string, planName: string) => {
    if (!planName) return;
    const plan = plans.find((p) => p.name === planName);
    if (!plan) { toast.error("Plan not found"); return; }

    const { error: deactivateError } = await supabase
      .from("subscriptions")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);
    if (deactivateError) { toast.error(`Deactivate step failed: ${deactivateError.message}`); return; }

    const endDate = plan.duration_days
      ? new Date(Date.now() + plan.duration_days * 86400000).toISOString()
      : null;
    const { error: insertError } = await supabase.from("subscriptions").insert({
      user_id: userId,
      plan_name: plan.name,
      multiplier: plan.multiplier,
      price_usd: plan.price_usd,
      is_active: true,
      end_date: endDate,
    });
    if (insertError) { toast.error(`Insert step failed: ${insertError.message}`); return; }

    const { error: profileError, data: profileData } = await supabase
      .from("profiles")
      .update({ plan: plan.name })
      .eq("id", userId)
      .select();
    if (profileError) { toast.error(`Profile update failed: ${profileError.message}`); return; }
    if (!profileData || profileData.length === 0) {
      toast.error("Profile update affected 0 rows — check RLS policy on profiles UPDATE.");
      return;
    }

    toast.success(`Plan manually changed to ${plan.label || plan.name}`);
    loadAll();
  };

  // Task completion actions
  const approveTaskCompletion = async (tc: any) => {
    // Status update karo
    await supabase.from("task_completions")
      .update({ status: "approved" })
      .eq("id", tc.id);

    // Task ki reward_points seedha database se lo
    const { data: taskData } = await supabase
      .from("tasks")
      .select("reward_points, current_completions")
      .eq("id", tc.task_id)
      .single();

    // User profile lo
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("points, balance, plan")
      .eq("id", tc.user_id)
      .single();

    if (userProfile && taskData) {
      const multiplier = userProfile.plan === "gold" ? 4
        : userProfile.plan === "silver" ? 2 : 1;
      const pts = taskData.reward_points * multiplier;
      const newPoints = (userProfile.points ?? 0) + pts;
      const newBalance = Number(userProfile.balance ?? 0) + pts / 1000;

      await supabase.from("profiles").update({
        points: newPoints,
        balance: newBalance,
      }).eq("id", tc.user_id);

      await supabase.from("task_completions").update({ points_awarded: pts }).eq("id", tc.id);

      // Task completion count update
      await supabase.from("tasks").update({
        current_completions: (taskData.current_completions ?? 0) + 1,
      }).eq("id", tc.task_id);

      toast.success(`✅ Approved! +${pts} points awarded to user!`);
    } else {
      toast.success("✅ Task approved!");
    }
    loadAll();
  };

  const rejectTaskCompletion = async (id: string) => {
    await supabase.from("task_completions").update({ status: "rejected" }).eq("id", id);
    toast.success("Task rejected!"); loadAll();
  };

  // Save settings
  const saveSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase.from("platform_settings").update({
      usdt_bep20_address: settingsForm.usdt_bep20_address,
      min_withdrawal: settingsForm.min_withdrawal,
      min_deposit: settingsForm.min_deposit,
      points_per_dollar: settingsForm.points_per_dollar,
      referral_commission_basic: settingsForm.referral_commission_basic,
      referral_commission_silver: settingsForm.referral_commission_silver,
      referral_commission_gold: settingsForm.referral_commission_gold,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setSavingSettings(false);
    if (error) { toast.error(error.message); return; }
    toast.success("✅ Settings saved!"); loadAll();
  };

  const handleCreditDeposit = async () => {
    if (!creditUserId || creditAmount <= 0) { toast.error("Pick a user and a valid amount"); return; }
    setCrediting(true);
    const { error } = await supabase.rpc("admin_credit_deposit_balance", {
      p_user_id: creditUserId,
      p_amount: creditAmount,
    });
    setCrediting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Credited $${creditAmount} test deposit balance`);
    loadAll();
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "users", label: "Users", icon: Users },
    { key: "withdrawals", label: "Withdrawals", icon: Wallet },
    { key: "ads", label: "Ads", icon: PlayCircle },
    { key: "plans", label: "Plans", icon: Crown },
    { key: "subscriptions", label: "Plan Requests", icon: Star },
    { key: "task_reviews", label: "Task Reviews", icon: ClipboardList },
    { key: "tasks_management", label: "Manage Tasks", icon: Briefcase }, // ✅ YE ADD KAR
    { key: "game", label: "$1 Game", icon: Ticket },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  const baseReward = calcReward(adForm.platform_value, adForm.user_share_percent);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Full platform control</p>
        </div>
        <Badge className="bg-purple-500">Admin</Badge>
      </div>

      <div className="flex gap-1 border-b border-border/50 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors ${tab === key ? "border-b-2 border-primary font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" />
            {label}
            {key === "withdrawals" && pendingWd > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingWd}</span>}
            {key === "subscriptions" && pendingSubs > 0 && <span className="bg-yellow-500 text-black text-xs rounded-full px-1.5 py-0.5">{pendingSubs}</span>}
            {key === "task_reviews" && pendingTasks > 0 && <span className="bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingTasks}</span>}
          </button>
        ))}
      </div>

      {busy && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Users} label="Total Users" value={users.length} color="blue" />
            <Stat icon={DollarSign} label="Total Balance" value={`$${totalBalance.toFixed(2)}`} color="green" />
            <Stat icon={Wallet} label="Pending Withdrawals" value={pendingWd} color="orange" />
            <Stat icon={PlayCircle} label="Active Ads" value={activeAds} color="purple" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/50 bg-card/80 p-4">
              <h3 className="font-semibold mb-3">Recent Users</h3>
              <div className="space-y-2">
                {users.slice(0, 5).map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{u.email}</span>
                    <Badge variant="outline">{u.plan}</Badge>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="border-border/50 bg-card/80 p-4">
              <h3 className="font-semibold mb-3">Pending Withdrawals</h3>
              <div className="space-y-2">
                {withdrawals.filter(w => w.status === "pending").slice(0, 5).map((w) => (
                  <div key={w.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">${Number(w.amount).toFixed(2)}</span>
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-xs bg-emerald-500" onClick={() => updateWithdrawal(w.id, "approved")}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={() => updateWithdrawal(w.id, "rejected")}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
                {withdrawals.filter(w => w.status === "pending").length === 0 && <p className="text-sm text-muted-foreground">No pending withdrawals</p>}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* USERS */}
      {tab === "users" && (
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <div className="p-4 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-semibold">All Users ({users.length})</h3>
            <Input
              placeholder="Search by name, email, or UID…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">UID</th><th className="p-3">Name / Email</th><th className="p-3">Plan</th><th className="p-3">Referrals</th><th className="p-3">Balance</th><th className="p-3">Points</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
              </thead>
              <tbody>
                {users
                  .filter((u) => {
                    const q = userSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (u.full_name || "").toLowerCase().includes(q) ||
                      (u.email || "").toLowerCase().includes(q) ||
                      String(u.user_number || "").includes(q) ||
                      `uid-${u.user_number}`.toLowerCase().includes(q)
                    );
                  })
                  .map((u) => (
                  <tr key={u.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs text-muted-foreground">UID-{u.user_number}</td>
                    <td className="p-3"><div className="font-medium">{u.full_name || "—"}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                    <td className="p-3">
                      <select
                        value={u.plan}
                        onChange={(e) => manualPlanChange(u.id, e.target.value)}
                        className="rounded-md border border-border bg-input px-2 py-1 text-xs capitalize"
                        title="Manually change this user's plan"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.name}>{p.label || p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Users className="h-3 w-3" /> {referralCounts[u.referral_code] ?? 0}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-emerald-400">${Number(u.balance).toFixed(2)}</td>
                    <td className="p-3">{u.points}</td>
                    <td className="p-3"><Badge variant={u.is_active ? "default" : "destructive"}>{u.is_active ? "Active" : "Blocked"}</Badge></td>
                    <td className="p-3">
                      {!u.is_admin && <Button size="sm" variant={u.is_active ? "destructive" : "outline"} onClick={() => toggleUserBlock(u.id, u.is_active)}>{u.is_active ? "Block" : "Unblock"}</Button>}
                      {u.is_admin && <Badge className="bg-purple-500">Admin</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* WITHDRAWALS */}
      {tab === "withdrawals" && (
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <div className="p-4 border-b border-border/40 flex items-center justify-between">
            <h3 className="font-semibold">Withdrawal Requests</h3>
            <span className="text-sm text-muted-foreground">Total approved: ${totalWithdrawn.toFixed(2)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">User</th><th className="p-3">Amount</th><th className="p-3">Wallet</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="p-3 text-xs text-muted-foreground">{w.profiles?.email || "—"}</td>
                    <td className="p-3 font-bold text-emerald-400">${Number(w.amount).toFixed(2)}</td>
                    <td className="p-3 font-mono text-xs">{w.wallet_address?.slice(0, 16)}…</td>
                    <td className="p-3 text-xs">{new Date(w.created_at).toLocaleDateString()}</td>
                    <td className="p-3"><Badge variant={w.status === "approved" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}>{w.status}</Badge></td>
                    <td className="p-3">
                      {w.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-emerald-500" onClick={() => updateWithdrawal(w.id, "approved")}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateWithdrawal(w.id, "rejected")}><X className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No withdrawals yet</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ADS */}
      {tab === "ads" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingAd(null); setAdForm(emptyAdForm); setShowAdForm(true); }} className="bg-emerald-500 hover:bg-emerald-600">
              <Plus className="h-4 w-4 mr-2" /> Add New Ad
            </Button>
          </div>
          {showAdForm && (
            <Card className="border-border/50 bg-card/80 p-6">
              <h3 className="font-semibold mb-4">{editingAd ? "Edit Ad" : "Add New Ad"}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Ad Title *</Label><Input placeholder="e.g. Tech Product Review" value={adForm.title} onChange={(e) => setAdForm({ ...adForm, title: e.target.value })} /></div>
                <div>
                  <Label>Ad Type *</Label>
                  <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={adForm.ad_type} onChange={(e) => setAdForm({ ...adForm, ad_type: e.target.value })}>
                    <option value="youtube">🎬 YouTube Video</option>
                    <option value="video">📹 Direct Video (MP4 URL)</option>
                    <option value="banner">🖼️ Banner Image Ad</option>
                    <option value="link">🔗 Direct Link / Smartlink (opens in new tab)</option>
                  </select>
                </div>
                {adForm.ad_type === "youtube" && (
                  <div className="md:col-span-2">
                    <Label>YouTube Embed URL *</Label>
                    <Input placeholder="https://www.youtube.com/embed/VIDEO_ID" value={adForm.ad_url} onChange={(e) => setAdForm({ ...adForm, ad_url: e.target.value })} />
                  </div>
                )}
                {adForm.ad_type === "video" && (
                  <div className="md:col-span-2">
                    <Label>Direct Video URL (MP4) *</Label>
                    <Input placeholder="https://example.com/ad-video.mp4" value={adForm.ad_url} onChange={(e) => setAdForm({ ...adForm, ad_url: e.target.value })} />
                  </div>
                )}
                {adForm.ad_type === "banner" && (
                  <>
                    <div>
                      <Label>Banner Image URL *</Label>
                      <Input placeholder="https://example.com/banner.jpg" value={adForm.banner_image_url} onChange={(e) => setAdForm({ ...adForm, banner_image_url: e.target.value })} />
                    </div>
                    <div>
                      <Label>Click URL *</Label>
                      <Input placeholder="https://advertiser-website.com" value={adForm.click_url} onChange={(e) => setAdForm({ ...adForm, click_url: e.target.value })} />
                    </div>
                  </>
                )}
                {adForm.ad_type === "link" && (
                  <div className="md:col-span-2">
                    <Label>Ad URL (Direct Link / Smartlink) *</Label>
                    <Input placeholder="https://your-smartlink.effectivecpmnetwork.com/..." value={adForm.ad_url} onChange={(e) => setAdForm({ ...adForm, ad_url: e.target.value })} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      💡 It's fine to paste the same Direct Link/Smartlink URL into several ad entries — networks like Adsterra are designed for that. Add a few with different titles to fill out the daily quota.
                    </p>
                  </div>
                )}
                <div><Label>Description</Label><Input placeholder="Brief description" value={adForm.description} onChange={(e) => setAdForm({ ...adForm, description: e.target.value })} /></div>
                <div><Label>Duration (seconds)</Label><Input type="number" value={adForm.duration_seconds} onChange={(e) => setAdForm({ ...adForm, duration_seconds: Number(e.target.value) })} /></div>
                <div><Label>Total Ad Value (points)</Label><Input type="number" value={adForm.platform_value} onChange={(e) => setAdForm({ ...adForm, platform_value: Number(e.target.value) })} /></div>
                <div><Label>User Share % (40-50%)</Label><Input type="number" min="1" max="100" value={adForm.user_share_percent} onChange={(e) => setAdForm({ ...adForm, user_share_percent: Number(e.target.value) })} /></div>
              </div>
              <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3"><Info className="h-4 w-4 text-blue-400" /><span className="text-sm font-semibold">Reward Preview</span></div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-background rounded-lg p-3"><div className="text-xs text-muted-foreground mb-1">Basic 1x</div><div className="text-lg font-bold text-blue-400">{baseReward} pts</div></div>
                  <div className="bg-background rounded-lg p-3"><div className="text-xs text-muted-foreground mb-1">Silver 2x</div><div className="text-lg font-bold text-gray-300">{baseReward * 2} pts</div></div>
                  <div className="bg-background rounded-lg p-3"><div className="text-xs text-muted-foreground mb-1">Gold 4x</div><div className="text-lg font-bold text-yellow-400">{baseReward * 4} pts</div></div>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3"><div className="text-xs text-emerald-400 mb-1">Profit</div><div className="text-lg font-bold text-emerald-400">{adForm.platform_value - baseReward} pts</div></div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <Button onClick={saveAd} disabled={savingAd} className="bg-emerald-500 hover:bg-emerald-600">
                  {savingAd ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  {editingAd ? "Save Changes" : "Add Ad"}
                </Button>
                <Button variant="outline" onClick={() => setShowAdForm(false)}>Cancel</Button>
              </div>
            </Card>
          )}
          <Card className="overflow-hidden border-border/50 bg-card/80">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="p-3">Title</th><th className="p-3">Type</th><th className="p-3">Duration</th><th className="p-3">Basic</th><th className="p-3">Silver 2x</th><th className="p-3">Gold 4x</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
                </thead>
                <tbody>
                  {ads.map((a) => {
                    const base = a.reward_points ?? 0;
                    return (
                      <tr key={a.id} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="p-3"><div className="font-medium">{a.title}</div></td>
                        <td className="p-3"><Badge variant="outline">{a.ad_type ?? "youtube"}</Badge></td>
                        <td className="p-3">{a.duration_seconds}s</td>
                        <td className="p-3 text-blue-400">+{base}</td>
                        <td className="p-3 text-gray-300">+{base * 2}</td>
                        <td className="p-3 text-yellow-400">+{base * 4}</td>
                        <td className="p-3"><Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "Active" : "Paused"}</Badge></td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditAd(a)}><Edit2 className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="outline" onClick={() => toggleAd(a.id, a.is_active)}>{a.is_active ? "Pause" : "Activate"}</Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteAd(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* PLANS */}
      {tab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold">Subscription Plans</h3><p className="text-xs text-muted-foreground">Create and manage platform plans</p></div>
            <Button onClick={openNewPlan} className="bg-emerald-500 hover:bg-emerald-600"><Plus className="h-4 w-4 mr-2" /> Create New Plan</Button>
          </div>
          {showPlanForm && (
            <Card className="border-emerald-500/30 bg-card/80 p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Crown className="h-5 w-5 text-yellow-400" />{editingPlan ? "Edit Plan" : "Create New Plan"}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Plan Key Name * (e.g. silver)</Label>
                  <Input placeholder="e.g. silver" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value.toLowerCase().replace(/\s/g, "") })} disabled={!!editingPlan} />
                  <p className="text-xs text-muted-foreground mt-1">Lowercase, no spaces</p>
                </div>
                <div><Label>Display Label *</Label><Input placeholder="e.g. Silver" value={planForm.label} onChange={(e) => setPlanForm({ ...planForm, label: e.target.value })} /></div>
                <div>
                  <Label>Price (USD/month)</Label>
                  <Input type="number" min="0" value={planForm.price_usd} onChange={(e) => setPlanForm({ ...planForm, price_usd: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground mt-1">0 = Free plan</p>
                </div>
                <div>
                  <Label>Earning Multiplier</Label>
                  <Input type="number" min="1" value={planForm.multiplier} onChange={(e) => setPlanForm({ ...planForm, multiplier: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Duration (days)</Label>
                  <Input type="number" min="0" value={planForm.duration_days} onChange={(e) => setPlanForm({ ...planForm, duration_days: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground mt-1">0 = Lifetime</p>
                </div>
                <div><Label>Sort Order</Label><Input type="number" min="0" value={planForm.sort_order} onChange={(e) => setPlanForm({ ...planForm, sort_order: Number(e.target.value) })} /></div>
                <div className="md:col-span-2">
                  <Label>Features (one per line)</Label>
                  <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-24 resize-none" placeholder={"10 ads/day\n2x earning multiplier"} value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} />
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={planForm.is_active} onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })} className="w-4 h-4" />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={planForm.is_popular} onChange={(e) => setPlanForm({ ...planForm, is_popular: e.target.checked })} className="w-4 h-4" />
                    <span className="text-sm">Most Popular</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <Button onClick={savePlan} disabled={savingPlan} className="bg-emerald-500 hover:bg-emerald-600">
                  {savingPlan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  {editingPlan ? "Save Changes" : "Create Plan"}
                </Button>
                <Button variant="outline" onClick={() => setShowPlanForm(false)}>Cancel</Button>
              </div>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className={`border-border/50 bg-card/80 p-5 relative ${!plan.is_active ? "opacity-60" : ""}`}>
                {plan.is_popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><span className="bg-primary text-white text-xs px-3 py-1 rounded-full">⭐ Most Popular</span></div>}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-lg">{plan.label}</h4>
                    <p className="text-2xl font-bold text-primary">${plan.price_usd}<span className="text-xs text-muted-foreground">/mo</span></p>
                  </div>
                  <Badge variant={plan.is_active ? "default" : "secondary"}>{plan.is_active ? "Active" : "Inactive"}</Badge>
                </div>
                <p className="text-xs text-emerald-400 font-semibold mt-2">{plan.multiplier}x earning multiplier</p>
                {(plan.features ?? []).slice(0, 3).map((f: string) => (<p key={f} className="text-xs text-muted-foreground">✓ {f}</p>))}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditPlan(plan)}><Edit2 className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => togglePlan(plan.id, plan.is_active)}>{plan.is_active ? "Hide" : "Show"}</Button>
                  {plan.name !== "basic" && <Button size="sm" variant="destructive" onClick={() => deletePlan(plan.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* SUBSCRIPTION REQUESTS */}
      {tab === "subscriptions" && (
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <div className="p-4 border-b border-border/40">
            <h3 className="font-semibold">Plan Upgrade Requests</h3>
            <p className="text-xs text-muted-foreground">Verify payment then activate plan</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">User</th><th className="p-3">Plan</th><th className="p-3">Amount</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="p-3"><div className="font-medium">{s.profiles?.full_name || "—"}</div><div className="text-xs text-muted-foreground">{s.profiles?.email}</div></td>
                    <td className="p-3 capitalize"><Badge variant={s.plan_name === "gold" ? "default" : "outline"}>{s.plan_name}</Badge></td>
                    <td className="p-3 text-emerald-400 font-semibold">${s.price_usd}</td>
                    <td className="p-3 text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="p-3"><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "✅ Active" : "⏳ Pending"}</Badge></td>
                    <td className="p-3">
                      {!s.is_active && (
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-emerald-500" onClick={() => activateSubscription(s)}><Check className="h-3.5 w-3.5 mr-1" /> Activate</Button>
                          <Button size="sm" variant="destructive" onClick={() => rejectSubscription(s)}><X className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No requests yet</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TASK REVIEWS */}
      {tab === "task_reviews" && (
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <div className="p-4 border-b border-border/40">
            <h3 className="font-semibold">Task Completion Reviews</h3>
            <p className="text-xs text-muted-foreground">
              Verify task completions — approve to award points, reject if fraudulent
            </p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 border-b border-border/40">
            <div className="text-center">
              <p className="text-xl font-bold text-yellow-400">{taskCompletions.filter(tc => tc.status === "pending").length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-400">{taskCompletions.filter(tc => tc.status === "approved").length}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-400">{taskCompletions.filter(tc => tc.status === "rejected").length}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Task</th>
                  <th className="p-3">Reward</th>
                  <th className="p-3">Submitted</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {taskCompletions.map((tc: any) => (
                  <tr key={tc.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-medium">{tc.profiles?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{tc.profiles?.email}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{tc.tasks?.title || "—"}</div>
                    </td>
                    <td className="p-3 text-emerald-400 font-semibold">
                      +{tc.tasks?.reward_points ?? 0} pts
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(tc.completed_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <Badge variant={
                        tc.status === "approved" ? "default" :
                        tc.status === "rejected" ? "destructive" : "secondary"
                      }>
                        {tc.status === "approved" ? "✅ Approved" :
                         tc.status === "rejected" ? "❌ Rejected" : "⏳ Pending"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {tc.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-emerald-500"
                            onClick={() => approveTaskCompletion(tc)}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive"
                            onClick={() => rejectTaskCompletion(tc.id)}>
                            <X className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {taskCompletions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No task submissions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TASKS MANAGEMENT */}
      {tab === "tasks_management" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => toast.info("Create new task on Investor Tasks page")} className="bg-emerald-500 hover:bg-emerald-600">
              <Plus className="h-4 w-4 mr-2" /> View Pending Tasks
            </Button>
          </div>
          <Card className="overflow-hidden border-border/50 bg-card/80">
            <div className="p-4 border-b border-border/40">
              <h3 className="font-semibold">Investor Tasks Management</h3>
              <p className="text-xs text-muted-foreground">Review and approve tasks from investors</p>
            </div>

            <div className="grid grid-cols-4 gap-4 p-4 border-b border-border/40">
              <div className="text-center">
                <p className="text-xl font-bold text-yellow-400">{tasks.filter((t: any) => t.status === "pending").length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-400">{tasks.filter((t: any) => t.status === "approved").length}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-red-400">{tasks.filter((t: any) => t.status === "rejected").length}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-blue-400">{tasks.filter((t: any) => t.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Investor</th>
                    <th className="p-3">Task Title</th>
                    <th className="p-3">Reward</th>
                    <th className="p-3">Budget</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Active</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t: any) => (
                    <tr key={t.id} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="p-3">
                        <div className="font-medium">{t.profiles?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{t.profiles?.email}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{t.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                      </td>
                      <td className="p-3 text-emerald-400 font-semibold">+{t.reward_points} pts</td>
                      <td className="p-3 font-bold">${Number(t.budget_usd).toFixed(2)}</td>
                      <td className="p-3">
                        <Badge variant={
                          t.status === "approved" ? "default" :
                          t.status === "rejected" ? "destructive" : "secondary"
                        }>
                          {t.status === "approved" ? "✅ Approved" :
                           t.status === "rejected" ? "❌ Rejected" : "⏳ Pending"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={t.is_active ? "default" : "secondary"}>
                          {t.is_active ? "Live" : "Draft"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {t.status === "pending" && (
                            <>
                              <Button size="sm" className="bg-emerald-500 text-xs" onClick={async () => {
                                await supabase.from("tasks").update({ status: "approved" }).eq("id", t.id);
                                toast.success("Task approved!");
                                loadAll();
                              }}>
                                <Check className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="destructive" className="text-xs" onClick={async () => {
                                await supabase.from("tasks").update({ status: "rejected" }).eq("id", t.id);
                                toast.success("Task rejected!");
                                loadAll();
                              }}>
                                <X className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                          {t.status === "approved" && (
                            <Button size="sm" variant="outline" className="text-xs" onClick={async () => {
                              await supabase.from("tasks").update({ is_active: !t.is_active }).eq("id", t.id);
                              toast.success(t.is_active ? "Task paused!" : "Task activated!");
                              loadAll();
                            }}>
                              {t.is_active ? "Pause" : "Activate"}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => window.open(t.task_url, "_blank")}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        No tasks yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* SETTINGS */}
      {tab === "settings" && (
        <div className="space-y-4 max-w-2xl">
          <Card className="border-border/50 bg-card/80 p-6">
            <h3 className="font-semibold mb-5 flex items-center gap-2">
              <Settings className="h-5 w-5" /> Platform Settings
            </h3>
            <div className="space-y-5">
              <div>
                <Label>Platform USDT Wallet (BEP20)</Label>
                <p className="text-xs text-muted-foreground mb-1.5">Users send payments to this address</p>
                <Input value={settingsForm.usdt_bep20_address} onChange={(e) => setSettingsForm({ ...settingsForm, usdt_bep20_address: e.target.value })} placeholder="0x..." className="font-mono" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Minimum Withdrawal ($)</Label>
                  <Input type="number" value={settingsForm.min_withdrawal} onChange={(e) => setSettingsForm({ ...settingsForm, min_withdrawal: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Minimum Deposit ($)</Label>
                  <Input type="number" value={settingsForm.min_deposit} onChange={(e) => setSettingsForm({ ...settingsForm, min_deposit: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Points per $1 USD</Label>
                  <p className="text-xs text-muted-foreground mb-1">1000 = 1000 points = $1</p>
                  <Input type="number" value={settingsForm.points_per_dollar} onChange={(e) => setSettingsForm({ ...settingsForm, points_per_dollar: Number(e.target.value) })} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-sm font-semibold">Referral Commission by Plan</Label>
                  <p className="text-xs text-muted-foreground mb-3">Referrer ko kitna % milega</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
                      <p className="text-xs text-blue-400 font-semibold mb-2">Basic Plan</p>
                      <div className="flex items-center gap-1">
                        <Input type="number" min="1" max="50" value={settingsForm.referral_commission_basic} onChange={(e) => setSettingsForm({ ...settingsForm, referral_commission_basic: Number(e.target.value) })} className="text-center" />
                        <span className="text-sm font-bold">%</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-500/10 border border-gray-500/30 p-3">
                      <p className="text-xs text-gray-400 font-semibold mb-2">Silver Plan</p>
                      <div className="flex items-center gap-1">
                        <Input type="number" min="1" max="50" value={settingsForm.referral_commission_silver} onChange={(e) => setSettingsForm({ ...settingsForm, referral_commission_silver: Number(e.target.value) })} className="text-center" />
                        <span className="text-sm font-bold">%</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
                      <p className="text-xs text-yellow-400 font-semibold mb-2">Gold Plan</p>
                      <div className="flex items-center gap-1">
                        <Input type="number" min="1" max="50" value={settingsForm.referral_commission_gold} onChange={(e) => setSettingsForm({ ...settingsForm, referral_commission_gold: Number(e.target.value) })} className="text-center" />
                        <span className="text-sm font-bold">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Button onClick={saveSettings} disabled={savingSettings} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                {savingSettings ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Settings</>}
              </Button>
            </div>
          </Card>
          <Card className="border-border/50 bg-card/80 p-4">
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Current Active Settings</h4>
            <div className="space-y-2">
              {[
                { label: "Wallet Address", value: settings?.usdt_bep20_address?.slice(0, 20) + "..." || "Not set" },
                { label: "Min Withdrawal", value: `$${settings?.min_withdrawal ?? 10}` },
                { label: "Min Deposit", value: `$${settings?.min_deposit ?? 5}` },
                { label: "Points per $1", value: `${settings?.points_per_dollar ?? 1000} pts` },
                { label: "Referral - Basic", value: `${settings?.referral_commission_basic ?? 5}%` },
                { label: "Referral - Silver", value: `${settings?.referral_commission_silver ?? 10}%` },
                { label: "Referral - Gold", value: `${settings?.referral_commission_gold ?? 20}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-border/30 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* $1 GAME */}
      {tab === "game" && (
        <div className="space-y-4">
          <Card className="border-yellow-500/40 bg-yellow-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-yellow-500">
              <Info className="h-4 w-4" /> Temporary testing tool
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Deposits aren't live yet. Use this to credit a user's deposit balance for testing the $1 Game.
              Remove this once the real payment gateway is connected.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label>User</Label>
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
                  value={creditUserId}
                  onChange={(e) => setCreditUserId(e.target.value)}
                >
                  <option value="">Select a user…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>UID-{u.user_number} — {u.full_name || u.email} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  min={1}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  className="mt-1 w-32"
                />
              </div>
              <Button onClick={handleCreditDeposit} disabled={crediting}>
                {crediting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Credit balance
              </Button>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Stat icon={Ticket} label="Total rounds" value={gameRounds.length} color="purple" />
            <Stat
              icon={DollarSign}
              label="Total revenue"
              value={`$${gameRounds.reduce((s, r) => s + Number(r.total_revenue || 0), 0).toFixed(2)}`}
              color="green"
            />
            <Stat
              icon={Trophy}
              label="Total prizes paid"
              value={`$${gameRounds.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.prize_amount || 0), 0).toFixed(2)}`}
              color="orange"
            />
          </div>

          <Card className="border-border/50 bg-card/80 p-4">
            <h3 className="mb-3 font-semibold">Rounds history</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Round</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Entries</th>
                    <th className="pb-2 pr-4">Revenue</th>
                    <th className="pb-2 pr-4">Prize</th>
                    <th className="pb-2 pr-4">Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {gameRounds.map((r) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="py-2 pr-4">#{r.round_number}</td>
                      <td className="py-2 pr-4 capitalize">{r.status}</td>
                      <td className="py-2 pr-4">{r.total_entries}</td>
                      <td className="py-2 pr-4">${Number(r.total_revenue).toFixed(2)}</td>
                      <td className="py-2 pr-4">${Number(r.prize_amount).toFixed(2)}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {new Date(r.ends_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {gameRounds.length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No rounds yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  const colors: any = { blue: "from-blue-500 to-blue-600", green: "from-emerald-500 to-emerald-600", orange: "from-orange-500 to-orange-600", purple: "from-purple-500 to-purple-600" };
  return (
    <Card className="border-border/50 bg-card/80 p-4">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${colors[color]}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}