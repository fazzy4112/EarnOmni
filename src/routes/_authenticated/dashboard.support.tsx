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
  HelpCircle, LifeBuoy, ChevronDown, Loader2, Send,
  Plus, ArrowLeft, CheckCircle2, Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/support")({
  component: SupportPage,
});

const FAQS: { q: string; a: string }[] = [
  {
    q: "Withdrawal kab process hoti hai?",
    a: "Withdrawal requests generally submit hone ke 24-48 hours ke andar review ho jaati hain. Status 'Withdraw' page par track kar sakte ho.",
  },
  {
    q: "Points aur Balance (USDT) mein kya farq hai?",
    a: "Points aap ads/tasks se kamate hain jo balance mein convert hote hain. 'Balance' aapki asal USDT earning hai, jabke 'Deposit Balance' woh amount hai jo aapne khud deposit kiya hai (jaise $1 Game khelne ke liye).",
  },
  {
    q: "Daily ads watch karne ki limit kyun hai?",
    a: "Har plan ka alag daily quota hai: Basic 10/day, Silver 20/day, Gold 40/day. Zyada ads dekhne aur zyada reward (2x-4x) ke liye plan upgrade karein.",
  },
  {
    q: "Referral commission kaise milta hai?",
    a: "Jab koi aapke referral link se sign up kare aur deposit/plan purchase kare, tabhi aapko commission milta hai. Ad-watching earnings par referral commission nahi milta.",
  },
  {
    q: "Offerwall mein offer complete kiya lekin reward nahi mila?",
    a: "Kai baar offer network (CPAlead) ka reward signal aane mein kuch minutes se lekar 24 hours tak lag sakte hain. Agar 24 hours baad bhi credit na ho, hamein ek ticket submit karein — hum manually check kar denge.",
  },
  {
    q: "Deposit kitni der mein confirm hoti hai?",
    a: "Deposit submit karne ke baad hum manually transaction hash verify karte hain — usually kuch hours lagte hain. Agar zyada der ho jaye to yahan ticket submit karein.",
  },
];

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SupportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [section, setSection] = useState<"faq" | "tickets">("faq");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["my_support_tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["ticket_messages", selectedTicket],
    enabled: !!selectedTicket,
    queryFn: async () => {
      const { data } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", selectedTicket!)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const createTicket = async () => {
    if (!user) return;
    if (!newSubject.trim() || !newMessage.trim()) {
      toast.error("Subject aur message dono zaroori hain!");
      return;
    }
    setSubmitting(true);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user.id, subject: newSubject.trim() })
      .select()
      .single();

    if (error || !ticket) {
      toast.error(error?.message ?? "Ticket create nahi ho saka");
      setSubmitting(false);
      return;
    }

    const { error: msgError } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      is_admin: false,
      message: newMessage.trim(),
    });

    if (msgError) {
      toast.error(msgError.message);
    } else {
      toast.success("✅ Ticket submit ho gaya! Hum jald reply karenge.");
      setNewSubject("");
      setNewMessage("");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["my_support_tickets"] });
      setSelectedTicket(ticket.id);
    }
    setSubmitting(false);
  };

  const sendReply = async () => {
    if (!user || !selectedTicket || !replyText.trim()) return;
    setSendingReply(true);
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: selectedTicket,
      sender_id: user.id,
      is_admin: false,
      message: replyText.trim(),
    });
    if (error) {
      toast.error(error.message);
    } else {
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["ticket_messages", selectedTicket] });
    }
    setSendingReply(false);
  };

  const activeTicket = tickets.find((t: any) => t.id === selectedTicket);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" /> Help &amp; Support
          </h2>
          <p className="text-sm text-muted-foreground">FAQs dekhein ya humein ek ticket bhejein</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { setSection("faq"); setSelectedTicket(null); }}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${section === "faq" ? "bg-primary text-white" : "bg-muted/30 text-muted-foreground"}`}
        >
          ❓ FAQ
        </button>
        <button
          onClick={() => setSection("tickets")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${section === "tickets" ? "bg-primary text-white" : "bg-muted/30 text-muted-foreground"}`}
        >
          🎫 My Tickets {tickets.length > 0 && `(${tickets.length})`}
        </button>
      </div>

      {section === "faq" && (
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <Card key={i} className="border-border/50 bg-card/80 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="font-medium text-sm flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary flex-shrink-0" /> {faq.q}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 text-sm text-muted-foreground pl-10">{faq.a}</div>
              )}
            </Card>
          ))}
          <Card className="border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground">Apna jawab nahi mila?</p>
            <Button className="mt-2" size="sm" onClick={() => { setSection("tickets"); setCreating(true); }}>
              Support Ticket Bhejein
            </Button>
          </Card>
        </div>
      )}

      {section === "tickets" && !selectedTicket && (
        <div className="space-y-4">
          {!creating ? (
            <Button onClick={() => setCreating(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white">
              <Plus className="h-4 w-4 mr-2" /> New Ticket
            </Button>
          ) : (
            <Card className="border-border/50 bg-card/80 p-5 space-y-3">
              <h3 className="font-semibold text-sm">Naya Support Ticket</h3>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Subject (e.g. Withdrawal not received)"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-24 resize-none"
                placeholder="Apna masla tafseel se likhein..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={createTicket} disabled={submitting} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</> : "Submit Ticket"}
                </Button>
                <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </Card>
          )}

          {ticketsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : tickets.length === 0 ? (
            <Card className="border-border/50 bg-card/50 p-12 text-center">
              <LifeBuoy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold">Koi ticket nahi hai</p>
              <p className="text-sm text-muted-foreground mt-1">Koi masla ho to "New Ticket" pe click karein</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {tickets.map((t: any) => (
                <Card
                  key={t.id}
                  className="border-border/50 bg-card/80 p-4 cursor-pointer hover:bg-card transition-colors"
                  onClick={() => setSelectedTicket(t.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{t.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(t.created_at)}</p>
                    </div>
                    {t.status === "resolved" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="h-3 w-3 mr-1" /> Resolved</Badge>
                    ) : (
                      <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="h-3 w-3 mr-1" /> Open</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {section === "tickets" && selectedTicket && (
        <div className="space-y-4">
          <button onClick={() => setSelectedTicket(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to tickets
          </button>

          <Card className="border-border/50 bg-card/80 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{activeTicket?.subject}</h3>
              {activeTicket?.status === "resolved" ? (
                <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="h-3 w-3 mr-1" /> Resolved</Badge>
              ) : (
                <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="h-3 w-3 mr-1" /> Open</Badge>
              )}
            </div>

            {messagesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {messages.map((m: any) => (
                  <div key={m.id} className={`flex ${m.is_admin ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.is_admin ? "bg-muted/40" : "bg-primary text-white"}`}>
                      <p className="text-xs font-medium mb-1 opacity-80">{m.is_admin ? "Support Team" : "You"}</p>
                      <p>{m.message}</p>
                      <p className="text-[10px] opacity-60 mt-1">{timeAgo(m.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTicket?.status !== "resolved" && (
              <div className="mt-4 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Reply likhein..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
                />
                <Button onClick={sendReply} disabled={sendingReply || !replyText.trim()}>
                  {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
