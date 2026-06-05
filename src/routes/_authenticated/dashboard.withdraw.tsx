import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/withdraw")({
  component: WithdrawPage,
});

function WithdrawPage() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("USDT-TRC20");
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);

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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return toast.error("Enter a valid amount");
    if (amt < 5) return toast.error("Minimum withdrawal is $5");
    if (amt > Number(profile?.balance ?? 0)) return toast.error("Insufficient balance");
    setLoading(true);
    const { error } = await supabase.from("withdrawals").insert({
      user_id: user.id,
      amount: amt,
      payment_method: method,
      wallet_address: wallet,
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    await supabase.from("profiles").update({ balance: Number(profile?.balance ?? 0) - amt }).eq("id", user.id);
    toast.success("Withdrawal request submitted!");
    setAmount("");
    setWallet("");
    setLoading(false);
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["withdrawals"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-border/50 bg-[image:var(--gradient-card)] p-6">
        <h3 className="text-lg font-semibold">Request withdrawal</h3>
        <p className="text-sm text-muted-foreground">Available: <span className="text-primary font-semibold">${(profile?.balance ?? 0).toFixed(2)}</span></p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="amt">Amount (USD)</Label>
            <Input id="amt" type="number" step="0.01" min="5" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <Label>Payment method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USDT-TRC20">USDT (TRC20)</SelectItem>
                <SelectItem value="USDT-BEP20">USDT (BEP20)</SelectItem>
                <SelectItem value="USDT-ERC20">USDT (ERC20)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="w">Wallet address</Label>
            <Input id="w" value={wallet} onChange={(e) => setWallet(e.target.value)} required placeholder="0x... or T..." />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[image:var(--gradient-hero)]">
            {loading ? "Submitting..." : "Request withdrawal"}
          </Button>
        </form>
      </Card>

      <Card className="border-border/50 bg-card/50 p-6">
        <h3 className="text-lg font-semibold">History</h3>
        <div className="mt-4 space-y-3">
          {withdrawals.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3">
              <div>
                <p className="font-medium">${Number(w.amount).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{w.payment_method} · {new Date(w.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                w.status === "approved" ? "bg-emerald-500/20 text-emerald-300" :
                w.status === "rejected" ? "bg-red-500/20 text-red-300" :
                "bg-yellow-500/20 text-yellow-300"
              }`}>{w.status}</span>
            </div>
          ))}
          {withdrawals.length === 0 && <p className="text-sm text-muted-foreground">No withdrawals yet.</p>}
        </div>
      </Card>
    </div>
  );
}