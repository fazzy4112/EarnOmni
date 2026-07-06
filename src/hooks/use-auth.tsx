import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
    await supabase.auth.signOut();
  };

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
