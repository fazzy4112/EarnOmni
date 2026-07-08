import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  balance: number;
  deposit_balance: number;
  points: number;
  referral_code: string | null;
  referred_by: string | null;
  plan: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  user_number: string;
  avatar_url: string | null;
  email_confirmed: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Auto sign-out after this many minutes of no user activity (mouse, keyboard,
// scroll, touch) — matches how banking-style apps behave, since this app
// handles real USDT withdrawals. The timestamp is stored in localStorage so
// it also correctly signs the user out if they closed the tab/browser and
// come back after the limit has passed, not just while the tab stays open.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = "eo_last_activity";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    let { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();

    // If profile row is missing entirely, create one (covers cases where the
    // auth trigger didn't run yet).
    if (!data) {
      const { data: u } = await supabase.auth.getUser();
      const meta = (u.user?.user_metadata ?? {}) as Record<string, unknown>;
      const code = generateReferralCode();
      await supabase.from("profiles").insert({
        id: uid,
        email: u.user?.email ?? null,
        full_name: (meta.full_name as string) ?? "",
        referral_code: code,
        referred_by: (meta.referred_by as string) ?? null,
      });
      const re = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      data = re.data;
    } else {
      // Backfill missing referral_code or full_name from auth metadata.
      const patch: Record<string, unknown> = {};
      if (!data.referral_code) patch.referral_code = generateReferralCode();
      if (!data.full_name) {
        const { data: u } = await supabase.auth.getUser();
        const fn = (u.user?.user_metadata as Record<string, unknown> | undefined)?.full_name;
        if (typeof fn === "string" && fn.trim()) patch.full_name = fn;
      }
      if (Object.keys(patch).length) {
        const { data: upd } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", uid)
          .select()
          .maybeSingle();
        if (upd) data = upd;
      }
    }

    setProfile((data as Profile) ?? null);
  };

function generateReferralCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await supabase.auth.signOut();
  };

  // 30-minute inactivity auto-logout.
  useEffect(() => {
    if (!user) return;

    const markActive = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    };

    // If we're coming back after the tab/browser was closed for longer than
    // the timeout, sign out immediately instead of waiting for the interval.
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now());
    if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
      signOut();
      toast.info("You were signed out due to 30 minutes of inactivity.");
      return;
    }
    markActive();

    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const interval = setInterval(() => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now());
      if (Date.now() - last > IDLE_TIMEOUT_MS) {
        signOut();
        toast.info("You were signed out due to 30 minutes of inactivity.");
      }
    }, 60 * 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
