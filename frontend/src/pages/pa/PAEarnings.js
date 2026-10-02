import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { inr } from "@/lib/i18n";
import { useAuth } from "@/context/AuthContext";
import { Loader } from "@/components/States";
import { Wallet, TrendingUp, Star, CheckCircle2 } from "lucide-react";

export default function PAEarnings() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/pa/earnings").then((r) => setData(r.data)).catch(() => setData(null)); }, []);
  if (!data) return <Loader />;

  return (
    <div className="animate-slide-up">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-5 h-16 flex items-center">
        <h1 className="font-head text-xl font-bold text-slate-900">Earnings</h1>
      </header>
      <div className="px-5 pt-5 space-y-4">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white">
          <p className="text-orange-100 text-sm flex items-center gap-1"><Wallet className="h-4 w-4" /> Total earned</p>
          <p className="font-head text-3xl font-extrabold mt-1" data-testid="total-earned">{inr(data.total_earned)}</p>
          <div className="flex gap-6 mt-4">
            <div><p className="text-orange-100 text-xs">Paid out</p><p className="font-semibold">{inr(data.paid_out)}</p></div>
            <div><p className="text-orange-100 text-xs">Pending</p><p className="font-semibold">{inr(data.pending)}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat icon={CheckCircle2} label="Completed" value={data.completed_count} />
          <Stat icon={Star} label="Rating" value={data.rating || "—"} />
          <Stat icon={TrendingUp} label="Reviews" value={data.rating_count} />
        </div>

        <section>
          <h2 className="font-head font-bold text-slate-900 mb-2">Recent completed tasks</h2>
          {data.recent.length === 0 ? <p className="text-sm text-slate-400">No completed tasks yet.</p> : (
            <div className="space-y-2">
              {data.recent.map((t) => (
                <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                  <div><p className="text-sm font-medium text-slate-700">{t.title}</p><p className="text-xs text-slate-400">{t.task_code}</p></div>
                  <span className="text-sm font-semibold text-emerald-600">+{inr(t.fees?.service_fee)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {data.payouts?.length > 0 && (
          <section>
            <h2 className="font-head font-bold text-slate-900 mb-2">Payouts</h2>
            <div className="space-y-2">
              {data.payouts.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                  <p className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString("en-IN")}</p>
                  <span className="text-sm font-semibold text-slate-800">{inr(p.amount)} · {p.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
      <Icon className="h-5 w-5 text-orange-500 mx-auto" />
      <p className="font-head font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}
