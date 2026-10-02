import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { inr } from "@/lib/i18n";
import { Loader } from "@/components/States";
import {
  Users, BriefcaseBusiness, ShieldCheck, ClipboardList, Clock, Activity,
  CheckCircle2, XCircle, IndianRupee, Truck, RotateCcw, Star,
} from "lucide-react";

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/overview").then((r) => setD(r.data)).catch(() => setD(null)); }, []);
  if (!d) return <Loader />;

  const cards = [
    { label: "Customers", value: d.total_customers, icon: Users, color: "text-sky-600 bg-sky-50" },
    { label: "Registered PAs", value: d.total_pas, icon: BriefcaseBusiness, color: "text-indigo-600 bg-indigo-50" },
    { label: "Verified PAs", value: d.verified_pas, icon: ShieldCheck, color: "text-emerald-600 bg-emerald-50" },
    { label: "Active PAs", value: d.active_pas, icon: Activity, color: "text-orange-600 bg-orange-50" },
    { label: "Total bookings", value: d.total_bookings, icon: ClipboardList, color: "text-slate-600 bg-slate-100" },
    { label: "Pending bookings", value: d.pending_bookings, icon: Clock, color: "text-amber-600 bg-amber-50" },
    { label: "Active tasks", value: d.active_tasks, icon: Activity, color: "text-orange-600 bg-orange-50" },
    { label: "Completed", value: d.completed_tasks, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    { label: "Cancelled", value: d.cancelled_tasks, icon: XCircle, color: "text-red-600 bg-red-50" },
    { label: "Avg rating", value: d.avg_rating || "—", icon: Star, color: "text-amber-600 bg-amber-50" },
  ];
  const money = [
    { label: "Gross Merchandise Value", value: inr(d.gmv), icon: IndianRupee },
    { label: "Service fee revenue", value: inr(d.service_revenue), icon: IndianRupee },
    { label: "Delivery revenue", value: inr(d.delivery_revenue), icon: Truck },
    { label: "Refunds", value: inr(d.refunds), icon: RotateCcw },
  ];

  return (
    <div className="animate-slide-up">
      <h1 className="font-head text-2xl font-bold text-slate-900">Dashboard overview</h1>
      <p className="text-slate-500 text-sm mt-1">Real-time operations snapshot for IntownPA Hyderabad.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mt-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={`stat-${c.label.toLowerCase().replace(/\s/g, "-")}`}>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${c.color}`}><c.icon className="h-5 w-5" /></div>
            <p className="font-head text-2xl font-bold text-slate-900 mt-3">{c.value}</p>
            <p className="text-xs text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>

      <h2 className="font-head text-lg font-bold text-slate-900 mt-8">Revenue</h2>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-3">
        {money.map((m) => (
          <div key={m.label} className="bg-slate-900 text-white rounded-2xl p-5" data-testid={`money-${m.label.toLowerCase().replace(/\s/g, "-")}`}>
            <m.icon className="h-5 w-5 text-orange-400" />
            <p className="font-head text-2xl font-bold mt-3">{m.value}</p>
            <p className="text-xs text-slate-400">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
