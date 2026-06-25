import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, AlertCircle, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/withdraw")({
  component: WithdrawPage,
});

function WithdrawPage() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("id", 1)
        .single();
      return data;
    },
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const minWithdrawal = settings?.min_withdrawal ?? 10;

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied!");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return toast.error("Enter a valid amount");
    if (amt < minWithdrawal) return toast.error(`Minimum withdrawal is $${minWithdrawal}`);
    if (amt > Number(profile?.balance ?? 0)) return toast.error("Insufficient balance");
    if (!wallet || wallet.length < 10) return toast.error("Enter a valid BEP20 wallet address");
    if (!wallet.startsWith("0x")) return toast.error("BEP20 address must start with 0x");

    setLoading(true);
    const { error } = await supabase.from("withdrawals").insert({
      user_id: user.id,
      amount: amt,
      payment_method: "USDT-BEP20",
      wallet_address: wallet,
    });
    if (error) { toast.error(error.message); setLoading(false); return; }

    await supabase.from("profiles")
      .update({ balance: Number(profile?.balance ?? 0) - amt })
      .eq("id", user.id);

    toast.success("✅ Withdrawal request submitted! Processing within 24-48 hours.");
    setAmount("");
    setWallet("");
    setLoading(false);
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["withdrawals"] });
  };

  return (
    <div className="space-y-6">

      {/* Balance Card */}
      <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-3xl font-bold text-primary">
              ${(profile?.balance ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
            <Wallet className="h-7 w-7 text-primary" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          Minimum withdrawal: ${minWithdrawal} USDT
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Withdrawal Form */}
        <Card className="border-border/50 bg-card/80 p-6">
          <h3 className="text-lg font-semibold mb-1">Request Withdrawal</h3>
          <p className="text-xs text-muted-foreground mb-5">
            Processed within 24-48 hours
          </p>

          {/* Network Info */}
          <div className="mb-5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
            <div className="flex items-center gap-2 text-yellow-400 text-sm font-semibold mb-1">
              ⚠️ Important — Network
            </div>
            <p className="text-xs text-yellow-300">
              We only support <strong>USDT BEP20 (BSC)</strong> network.
              Sending on wrong network will result in permanent loss of funds!
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="amt">Amount (USD)</Label>
              <Input
                id="amt"
                type="number"
                step="0.01"
                min={minWithdrawal}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min $${minWithdrawal}`}
                required
              />
            </div>

            <div>
              <Label>Payment Method</Label>
              <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-xs">
                  BSC
                </div>
                <div>
                  <p className="text-sm font-semibold">USDT BEP20</p>
                  <p className="text-xs text-muted-foreground">BNB Smart Chain • Low fees</p>
                </div>
                <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                  Selected
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="w">Your BEP20 Wallet Address</Label>
              <Input
                id="w"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0x..."
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must start with 0x — BNB Smart Chain address
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || Number(profile?.balance ?? 0) < minWithdrawal}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {loading ? "Submitting..." : "Request Withdrawal"}
            </Button>

            {Number(profile?.balance ?? 0) < minWithdrawal && (
              <p className="text-xs text-center text-muted-foreground">
                You need ${minWithdrawal - Number(profile?.balance ?? 0).toFixed(2)} more to withdraw
              </p>
            )}
          </form>
        </Card>

        {/* History */}
        <Card className="border-border/50 bg-card/50 p-6">
          <h3 className="text-lg font-semibold mb-4">Withdrawal History</h3>
          <div className="space-y-3">
            {withdrawals.map((w) => (
              <div key={w.id}
                className="rounded-lg border border-border/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-emerald-400">
                      ${Number(w.amount).toFixed(2)} USDT
                    </p>
                    <p className="text-xs text-muted-foreground">
                      BEP20 · {new Date(w.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    w.status === "approved"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : w.status === "rejected"
                      ? "bg-red-500/20 text-red-300"
                      : "bg-yellow-500/20 text-yellow-300"
                  }`}>
                    {w.status === "approved" ? "✅ Approved" :
                     w.status === "rejected" ? "❌ Rejected" : "⏳ Pending"}
                  </span>
                </div>
                {/* Wallet address with copy */}
                <div className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1">
                  <p className="text-xs text-muted-foreground font-mono truncate flex-1">
                    {w.wallet_address}
                  </p>
                  <button
                    onClick={() => copyAddress(w.wallet_address)}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {withdrawals.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No withdrawals yet
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}