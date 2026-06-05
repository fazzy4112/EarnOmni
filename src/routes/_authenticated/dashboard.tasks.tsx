import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", task_url: "", reward_points: 100, budget_usd: 50 });
  const [loading, setLoading] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("tasks").insert({ investor_id: user.id, ...form });
    if (error) toast.error(error.message);
    else {
      toast.success("Task submitted for review!");
      setForm({ title: "", description: "", task_url: "", reward_points: 100, budget_usd: 50 });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    }
    setLoading(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6">
        <Briefcase className="h-6 w-6 text-primary" />
        <h3 className="mt-3 text-lg font-semibold">Submit investor task</h3>
        <p className="text-sm text-muted-foreground">Promote your link to our user base.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Task URL</Label>
            <Input type="url" value={form.task_url} onChange={(e) => setForm({ ...form, task_url: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reward (pts)</Label>
              <Input type="number" min="10" value={form.reward_points} onChange={(e) => setForm({ ...form, reward_points: +e.target.value })} required />
            </div>
            <div>
              <Label>Budget (USD)</Label>
              <Input type="number" min="10" value={form.budget_usd} onChange={(e) => setForm({ ...form, budget_usd: +e.target.value })} required />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[image:var(--gradient-hero)]">
            {loading ? "Submitting..." : "Submit task"}
          </Button>
        </form>
      </Card>

      <Card className="border-border/50 bg-card/50 p-6">
        <h3 className="text-lg font-semibold">Recent tasks</h3>
        <div className="mt-4 space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="rounded-lg border border-border/40 p-3">
              <div className="flex items-start justify-between">
                <p className="font-medium">{t.title}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{t.status}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
              <p className="mt-2 text-xs text-primary">+{t.reward_points} pts · ${t.budget_usd} budget</p>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
        </div>
      </Card>
    </div>
  );
}