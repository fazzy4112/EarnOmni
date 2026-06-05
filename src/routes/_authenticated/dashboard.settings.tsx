import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name);
  }, [profile?.full_name]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated");
      refreshProfile();
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="border-border/50 bg-card/50 p-6">
        <h3 className="text-lg font-semibold">Profile</h3>
        <div className="mt-6 space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled />
          </div>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Referral code</Label>
            <Input value={profile?.referral_code ?? ""} disabled />
          </div>
          <Button onClick={save} disabled={saving} className="bg-[image:var(--gradient-hero)]">
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}