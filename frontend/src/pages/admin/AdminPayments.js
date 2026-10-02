import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { inr } from "@/lib/i18n";
import { Loader, EmptyState } from "@/components/States";
import { CreditCard } from "lucide-react";

export default function AdminPayments() {
  const [rows, setRows] = useState(null);
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    api.get("/admin/payments").then((r) => setRows(r.data)).catch(() => setRows([]));
    api.get("/payments/config").then((r) => setCfg(r.data));
  }, []);
  if (!rows) return <Loader />;

  return (
    <div className="animate-slide-up">
      <h1 className="font-head text-2xl font-bold text-slate-900">Payments</h1>
      <p className="text-slate-500 text-sm">Transactions, statuses & reconciliation.</p>

      {cfg && (
        <div className={`mt-4 rounded-2xl border p-4 text-sm ${cfg.enabled ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`} data-testid="razorpay-status">
          <b>Razorpay: {cfg.enabled ? "Configured" : "Placeholder mode"}</b> — {cfg.message}
        </div>
      )}

      <div className="mt-5 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {rows.length === 0 ? <EmptyState icon={CreditCard} title="No transactions yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr>
                <th className="text-left px-4 py-3">Order ID</th><th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">For</th><th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Payment ID</th><th className="text-left px-4 py-3">Date</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id} data-testid={`payment-${p.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{p.order_id}{p.placeholder && <span className="ml-1 text-amber-500">(test)</span>}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{inr(p.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{p.pay_for}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.status === "paid" ? "bg-emerald-100 text-emerald-700" : p.status === "failed" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.payment_id || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.created_at).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
