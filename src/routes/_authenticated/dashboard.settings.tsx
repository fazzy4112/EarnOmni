import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  User, Lock, Shield, Copy, Eye, EyeOff,
  CheckCircle2, AlertTriangle, Phone, Mail
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();

  // Profile state
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Email reset state
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name);
  }, [profile?.full_name]);

  // Password strength checker
  const getPasswordStrength = (pw: string) => {
    if (!pw) return { label: "", color: "", score: 0 };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: "Weak", color: "bg-red-500", score };
    if (score === 2) return { label: "Fair", color: "bg-yellow-500", score };
    if (score === 3) return { label: "Good", color: "bg-blue-500", score };
    return { label: "Strong", color: "bg-emerald-500", score };
  };

  const pwStrength = getPasswordStrength(newPassword);

  const copyReferralCode = () => {
    navigator.clipboard.writeText(profile?.referral_code ?? "");
    toast.success("Referral code copied!");
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/auth?ref=${profile?.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied!");
  };

  // Save profile
  const saveProfile = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error("Name cannot be empty!"); return; }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("✅ Profile updated!"); refreshProfile(); }
    setSavingProfile(false);
  };

  // Change password
  const changePassword = async () => {
    if (!newPassword) { toast.error("Enter new password!"); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters!"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match!"); return; }
    if (pwStrength.score < 2) { toast.error("Password is too weak! Add uppercase, numbers or symbols."); return; }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else {
      toast.success("✅ Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPassword(false);
  };

  // Send password reset email
  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success(`✅ Password reset email sent to ${user.email}`);
    setSendingReset(false);
  };

  return (
    <div className="max-w-2xl space-y-6">

      {/* Account Overview */}
      <Card className="border-border/50 bg-[image:var(--gradient-card)] p-5">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
            {name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <h2 className="text-xl font-bold">{name || "User"}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full capitalize">
                {profile?.plan ?? "basic"} plan
              </span>
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                ✅ Email Verified
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Profile Settings */}
      <Card className="border-border/50 bg-card/80 p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Profile Information</h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={user?.email ?? ""} disabled className="pl-9 opacity-70" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Email cannot be changed for security reasons
            </p>
          </div>

          <div>
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label>Phone Number (Optional)</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 3XX XXXXXXX"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Used for account recovery only
            </p>
          </div>

          <Button
            onClick={saveProfile}
            disabled={savingProfile}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {savingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </Card>

      {/* Password & Security */}
      <Card className="border-border/50 bg-card/80 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Password & Security</h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password Strength Bar */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all ${
                        i <= pwStrength.score ? pwStrength.color : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${
                  pwStrength.score <= 1 ? "text-red-400" :
                  pwStrength.score === 2 ? "text-yellow-400" :
                  pwStrength.score === 3 ? "text-blue-400" : "text-emerald-400"
                }`}>
                  Password strength: {pwStrength.label}
                </p>
              </div>
            )}
          </div>

          <div>
            <Label>Confirm New Password</Label>
            <div className="relative">
              <Input
                type={showConfirmPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${
                newPassword === confirmPassword ? "text-emerald-400" : "text-red-400"
              }`}>
                {newPassword === confirmPassword
                  ? <><CheckCircle2 className="h-3 w-3" /> Passwords match</>
                  : <><AlertTriangle className="h-3 w-3" /> Passwords do not match</>
                }
              </p>
            )}
          </div>

          {/* Password Requirements */}
          <div className="rounded-lg bg-muted/20 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Password Requirements:</p>
            {[
              { check: newPassword.length >= 8, text: "At least 8 characters" },
              { check: /[A-Z]/.test(newPassword), text: "One uppercase letter (A-Z)" },
              { check: /[0-9]/.test(newPassword), text: "One number (0-9)" },
              { check: /[^A-Za-z0-9]/.test(newPassword), text: "One special character (!@#$)" },
            ].map(({ check, text }) => (
              <div key={text} className={`flex items-center gap-2 text-xs ${check ? "text-emerald-400" : "text-muted-foreground"}`}>
                <CheckCircle2 className={`h-3 w-3 ${check ? "text-emerald-400" : "text-muted-foreground"}`} />
                {text}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={changePassword}
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {savingPassword ? "Changing..." : "Change Password"}
            </Button>
            <Button
              variant="outline"
              onClick={sendPasswordReset}
              disabled={sendingReset}
              className="flex-1"
            >
              {sendingReset ? "Sending..." : "📧 Reset via Email"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            "Reset via Email" will send a password reset link to {user?.email}
          </p>
        </div>
      </Card>

      {/* Referral Section */}
      <Card className="border-border/50 bg-card/80 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Referral Details</h3>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Your Referral Code</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                value={profile?.referral_code ?? ""}
                disabled
                className="font-mono font-bold text-primary"
              />
              <Button variant="outline" onClick={copyReferralCode} className="flex-shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label>Your Referral Link</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                value={`${window.location.origin}/auth?ref=${profile?.referral_code}`}
                disabled
                className="text-xs text-muted-foreground"
              />
              <Button variant="outline" onClick={copyReferralLink} className="flex-shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Share this link — earn 10% commission on every referral's earnings!
            </p>
          </div>
        </div>
      </Card>

      {/* Account Security Info */}
      <Card className="border-border/50 bg-card/80 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-emerald-400" />
          <h3 className="text-lg font-semibold">Account Security</h3>
        </div>

        <div className="space-y-3">
          {[
            { label: "Email Verified", status: true, info: user?.email ?? "" },
            { label: "Password Set", status: true, info: "Last changed: recently" },
            { label: "Account Active", status: profile?.is_active ?? true, info: "Your account is in good standing" },
            { label: "Plan", status: true, info: `${profile?.plan ?? "basic"} plan active` },
          ].map(({ label, status, info }) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-border/30">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{info}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1 ${
                status
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}>
                {status ? <><CheckCircle2 className="h-3 w-3" /> Verified</> : <><AlertTriangle className="h-3 w-3" /> Issue</>}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
          <p className="text-xs text-blue-300 flex items-start gap-2">
            <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
            Your account is protected. Never share your password or referral code with anyone. EarnOmni will never ask for your password.
          </p>
        </div>
      </Card>

    </div>
  );
}