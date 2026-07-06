import {
  performFraudCheck,
  saveVerificationLog,
  processTaskVerification,
} from "@/lib/fraud-detection";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ExternalLink, CheckCircle2, Clock, Users,
  Youtube, Instagram, Globe, Star, Loader2,
  Briefcase, ArrowRight
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [completing, setCompleting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"offerwall" | "tasks" | "submit">("offerwall");
  const [submitting, setSubmitting] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    title: "", description: "", task_url: "",
    task_type: "link_visit", reward_points: 100, budget_usd: 50,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["approved_tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "approved")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["task_completions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_completions")
        .select("task_id, status")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const approvedTaskIds = new Set(
    completions.filter((c: any) => c.status === "approved").map((c: any) => c.task_id)
  );
  const pendingTaskIds = new Set(
    completions.filter((c: any) => c.status === "pending").map((c: any) => c.task_id)
  );

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "youtube_subscribe": return <Youtube className="h-5 w-5 text-red-400" />;
      case "social_follow": return <Instagram className="h-5 w-5 text-pink-400" />;
      case "app_install": return <Star className="h-5 w-5 text-yellow-400" />;
      case "survey": return <Briefcase className="h-5 w-5 text-blue-400" />;
      default: return <Globe className="h-5 w-5 text-emerald-400" />;
    }
  };

  const getTaskTypeLabel = (type: string) => {
    switch (type) {
      case "youtube_subscribe": return "YouTube Subscribe";
      case "social_follow": return "Social Follow";
      case "app_install": return "App Install";
      case "survey": return "Survey";
      default: return "Visit Link";
    }
  };

  const completeTask = async (task: any) => {
    if (!user || !profile) return;
    setCompleting(task.id);
  
    const startTime = Date.now();
    window.open(task.task_url, "_blank");
  
    setTimeout(async () => {
      try {
        const timeSpent = Date.now() - startTime;
  
        // ✅ PERFORM FRAUD CHECK
        const fraudResult = await performFraudCheck(
          user.id,
          task.id,
          timeSpent
        );
  
        // Insert task completion
        const { data: insertedCompletion, error: insertError } = await supabase
          .from("task_completions")
          .insert({
            task_id: task.id,
            user_id: user.id,
            status: "pending",
          })
          .select()
          .single();
  
        if (insertError) {
          if (insertError.code === "23505") {
            toast.error("Already submitted!");
          } else {
            toast.error(insertError.message);
          }
          setCompleting(null);
          return;
        }
  
        // Save verification log
        await saveVerificationLog(
          insertedCompletion.id,
          fraudResult,
          task.task_type
        );
  
        // Process verification (auto-approve/reject)
        await processTaskVerification(
          insertedCompletion.id,
          user.id,
          fraudResult
        );
  
        // Show appropriate message
        if (fraudResult.decision === "auto_approve") {
          toast.success(
            `✅ AUTO-APPROVED! +${fraudResult.details.deviceCheck * 2} points awarded instantly! (Score: ${fraudResult.fraudScore}/100)`
          );
        } else if (fraudResult.decision === "manual_review") {
          toast.info(
            `⏳ Submitted for review! Admin will verify within 24 hours. (Fraud Score: ${fraudResult.fraudScore}/100)`
          );
        } else {
          toast.error(
            `❌ Flagged as suspicious (Score: ${fraudResult.fraudScore}/100). ${
              fraudResult.details.flaggedReasons[0] || "Try another task"
            }`
          );
        }
  
        qc.invalidateQueries({ queryKey: ["task_completions"] });
      } catch (error) {
        console.error(error);
        toast.error("Something went wrong!");
      }
      setCompleting(null);
    }, 3000);
  };
  
  const submitTask = async () => {
    if (!user) return;
    if (!submitForm.title || !submitForm.task_url) { toast.error("Title and URL required!"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("tasks").insert({
      investor_id: user.id,
      title: submitForm.title,
      description: submitForm.description,
      task_url: submitForm.task_url,
      task_type: submitForm.task_type,
      reward_points: submitForm.reward_points,
      budget_usd: submitForm.budget_usd,
      status: "pending",
      is_active: false,
    });
    if (error) { toast.error(error.message); }
    else {
      toast.success("✅ Task submitted for admin review!");
      setSubmitForm({ title: "", description: "", task_url: "", task_type: "link_visit", reward_points: 100, budget_usd: 50 });
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Task Board</h2>
          <p className="text-sm text-muted-foreground">Complete tasks and earn bonus points</p>
        </div>
        <span className="text-sm bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full">
          ✅ {approvedTaskIds.size} completed
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/80 p-4 text-center">
          <p className="text-2xl font-bold text-primary">{tasks.length}</p>
          <p className="text-xs text-muted-foreground">Sponsor Tasks</p>
        </Card>
        <Card className="border-border/50 bg-card/80 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{pendingTaskIds.size}</p>
          <p className="text-xs text-muted-foreground">Pending Review</p>
        </Card>
        <Card className="border-border/50 bg-card/80 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{approvedTaskIds.size}</p>
          <p className="text-xs text-muted-foreground">Approved</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveTab("offerwall")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "offerwall" ? "bg-primary text-white" : "bg-muted/30 text-muted-foreground"}`}>
          🎁 Ad Offers
        </button>
        <button onClick={() => setActiveTab("tasks")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "tasks" ? "bg-primary text-white" : "bg-muted/30 text-muted-foreground"}`}>
          📋 Sponsor Tasks
        </button>
        <button onClick={() => setActiveTab("submit")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "submit" ? "bg-primary text-white" : "bg-muted/30 text-muted-foreground"}`}>
          📤 Submit Task
        </button>
      </div>

      {activeTab === "offerwall" && (
        <Card className="border-border/50 bg-card/80 overflow-hidden p-0">
          <iframe
            sandbox="allow-popups allow-same-origin allow-scripts allow-forms allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            src={`https://www.mobtrk.link/wall/8mQ7M?subid=${user?.id ?? ""}`}
            style={{ width: "100%", height: "690px", border: "none" }}
            title="EarnOmni Offerwall"
          />
        </Card>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : tasks.length === 0 ? (
            <Card className="border-border/50 bg-card/50 p-12 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold">No tasks available yet</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {tasks.map((task: any) => {
                const isApproved = approvedTaskIds.has(task.id);
                const isPending = pendingTaskIds.has(task.id);
                const isCompleting = completing === task.id;
                const spotsLeft = (task.max_completions ?? 100) - (task.current_completions ?? 0);
                const multiplier = profile?.plan === "gold" ? 4 : profile?.plan === "silver" ? 2 : 1;
                const earnPts = task.reward_points * multiplier;
                return (
                  <Card key={task.id} className={`border-border/50 p-5 transition-all ${isApproved ? "bg-emerald-500/5 border-emerald-500/20" : isPending ? "bg-yellow-500/5 border-yellow-500/20" : "bg-card/80"}`}>
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                        {getTaskIcon(task.task_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm">{task.title}</h3>
                          {isApproved ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 flex-shrink-0"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>
                          ) : isPending ? (
                            <Badge className="bg-yellow-500/20 text-yellow-400 flex-shrink-0"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>
                          ) : (
                            <Badge variant="outline" className="flex-shrink-0 text-xs">{getTaskTypeLabel(task.task_type)}</Badge>
                          )}
                        </div>
                        {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~30s</span>
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {spotsLeft} spots</span>
                          </div>
                          <span className="text-sm font-bold text-emerald-400">+{earnPts} pts</span>
                        </div>
                      </div>
                    </div>
                    {isPending && (
                      <div className="mt-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                        <p className="text-xs text-yellow-400">⏳ Admin is verifying. Points awarded after approval.</p>
                      </div>
                    )}
                    <Button
                      className={`mt-4 w-full ${isApproved ? "bg-emerald-500/20 text-emerald-400 cursor-default" : isPending ? "bg-yellow-500/20 text-yellow-400 cursor-default" : "bg-emerald-500 hover:bg-emerald-600 text-white"}`}
                      disabled={isApproved || isPending || isCompleting || spotsLeft <= 0}
                      onClick={() => !isApproved && !isPending && completeTask(task)}
                    >
                      {isCompleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Opening...</>
                        : isApproved ? <><CheckCircle2 className="h-4 w-4 mr-2" /> ✅ Completed</>
                        : isPending ? <><Clock className="h-4 w-4 mr-2" /> ⏳ Under Review</>
                        : spotsLeft <= 0 ? "Task Full"
                        : <><ExternalLink className="h-4 w-4 mr-2" /> Complete Task <ArrowRight className="h-4 w-4 ml-1" /></>}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "submit" && (
        <Card className="border-border/50 bg-card/80 p-6 max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Submit Investor Task</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Task Type</label>
              <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={submitForm.task_type} onChange={(e) => setSubmitForm({ ...submitForm, task_type: e.target.value })}>
                <option value="link_visit">🌐 Visit Website</option>
                <option value="youtube_subscribe">🎬 YouTube Subscribe</option>
                <option value="social_follow">📱 Social Follow</option>
                <option value="app_install">📲 App Install</option>
                <option value="survey">📝 Survey</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title *</label>
              <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={submitForm.title} onChange={(e) => setSubmitForm({ ...submitForm, title: e.target.value })} placeholder="e.g. Subscribe to our channel" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-20 resize-none" value={submitForm.description} onChange={(e) => setSubmitForm({ ...submitForm, description: e.target.value })} placeholder="What users need to do..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Task URL *</label>
              <input type="url" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={submitForm.task_url} onChange={(e) => setSubmitForm({ ...submitForm, task_url: e.target.value })} placeholder="https://your-link.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Reward Points</label>
                <input type="number" min="10" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={submitForm.reward_points} onChange={(e) => setSubmitForm({ ...submitForm, reward_points: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Budget (USD)</label>
                <input type="number" min="10" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={submitForm.budget_usd} onChange={(e) => setSubmitForm({ ...submitForm, budget_usd: Number(e.target.value) })} />
              </div>
            </div>
            <Button onClick={submitTask} disabled={submitting} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</> : "📤 Submit for Review"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}