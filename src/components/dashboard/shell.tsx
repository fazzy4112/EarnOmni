import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  PlayCircle,
  DollarSign,
  Users,
  Crown,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Briefcase,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { UserAvatar } from "@/components/dashboard/user-avatar";
import { WinnerCelebrationModal } from "@/components/dashboard/winner-celebration-modal";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badge?: number;
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/watch-ads", label: "Watch Ads", icon: PlayCircle },
  { to: "/dashboard/tasks", label: "Tasks & Earn", icon: Briefcase },
  { to: "/dashboard/game", label: "$1 Game", icon: Ticket },
  { to: "/dashboard/earnings", label: "My Earnings", icon: DollarSign },
  { to: "/dashboard/referrals", label: "Referrals", icon: Users },
  { to: "/dashboard/subscription", label: "Plans", icon: Crown },
  { to: "/dashboard/withdraw", label: "Withdraw", icon: Wallet },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  const { data: adminPendingCount = 0 } = useQuery({
    queryKey: ["admin_pending_count"],
    enabled: !!profile?.is_admin,
    refetchInterval: 30000,
    queryFn: async () => {
      const [wd, subs, tasks] = await Promise.all([
        supabase.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("is_active", false),
        supabase.from("task_completions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return (wd.count ?? 0) + (subs.count ?? 0) + (tasks.count ?? 0);
    },
  });

  const items: NavItem[] = profile?.is_admin
    ? [...navItems, { to: "/admin", label: "Admin Panel", icon: ShieldCheck, badge: adminPendingCount || undefined }]
    : navItems;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WinnerCelebrationModal />
      {/* Sidebar - desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/50 bg-sidebar lg:flex">
        <SidebarContent path={path} onSignOut={handleSignOut} items={items} />
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border/50 bg-sidebar">
            <div className="absolute right-2 top-2">
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarContent path={path} onSignOut={handleSignOut} items={items} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <UserAvatar avatarUrl={profile?.avatar_url} fullName={profile?.full_name} className="h-10 w-10" />
              <div>
                <h1 className="text-sm font-medium text-muted-foreground">Welcome back</h1>
                <p className="text-base font-semibold leading-tight">
                  {profile?.full_name || profile?.email?.split("@")[0] || "Earner"}
                </p>
                {profile?.user_number && (
                  <p className="text-xs text-muted-foreground">UID-{profile.user_number}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-sm md:block">
              <span className="text-muted-foreground">Balance: </span>
              <span className="font-bold text-primary">${(profile?.balance ?? 0).toFixed(2)}</span>
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  path,
  onSignOut,
  items,
  onNavigate,
}: {
  path: string;
  onSignOut: () => void;
  items: NavItem[];
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-border/50 px-6">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-hero)]">
          <Logo className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-bold tracking-tight">EarnOmni</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = item.exact ? path === item.to : path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to as string}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-glow)]"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {!!item.badge && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/50 p-3">
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );
}