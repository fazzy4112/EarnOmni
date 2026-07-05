import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Wallet, Loader2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/deposit")({
  component: DepositPage,
});

function DepositPage() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["deposit_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("usdt_bep20_address, min_deposit")
        .eq("id", 1)
        .single();
      return data;
    },
  });

  const { data: myDeposits = [] } = useQuery({
    queryKey: ["my_deposits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("deposits")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      const minDep = Number(settings?.min_deposit ?? 5);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      if (amt < minDep) throw new Error(`Minimum deposit is $${minDep}`);
      if (!txHash.trim()) throw new Error("Enter your transaction hash (TxID)");
      const { error } = await supabase.from("deposits").insert({
        user_id: user!.id,
        amount_usd: amt,
        tx_hash: txHash.trim(),
        network: "USDT (BEP20)",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deposit submitted! We'll verify it and credit your balance soon.");
      setAmount("");
      setTxHash("");
      queryClient.invalidateQueries({ queryKey: ["my_deposits"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't submit deposit");
    },
  });

  const copyAddress = () => {
    if (!settings?.usdt_bep20_address) return;
    navigator.clipboard.writeText(settings.usdt_bep20_address);
    toast.success("Address copied!");
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </span>
    );
    if (status === "rejected") return (
      <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
        <XCircle className="h-3 w-3" /> Rejected
      </span>
    );
    return (
      <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-500">
        <Clock className="h-3 w-3" /> Pending review
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Deposit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deposit USDT to unlock features like the $1 Game. Your deposit balance is
          separate from your earnings — it's only used to pay for entries you choose to make.
        </p>
      </div>

      <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Current deposit balance</h2>
        </div>
        <p className="mt-2 text-3xl font-bold text-primary">
          ${Number(profile?.deposit_balance ?? 0).toFixed(2)}
        </p>
      </Card>

      <Card className="border-border/50 bg-card/50 p-6">
        <h2 className="text-lg font-semibold">Step 1 — Send USDT</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send at least ${Number(settings?.min_deposit ?? 5)} in USDT (BEP20) to the address below.
          Double-check the network before sending — sending on the wrong network can result in lost funds.
        </p>
        {settings?.usdt_bep20_address ? (
          <div className="mt-4 flex gap-2">
            <div className="flex-1 truncate rounded-lg border border-border bg-input px-4 py-3 font-mono text-sm">
              {settings.usdt_bep20_address}
            </div>
            <Button onClick={copyAddress} variant="outline" size="lg">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-yellow-500">
            Deposits aren't available yet — check back soon.
          </p>
        )}

        <h2 className="mt-8 text-lg font-semibold">Step 2 — Submit your transaction</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          After sending, paste your transaction hash (TxID) below. We'll verify it and
          credit your deposit balance — usually within a few hours.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Amount sent (USD)</Label>
            <Input
              type="number"
              min={1}
              step="0.01"
              placeholder="e.g. 5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>Transaction hash (TxID)</Label>
            <Input
              placeholder="Paste your transaction hash"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || !settings?.usdt_bep20_address}
          className="mt-4 bg-[image:var(--gradient-hero)]"
        >
          {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit for verification
        </Button>
      </Card>

      <Card className="border-border/50 bg-card/50 p-6">
        <h2 className="text-lg font-semibold">Your deposit history</h2>
        <div className="mt-4 space-y-2">
          {myDeposits.length === 0 && (
            <p className="text-sm text-muted-foreground">No deposits yet.</p>
          )}
          {myDeposits.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">${Number(d.amount_usd).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground truncate max-w-xs">Tx: {d.tx_hash}</p>
              </div>
              {statusBadge(d.status)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
