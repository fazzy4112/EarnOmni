import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, ShieldAlert, Users, Wallet, PlayCircle,
  DollarSign, Plus, Trash2, Edit2, Check, X,
  BarChart3, Settings, Info, Save, Crown, Star,
  CheckCircle2, ClipboardList, Briefcase, ExternalLink,
  Ticket, Trophy, CircleDollarSign, MessageSquare,
  Rocket, Mail,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPanel,
});

type Tab = "overview" | "users" | "withdrawals" | "deposits" | "ads" | "plans" | "subscriptions" | "task_reviews" | "tasks_management" | "game" | "support" | "settings" | "growth_engine";

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

interface TaskForm {
  title: string;
  description: string;
  task_url: string;
  task_type: string;
  reward_points: number;
  max_completions: number;
  thumbnail_url: string;
}

const emptyAdForm: AdForm = {
  title: "", description: "", ad_type: "youtube",
  ad_url: "", banner_image_url: "", click_url: "",
  duration_seconds: 30, platform_value: 20, user_share_percent: 10,
};

const emptyPlanForm: PlanForm = {
  name: "", label: "", price_usd: 0, multiplier: 1,
  duration_days: 0, features: "", is_active: true,
  is_popular: false, sort_order: 0,
};

const emptyTaskForm: TaskForm = {
  title: "", description: "", task_url: "", task_type: "link_visit",
  reward_points: 100, max_completions: 100, thumbnail_url: "",
};

// content_drafts has no word_count column — derive it from the body text.
const countWords = (text: string | null | undefined) =>
  text ? text.trim().split(/\s+/).filter(Boolean).length : 0;

// seo-audit 5-tier severity system (critical | warning | good | very_good | excellent).
const SEVERITY_LEVELS = ["critical", "warning", "good", "very_good", "excellent"] as const;
type AuditSeverity = (typeof SEVERITY_LEVELS)[number];

const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  good: "Good",
  very_good: "Very Good",
  excellent: "Excellent",
};

const SEVERITY_BADGE_CLASSES: Record<AuditSeverity, string> = {
  critical: "border-red-500/30 bg-red-500/15 text-red-400",
  warning: "border-orange-500/30 bg-orange-500/15 text-orange-400",
  good: "border-yellow-500/30 bg-yellow-500/15 text-yellow-400",
  very_good: "border-lime-500/30 bg-lime-500/15 text-lime-400",
  excellent: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
};

const severityBadgeClasses = (severity: string) =>
  SEVERITY_BADGE_CLASSES[severity as AuditSeverity] ?? SEVERITY_BADGE_CLASSES.good;

const severityLabel = (severity: string) => SEVERITY_LABELS[severity as AuditSeverity] ?? severity;

// Maps a page's 0-100 seo-audit score to the same 5-tier color scale.
const scoreSeverity = (score: number): AuditSeverity =>
  score <= 40 ? "critical" : score <= 60 ? "warning" : score <= 75 ? "good" : score <= 90 ? "very_good" : "excellent";

const scoreTextClasses = (score: number) => {
  const tier = scoreSeverity(score);
  return tier === "critical" ? "text-red-400"
    : tier === "warning" ? "text-orange-400"
    : tier === "good" ? "text-yellow-400"
    : tier === "very_good" ? "text-lime-400"
    : "text-emerald-400";
};

function AdminPanel() {
  const { profile, loading } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [adminReply, setAdminReply] = useState("");
  const [sendingAdminReply, setSendingAdminReply] = useState(false);
  const [ads, setAds] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [taskCompletions, setTaskCompletions] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [gameRounds, setGameRounds] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [deposits, setDeposits] = useState<any[]>([]);

  // Growth Engine
  const [seoKeywords, setSeoKeywords] = useState<any[]>([]);
  const [seoAudits, setSeoAudits] = useState<any[]>([]);
  const [contentDraftsPending, setContentDraftsPending] = useState<any[]>([]);
  const [adBriefsPending, setAdBriefsPending] = useState<any[]>([]);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [summaryResult, setSummaryResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<any | null>(null);
  const [selectedBrief, setSelectedBrief] = useState<any | null>(null);

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

  // Task form
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);

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
    const [u, w, a, p, s, st, tc, t, gr, dep, sup, sk, sa, cd, ab] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("ads").select("*").order("created_at", { ascending: false }),
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("subscriptions").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("platform_settings").select("*").eq("id", 1).single(),
      supabase.from("task_completions").select("*").order("completed_at", { ascending: false }),
      supabase.from("tasks").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),  // ✅ YE ADD KAR
      supabase.from("game_rounds").select("*").order("created_at", { ascending: false }),
      supabase.from("deposits").select("*, profiles(full_name, email, user_number)").order("created_at", { ascending: false }),
      supabase.from("support_tickets").select("*, profiles(full_name, email, user_number)").order("created_at", { ascending: false }),
      supabase.from("seo_keywords").select("*").order("priority", { ascending: false }).limit(5),
      supabase.from("seo_audits").select("*").order("created_at", { ascending: false }),
      supabase.from("content_drafts").select("*, seo_keywords(keyword)").eq("status", "draft").order("created_at", { ascending: false }),
      supabase.from("ad_campaign_briefs").select("*, seo_keywords(keyword)").eq("status", "draft").order("created_at", { ascending: false }),
    ]);
    setSupportTickets(sup.data ?? []);
    setUsers(u.data ?? []);
    setWithdrawals(w.data ?? []);
    setAds(a.data ?? []);
    setTasks(t.data ?? []);
    setPlans(p.data ?? []);
    setSubscriptions(s.data ?? []);
    setGameRounds(gr.data ?? []);
    setDeposits(dep.data ?? []);
    setSeoKeywords(sk.data ?? []);
    setSeoAudits(sa.data ?? []);
    setContentDraftsPending(cd.data ?? []);
    setAdBriefsPending(ab.data ?? []);
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
  const openTickets = supportTickets.filter((t) => t.status !== "resolved").length;
  const activeAds = ads.filter((a) => a.is_active).length;
  const totalWithdrawn = withdrawals.filter((w) => w.status === "approved").reduce((s, w) => s + Number(w.amount ?? 0), 0);

  // Growth Engine derived data
  const auditSeverityTotals = seoAudits.reduce(
    (acc, a) => {
      const s = a.severity_summary || {};
      acc.critical += s.critical ?? 0;
      acc.warning += s.warning ?? 0;
      acc.good += s.good ?? 0;
      acc.very_good += s.very_good ?? 0;
      acc.excellent += s.excellent ?? 0;
      return acc;
    },
    { critical: 0, warning: 0, good: 0, very_good: 0, excellent: 0 },
  );
  const overallPageScore = seoAudits.length > 0
    ? Math.round(
        seoAudits.reduce((sum, a) => sum + Number(a.severity_summary?.score ?? 0), 0) / seoAudits.length,
      )
    : 0;
  const latestAudits = seoAudits.slice(0, 5);
  const googleAdsPending = adBriefsPending.filter((b) => b.platform === "google_ads");
  const metaAdsPending = adBriefsPending.filter((b) => b.platform === "meta_ads");
  const pendingGrowthItems = contentDraftsPending.length + adBriefsPending.length;

  // Withdrawal actions — approval and rejection (with atomic balance
  // refund) both happen server-side with an idempotency guard.
  const approveWithdrawal = async (id: string) => {
    const { error } = await supabase.rpc("admin_approve_withdrawal", { p_withdrawal_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Withdrawal approved!");
    loadAll();
  };

  const rejectWithdrawal = async (id: string) => {
    const { error } = await supabase.rpc("admin_reject_withdrawal", { p_withdrawal_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Withdrawal rejected & balance refunded.");
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

  const openNewTask = () => { setTaskForm(emptyTaskForm); setEditingTask(null); setShowTaskForm(true); };
  const openEditTask = (task: any) => {
    setTaskForm({
      title: task.title ?? "", description: task.description ?? "",
      task_url: task.task_url ?? "", task_type: task.task_type ?? "link_visit",
      reward_points: task.reward_points ?? 100, max_completions: task.max_completions ?? 100,
      thumbnail_url: task.thumbnail_url ?? "",
    });
    setEditingTask(task);
    setShowTaskForm(true);
  };
  const saveTask = async () => {
    if (!taskForm.title.trim() || !taskForm.task_url.trim()) {
      toast.error("Title and URL are required.");
      return;
    }
    const payload = editingTask
      ? { ...taskForm }
      : { ...taskForm, status: "approved", is_active: true };
    const { error } = editingTask
      ? await supabase.from("tasks").update(payload).eq("id", editingTask.id)
      : await supabase.from("tasks").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingTask ? "Task updated!" : "Task created!");
    setShowTaskForm(false);
    loadAll();
  };
  const deleteTask = async (task: any) => {
    const hasCompletions = (task.current_completions ?? 0) > 0;
    const message = hasCompletions
      ? `This task has ${task.current_completions} completion(s). Deleting it will also delete those completion records (users' already-credited points/balance are NOT affected — only the history record). Are you sure?`
      : "Delete this task permanently?";
    if (!window.confirm(message)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted.");
    loadAll();
  };

  // User actions
  const toggleUserBlock = async (id: string, is_active: boolean) => {
    const { error } = await supabase.rpc("admin_set_user_banned", { p_user_id: id, p_banned: is_active });
    if (error) { toast.error(error.message); return; }
    toast.success(is_active ? "User blocked!" : "User unblocked!"); loadAll();
  };

  // Subscription actions — activation, plan assignment, and referral
  // commission (computed from the authoritative plans.price_usd, not the
  // user-supplied subscriptions row) all happen atomically server-side.
  const activateSubscription = async (sub: any) => {
    const { error } = await supabase.rpc("admin_approve_subscription", { p_subscription_id: sub.id });
    if (error) { toast.error(error.message); } else { toast.success(`${sub.plan_name} plan activated!`); }
    loadAll();
  };
  const rejectSubscription = async (sub: any) => {
    const { error } = await supabase.rpc("admin_reject_subscription", { p_subscription_id: sub.id });
    if (error) { toast.error(error.message); } else { toast.success("Subscription rejected."); }
    loadAll();
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
    if (deactivateError) { toast.error(deactivateError.message); return; }

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
    if (insertError) { toast.error(insertError.message); return; }

    const { error: profileError } = await supabase.rpc("admin_set_user_plan", {
      p_user_id: userId,
      p_plan_name: plan.name,
    });
    if (profileError) { toast.error(profileError.message); return; }

    toast.success(`Plan manually changed to ${plan.label || plan.name}`);
    loadAll();
  };

  // Task completion actions — approval/rejection and the reward math both
  // happen server-side in these RPCs (admin check, row lock, status guard,
  // completion-count + max_completions check), so the browser never
  // computes or writes points/balance directly.
  const approveTaskCompletion = async (tc: any) => {
    const { error } = await supabase.rpc("admin_approve_task_completion", { p_completion_id: tc.id });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("✅ Task approved & points awarded!");
    }
    loadAll();
  };

  const rejectTaskCompletion = async (id: string) => {
    const { error } = await supabase.rpc("admin_reject_task_completion", { p_completion_id: id });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Task rejected!");
    }
    loadAll();
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

  const [togglingGame, setTogglingGame] = useState(false);
  const handleToggleGame = async () => {
    setTogglingGame(true);
    const { error } = await supabase.rpc("admin_set_game_enabled", { p_enabled: !settings?.game_enabled });
    setTogglingGame(false);
    if (error) { toast.error(error.message); return; }
    toast.success(!settings?.game_enabled ? "$1 Game is now LIVE!" : "$1 Game paused.");
    loadAll();
  };

  const approveDeposit = async (id: string) => {
    const { error } = await supabase.rpc("admin_approve_deposit", { p_deposit_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Deposit approved and credited!");
    loadAll();
  };

  const rejectDeposit = async (id: string) => {
    const { error } = await supabase.rpc("admin_reject_deposit", { p_deposit_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Deposit rejected.");
    loadAll();
  };

  // Growth Engine actions
  const updateContentDraftStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("content_drafts").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Content draft ${status}!`);
    loadAll();
  };

  const updateAdBriefStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("ad_campaign_briefs").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Ad campaign brief ${status}!`);
    loadAll();
  };

  const sendWeeklySummary = async () => {
    setSendingSummary(true);
    setSummaryResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-growth-summary");
      if (error) {
        let message = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) message = body.error;
        } catch {
          // Fall back to the raw error message below.
        }
        throw new Error(message);
      }
      const message = data?.message ?? "Weekly summary email sent!";
      setSummaryResult({ success: true, message });
      toast.success(message);
    } catch (err: any) {
      const message = err?.message || "Failed to send weekly summary email.";
      setSummaryResult({ success: false, message });
      toast.error(message);
    } finally {
      setSendingSummary(false);
    }
  };

  const loadTicketMessages = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    const { data } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setTicketMessages(data ?? []);
  };

  const sendAdminReply = async () => {
    if (!selectedTicketId || !adminReply.trim() || !profile) return;
    setSendingAdminReply(true);
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: selectedTicketId,
      sender_id: profile.id,
      is_admin: true,
      message: adminReply.trim(),
    });
    if (error) {
      toast.error(error.message);
    } else {
      setAdminReply("");
      await loadTicketMessages(selectedTicketId);
    }
    setSendingAdminReply(false);
  };

  const toggleTicketStatus = async (ticketId: string, newStatus: "open" | "resolved") => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", ticketId);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "resolved" ? "Ticket marked resolved." : "Ticket reopened.");
    loadAll();
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "users", label: "Users", icon: Users },
    { key: "withdrawals", label: "Withdrawals", icon: Wallet },
    { key: "deposits", label: "Deposits", icon: CircleDollarSign },
    { key: "ads", label: "Ads", icon: PlayCircle },
    { key: "plans", label: "Plans", icon: Crown },
    { key: "subscriptions", label: "Plan Requests", icon: Star },
    { key: "task_reviews", label: "Task Reviews", icon: ClipboardList },
    { key: "tasks_management", label: "Manage Tasks", icon: Briefcase }, // ✅ YE ADD KAR
    { key: "game", label: "$1 Game", icon: Ticket },
    { key: "support", label: "Support Tickets", icon: MessageSquare },
    { key: "settings", label: "Settings", icon: Settings },
    { key: "growth_engine", label: "Growth Engine", icon: Rocket },
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
            {key === "support" && openTickets > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{openTickets}</span>}
            {key === "growth_engine" && pendingGrowthItems > 0 && <span className="bg-emerald-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingGrowthItems}</span>}
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
                      <Button size="sm" className="h-6 text-xs bg-emerald-500" onClick={() => approveWithdrawal(w.id)}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={() => rejectWithdrawal(w.id)}><X className="h-3 w-3" /></Button>
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
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <Badge variant={u.is_active ? "default" : "destructive"}>{u.is_active ? "Active" : "Blocked"}</Badge>
                        {!u.email_confirmed && (
                          <Badge variant="outline" className="border-yellow-500/50 text-yellow-500 w-fit">Email not confirmed</Badge>
                        )}
                      </div>
                    </td>
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
                          <Button size="sm" className="bg-emerald-500" onClick={() => approveWithdrawal(w.id)}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => rejectWithdrawal(w.id)}><X className="h-3.5 w-3.5 mr-1" /> Reject</Button>
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

      {/* DEPOSITS */}
      {tab === "deposits" && (
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <div className="p-4 border-b border-border/40 flex items-center justify-between">
            <h3 className="font-semibold">Deposit Requests</h3>
            <span className="text-sm text-muted-foreground">
              Pending: {deposits.filter((d) => d.status === "pending").length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">User</th><th className="p-3">Amount</th><th className="p-3">Tx Hash</th><th className="p-3">Network</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
              </thead>
              <tbody>
                {deposits.map((d) => (
                  <tr key={d.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="p-3 text-xs text-muted-foreground">
                      {d.profiles?.full_name || d.profiles?.email} {d.profiles?.user_number && `(UID-${d.profiles.user_number})`}
                    </td>
                    <td className="p-3 font-bold text-emerald-400">${Number(d.amount_usd).toFixed(2)}</td>
                    <td className="p-3 font-mono text-xs max-w-[160px] truncate">{d.tx_hash}</td>
                    <td className="p-3 text-xs">{d.network}</td>
                    <td className="p-3 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                    <td className="p-3"><Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>{d.status}</Badge></td>
                    <td className="p-3">
                      {d.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-emerald-500" onClick={() => approveDeposit(d.id)}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => rejectDeposit(d.id)}><X className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {deposits.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No deposits yet</td></tr>}
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
                <div><Label>User Share % (recommended: ~70% of real revenue)</Label><Input type="number" min="1" max="100" value={adForm.user_share_percent} onChange={(e) => setAdForm({ ...adForm, user_share_percent: Number(e.target.value) })} /></div>
              </div>
              <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3"><Info className="h-4 w-4 text-blue-400" /><span className="text-sm font-semibold">Reward Preview</span></div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-background rounded-lg p-3"><div className="text-xs text-muted-foreground mb-1">Basic 1x</div><div className="text-lg font-bold text-blue-400">{baseReward} pts</div></div>
                  <div className="bg-background rounded-lg p-3"><div className="text-xs text-muted-foreground mb-1">Silver 2x</div><div className="text-lg font-bold text-gray-300">{baseReward * 2} pts</div></div>
                  <div className="bg-background rounded-lg p-3"><div className="text-xs text-muted-foreground mb-1">Gold 4x</div><div className="text-lg font-bold text-yellow-400">{baseReward * 4} pts</div></div>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3"><div className="text-xs text-emerald-400 mb-1">Profit</div><div className="text-lg font-bold text-emerald-400">{adForm.platform_value - baseReward} pts</div></div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  💡 Keep "Total Ad Value" close to your real Adsterra revenue per view (check Adsterra Statistics: Revenue ÷ Impressions × 1000 = points, since 1000 points = $1). Paying out more than you earn per view is a guaranteed loss at scale.
                </p>
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
                  <Label>Price (USD, one-time)</Label>
                  <Input type="number" min="0" value={planForm.price_usd} onChange={(e) => setPlanForm({ ...planForm, price_usd: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground mt-1">0 = Free plan</p>
                </div>
                <div>
                  <Label>Earning Multiplier</Label>
                  <Input type="number" min="1" value={planForm.multiplier} onChange={(e) => setPlanForm({ ...planForm, multiplier: Number(e.target.value) })} />
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
            <Button onClick={openNewTask} className="bg-emerald-500 hover:bg-emerald-600">
              <Plus className="h-4 w-4 mr-2" /> Create Task
            </Button>
          </div>
          {showTaskForm && (
            <Card className="border-emerald-500/30 bg-card/80 p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Briefcase className="h-5 w-5 text-yellow-400" />{editingTask ? "Edit Task" : "Create New Task"}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Title *</Label>
                  <Input placeholder="e.g. Subscribe to our YouTube channel" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-24 resize-none" placeholder="What the user needs to do" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Task URL *</Label>
                  <Input placeholder="https://..." value={taskForm.task_url} onChange={(e) => setTaskForm({ ...taskForm, task_url: e.target.value })} />
                </div>
                <div>
                  <Label>Task Type</Label>
                  <Input placeholder="e.g. link_visit, youtube_subscribe, social_follow" value={taskForm.task_type} onChange={(e) => setTaskForm({ ...taskForm, task_type: e.target.value })} />
                </div>
                <div>
                  <Label>Reward Points</Label>
                  <Input type="number" min="0" value={taskForm.reward_points} onChange={(e) => setTaskForm({ ...taskForm, reward_points: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Max Completions</Label>
                  <Input type="number" min="1" value={taskForm.max_completions} onChange={(e) => setTaskForm({ ...taskForm, max_completions: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Thumbnail URL</Label>
                  <Input placeholder="https://..." value={taskForm.thumbnail_url} onChange={(e) => setTaskForm({ ...taskForm, thumbnail_url: e.target.value })} />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <Button onClick={saveTask} className="bg-emerald-500 hover:bg-emerald-600">
                  <Check className="h-4 w-4 mr-2" />
                  {editingTask ? "Save Changes" : "Create Task"}
                </Button>
                <Button variant="outline" onClick={() => setShowTaskForm(false)}>Cancel</Button>
              </div>
            </Card>
          )}
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
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => openEditTask(t)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="destructive" className="text-xs" onClick={() => deleteTask(t)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      {/* SUPPORT TICKETS */}
      {tab === "support" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/50 bg-card/80 overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-semibold">All Tickets ({supportTickets.length})</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-border/50">
              {supportTickets.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground text-center">No tickets yet.</p>
              ) : (
                supportTickets.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => loadTicketMessages(t.id)}
                    className={`w-full text-left p-4 hover:bg-muted/20 transition-colors ${selectedTicketId === t.id ? "bg-muted/30" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{t.subject}</p>
                      {t.status === "resolved" ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 flex-shrink-0">Resolved</Badge>
                      ) : (
                        <Badge className="bg-yellow-500/20 text-yellow-400 flex-shrink-0">Open</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.profiles?.full_name || t.profiles?.email || "Unknown user"} · {new Date(t.created_at).toLocaleString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="border-border/50 bg-card/80 p-4">
            {!selectedTicketId ? (
              <p className="text-sm text-muted-foreground text-center py-12">Select a ticket to view the conversation.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    {supportTickets.find((t) => t.id === selectedTicketId)?.subject}
                  </h3>
                  {supportTickets.find((t) => t.id === selectedTicketId)?.status === "resolved" ? (
                    <Button size="sm" variant="outline" onClick={() => toggleTicketStatus(selectedTicketId, "open")}>
                      Reopen
                    </Button>
                  ) : (
                    <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => toggleTicketStatus(selectedTicketId, "resolved")}>
                      Mark Resolved
                    </Button>
                  )}
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {ticketMessages.map((m: any) => (
                    <div key={m.id} className={`flex ${m.is_admin ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.is_admin ? "bg-primary text-white" : "bg-muted/40"}`}>
                        <p className="text-xs font-medium mb-1 opacity-80">{m.is_admin ? "You (Support)" : "User"}</p>
                        <p>{m.message}</p>
                        <p className="text-[10px] opacity-60 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Reply to user..."
                    value={adminReply}
                    onChange={(e) => setAdminReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendAdminReply(); }}
                  />
                  <Button onClick={sendAdminReply} disabled={sendingAdminReply || !adminReply.trim()}>
                    {sendingAdminReply ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                  </Button>
                </div>
              </div>
            )}
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
          <Card className={`p-4 ${settings?.game_enabled ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/50 bg-card/80"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <Ticket className="h-4 w-4" />
                  $1 Game status: <span className={settings?.game_enabled ? "text-emerald-400" : "text-muted-foreground"}>
                    {settings?.game_enabled ? "🟢 LIVE" : "⏸️ Paused (Starting Soon)"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {settings?.game_enabled
                    ? "Users can see and enter the game right now."
                    : "Users see a \"Starting Soon\" message instead of the game. Turn this on once you have enough users."}
                </p>
              </div>
              <Button onClick={handleToggleGame} disabled={togglingGame} variant={settings?.game_enabled ? "destructive" : "default"}>
                {togglingGame && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {settings?.game_enabled ? "Pause Game" : "Start Game"}
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

      {/* GROWTH ENGINE */}
      {tab === "growth_engine" && (
        <div className="space-y-6">
          {/* Research Engine */}
          <Card className="overflow-hidden border-border/50 bg-card/80">
            <div className="p-4 border-b border-border/40">
              <h3 className="font-semibold">Research Engine — Top Keywords</h3>
              <p className="text-xs text-muted-foreground">Top 5 keywords by priority</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Keyword</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Search Volume</th>
                    <th className="p-3">Intent</th>
                    <th className="p-3">Country</th>
                  </tr>
                </thead>
                <tbody>
                  {seoKeywords.map((k) => (
                    <tr key={k.id} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="p-3 font-medium">{k.keyword}</td>
                      <td className="p-3">{k.priority}</td>
                      <td className="p-3">{k.search_volume ?? "—"}</td>
                      <td className="p-3">{k.intent ? <Badge variant="outline" className="capitalize">{k.intent}</Badge> : "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{k.target_country ?? "—"}</td>
                    </tr>
                  ))}
                  {seoKeywords.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No keywords researched yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* On-Page SEO Audits */}
          <Card className="overflow-hidden border-border/50 bg-card/80">
            <div className="p-4 border-b border-border/40">
              <h3 className="font-semibold">On-Page SEO Audits</h3>
              <p className="text-xs text-muted-foreground">{seoAudits.length} page audit(s) on record</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border/40">
              <Badge variant="outline" className={severityBadgeClasses("critical")}>
                Critical ({auditSeverityTotals.critical})
              </Badge>
              <Badge variant="outline" className={severityBadgeClasses("warning")}>
                Warning ({auditSeverityTotals.warning})
              </Badge>
              <Badge variant="outline" className={severityBadgeClasses("good")}>
                Good ({auditSeverityTotals.good})
              </Badge>
              <Badge variant="outline" className={severityBadgeClasses("very_good")}>
                Very Good ({auditSeverityTotals.very_good})
              </Badge>
              <Badge variant="outline" className={severityBadgeClasses("excellent")}>
                Excellent ({auditSeverityTotals.excellent})
              </Badge>
              <Badge variant="outline" className={`ml-auto ${severityBadgeClasses(scoreSeverity(overallPageScore))}`}>
                Overall Page Score: {overallPageScore}/100
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Page URL</th>
                    <th className="p-3">Score</th>
                    <th className="p-3">Critical</th>
                    <th className="p-3">Warning</th>
                    <th className="p-3">Good</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {latestAudits.map((a) => (
                    <tr key={a.id} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="p-3 max-w-xs truncate">
                        <button
                          type="button"
                          onClick={() => setSelectedAudit(a)}
                          className="max-w-full truncate text-left text-primary hover:underline"
                        >
                          {a.page_url}
                        </button>
                      </td>
                      <td className={`p-3 font-semibold ${scoreTextClasses(Number(a.severity_summary?.score ?? 0))}`}>
                        {a.severity_summary?.score ?? 0}
                      </td>
                      <td className="p-3 text-red-400">{a.severity_summary?.critical ?? 0}</td>
                      <td className="p-3 text-orange-400">{a.severity_summary?.warning ?? 0}</td>
                      <td className="p-3 text-yellow-400">{a.severity_summary?.good ?? 0}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {latestAudits.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No audits yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Content Drafts */}
          <Card className="overflow-hidden border-border/50 bg-card/80">
            <div className="p-4 border-b border-border/40">
              <h3 className="font-semibold">Content Drafts — Awaiting Approval</h3>
              <p className="text-xs text-muted-foreground">{contentDraftsPending.length} draft(s) pending review</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Title</th>
                    <th className="p-3">Keyword</th>
                    <th className="p-3">SEO Score</th>
                    <th className="p-3">Words</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contentDraftsPending.map((d) => (
                    <tr key={d.id} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="p-3 font-medium max-w-xs truncate">
                        <button
                          type="button"
                          onClick={() => setSelectedDraft(d)}
                          className="max-w-full truncate text-left text-primary hover:underline"
                        >
                          {d.title}
                        </button>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{d.seo_keywords?.keyword ?? "—"}</td>
                      <td className="p-3"><Badge variant={(d.seo_score ?? 0) >= 70 ? "default" : "secondary"}>{d.seo_score ?? 0}/100</Badge></td>
                      <td className="p-3">{countWords(d.body)}</td>
                      <td className="p-3 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-emerald-500" onClick={() => updateContentDraftStatus(d.id, "approved")}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Approve for Publishing
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => updateContentDraftStatus(d.id, "rejected")}>
                            <X className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {contentDraftsPending.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No drafts pending approval</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Ad Campaign Briefs */}
          <Card className="overflow-hidden border-border/50 bg-card/80">
            <div className="p-4 border-b border-border/40">
              <h3 className="font-semibold">Ad Campaign Briefs — Awaiting Approval</h3>
              <p className="text-xs text-muted-foreground">{adBriefsPending.length} brief(s) pending review</p>
            </div>

            {[
              { label: "Google Ads", rows: googleAdsPending },
              { label: "Meta Ads", rows: metaAdsPending },
            ].map(({ label, rows }) => (
              <div key={label} className="border-b border-border/40 last:border-b-0">
                <div className="px-4 pt-4 pb-1">
                  <h4 className="text-sm font-semibold">{label}</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-3">Keyword</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Created</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((b: any) => (
                        <tr key={b.id} className="border-t border-border/40 hover:bg-muted/20">
                          <td className="p-3 text-xs">
                            <button
                              type="button"
                              onClick={() => setSelectedBrief(b)}
                              className="text-primary hover:underline"
                            >
                              {b.seo_keywords?.keyword ?? b.campaign_data?.keyword ?? "—"}
                            </button>
                          </td>
                          <td className="p-3"><Badge variant="secondary">{b.status}</Badge></td>
                          <td className="p-3 text-xs">{new Date(b.created_at).toLocaleDateString()}</td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Button size="sm" className="bg-emerald-500" onClick={() => updateAdBriefStatus(b.id, "approved")}>
                                <Check className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => updateAdBriefStatus(b.id, "rejected")}>
                                <X className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No {label} briefs pending approval</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Card>

          {/* Growth Engine Actions */}
          <Card className="border-border/50 bg-card/80 p-6">
            <h3 className="font-semibold mb-1">Growth Engine Actions</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Send an on-demand summary of Growth Engine activity to the admin inbox.
            </p>
            <Button onClick={sendWeeklySummary} disabled={sendingSummary} className="bg-emerald-500 hover:bg-emerald-600">
              {sendingSummary ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Weekly Summary Email
            </Button>
            {summaryResult && (
              <p className={`mt-3 text-sm ${summaryResult.success ? "text-emerald-400" : "text-red-400"}`}>
                {summaryResult.message}
              </p>
            )}
          </Card>

          {/* SEO Audit detail modal */}
          <Dialog open={!!selectedAudit} onOpenChange={(open) => !open && setSelectedAudit(null)}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
              {selectedAudit && (
                <>
                  <DialogHeader>
                    <DialogTitle className="break-all">{selectedAudit.page_url}</DialogTitle>
                    <DialogDescription>
                      Audited {new Date(selectedAudit.audit_date ?? selectedAudit.created_at).toLocaleString()}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div
                      className={`rounded-lg border p-4 text-center ${severityBadgeClasses(
                        scoreSeverity(Number(selectedAudit.severity_summary?.score ?? 0)),
                      )}`}
                    >
                      <p className="text-3xl font-bold">{selectedAudit.severity_summary?.score ?? 0}/100</p>
                      <p className="text-xs uppercase tracking-wide opacity-80">
                        {severityLabel(scoreSeverity(Number(selectedAudit.severity_summary?.score ?? 0)))} — Overall Page Score
                      </p>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {SEVERITY_LEVELS.map((level) => (
                        <div key={level} className={`rounded-lg p-3 text-center ${severityBadgeClasses(level)}`}>
                          <p className="text-lg font-bold">{selectedAudit.severity_summary?.[level] ?? 0}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">{severityLabel(level)}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                        Issues ({(selectedAudit.issues ?? []).length})
                      </p>
                      <div className="max-h-80 space-y-2 overflow-y-auto">
                        {(selectedAudit.issues ?? []).map((issue: any, i: number) => (
                          <div key={i} className="rounded-lg border border-border/50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">{issue.check}</span>
                              <Badge variant="outline" className={severityBadgeClasses(issue.severity)}>
                                {severityLabel(issue.severity)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{issue.message}</p>
                          </div>
                        ))}
                        {(selectedAudit.issues ?? []).length === 0 && (
                          <p className="text-sm text-muted-foreground">No issues recorded.</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(selectedAudit.created_at).toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Content draft detail modal */}
          <Dialog open={!!selectedDraft} onOpenChange={(open) => !open && setSelectedDraft(null)}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
              {selectedDraft && (
                <>
                  <DialogHeader>
                    <DialogTitle>{selectedDraft.title}</DialogTitle>
                    <DialogDescription>Target keyword: {selectedDraft.seo_keywords?.keyword ?? "—"}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant={(selectedDraft.seo_score ?? 0) >= 70 ? "default" : "secondary"}>
                        SEO score: {selectedDraft.seo_score ?? 0}/100
                      </Badge>
                      <Badge variant="outline">{countWords(selectedDraft.body)} words</Badge>
                      <Badge variant="outline">Created {new Date(selectedDraft.created_at).toLocaleDateString()}</Badge>
                    </div>
                    <div className="max-h-96 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-4">
                      <p className="whitespace-pre-wrap text-sm">{selectedDraft.body}</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={() => { updateContentDraftStatus(selectedDraft.id, "rejected"); setSelectedDraft(null); }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                    <Button
                      className="bg-emerald-500 hover:bg-emerald-600"
                      onClick={() => { updateContentDraftStatus(selectedDraft.id, "approved"); setSelectedDraft(null); }}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve for Publishing
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Ad campaign brief detail modal */}
          <Dialog open={!!selectedBrief} onOpenChange={(open) => !open && setSelectedBrief(null)}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
              {selectedBrief && (
                <>
                  <DialogHeader>
                    <DialogTitle>{selectedBrief.seo_keywords?.keyword ?? selectedBrief.campaign_data?.keyword ?? "Campaign brief"}</DialogTitle>
                    <DialogDescription>
                      <Badge variant="outline" className="capitalize">{String(selectedBrief.platform).replace("_", " ")}</Badge>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {selectedBrief.platform === "google_ads" ? (
                      <>
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Ad Group</p>
                          <p className="text-sm">{selectedBrief.campaign_data?.ad_group_name ?? "—"}</p>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Ad Copy Variations</p>
                          <div className="space-y-2">
                            {(selectedBrief.campaign_data?.ad_copy_variations ?? []).map((v: any, i: number) => (
                              <div key={i} className="rounded-lg border border-border/50 p-3">
                                <p className="text-sm font-medium">{v.headline}</p>
                                <p className="text-xs text-muted-foreground">{v.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Match Types</p>
                          <div className="flex flex-wrap gap-2">
                            {(selectedBrief.campaign_data?.match_types ?? []).map((m: any, i: number) => (
                              <Badge key={i} variant="outline" title={m.reasoning} className="capitalize">{m.type}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Daily Budget</p>
                          <p className="text-sm">
                            ${selectedBrief.campaign_data?.daily_budget_usd?.min} – ${selectedBrief.campaign_data?.daily_budget_usd?.max}
                          </p>
                          <p className="text-xs text-muted-foreground">{selectedBrief.campaign_data?.daily_budget_usd?.reasoning}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Audience Targeting</p>
                          <p className="text-sm">
                            Age {selectedBrief.campaign_data?.audience_targeting?.age_range ?? "—"} ·{" "}
                            {selectedBrief.campaign_data?.audience_targeting?.geographic_focus ?? "—"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(selectedBrief.campaign_data?.audience_targeting?.interests ?? []).map((interest: string, i: number) => (
                              <Badge key={i} variant="outline">{interest}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Ad Copy Variations</p>
                          <div className="space-y-2">
                            {(selectedBrief.campaign_data?.ad_copy_variations ?? []).map((v: any, i: number) => (
                              <div key={i} className="rounded-lg border border-border/50 p-3">
                                <p className="text-sm font-medium">{v.headline}</p>
                                <p className="text-xs text-muted-foreground">{v.primary_text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Creative Direction</p>
                          <p className="text-sm text-muted-foreground">{selectedBrief.campaign_data?.creative_direction ?? "—"}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={() => { updateAdBriefStatus(selectedBrief.id, "rejected"); setSelectedBrief(null); }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                    <Button
                      className="bg-emerald-500 hover:bg-emerald-600"
                      onClick={() => { updateAdBriefStatus(selectedBrief.id, "approved"); setSelectedBrief(null); }}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
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