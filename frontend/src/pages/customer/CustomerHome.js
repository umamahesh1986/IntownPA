import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { inr } from "@/lib/i18n";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import StatusBadge from "@/components/StatusBadge";
import { Loader } from "@/components/States";
import * as Icons from "lucide-react";
import { Search, ArrowRight, Headphones, Gift, Sparkles } from "lucide-react";

export default function CustomerHome() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/customer/home").then((r) => setData(r.data)).catch(() => setData({ categories: [], active_tasks: [], recent_tasks: [], banners: [] }));
  }, []);

  if (!data) return <Loader />;

  const CatIcon = (name) => Icons[name] || Icons.ShoppingBag;

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-5 h-16 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">Hyderabad</p>
          <Logo size="sm" />
        </div>
        <NotificationBell />
      </header>

      <div className="px-5 pt-5 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="font-head text-2xl font-bold text-slate-900">
            Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-slate-500 text-sm">What do you need from the market today?</p>
        </div>

        {/* Search */}
        <button onClick={() => nav("/app/book")} data-testid="home-search"
          className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-400 hover:border-orange-300 transition-colors">
          <Search className="h-5 w-5" /> <span className="text-sm">What do you need help with?</span>
        </button>

        {/* Book CTA */}
        <button onClick={() => nav("/app/book")} data-testid="book-pa-button"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl p-5 flex items-center justify-between transition-colors active:scale-[0.98] shadow-sm shadow-orange-200">
          <div className="text-left">
            <p className="font-head font-bold text-lg">Book a Personal Assistant</p>
            <p className="text-orange-100 text-sm">Show Me Before You Buy</p>
          </div>
          <ArrowRight className="h-6 w-6" />
        </button>

        {/* Active tasks */}
        {data.active_tasks?.length > 0 && (
          <section>
            <h2 className="font-head font-bold text-slate-900 mb-3">Active tasks</h2>
            <div className="space-y-3">
              {data.active_tasks.map((t) => (
                <button key={t.id} onClick={() => nav(`/app/tasks/${t.id}`)} data-testid={`active-task-${t.id}`}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900 text-sm">{t.title}</p>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{t.task_code} · {t.category_name}</p>
                  {t.status === "awaiting_approval" && (
                    <p className="text-xs text-amber-600 font-semibold mt-2">Tap to review & approve products</p>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <section>
          <h2 className="font-head font-bold text-slate-900 mb-3">Service categories</h2>
          <div className="grid grid-cols-4 gap-3">
            {data.categories.map((c) => {
              const Ic = CatIcon(c.icon);
              return (
                <button key={c.id} onClick={() => nav(`/app/book?category=${c.id}`)} data-testid={`category-${c.id}`}
                  className="flex flex-col items-center gap-1.5 group">
                  <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center group-hover:border-orange-300 group-hover:bg-orange-50 transition-colors">
                    <Ic className="h-6 w-6 text-orange-500" />
                  </div>
                  <span className="text-[10px] text-slate-600 text-center leading-tight font-medium">{c.name.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Promo + referral */}
        <section className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2"><Gift className="h-5 w-5" /><p className="font-head font-bold">₹50 off your first task</p></div>
          <p className="text-orange-100 text-sm mt-1">Use code <span className="font-bold bg-white/20 px-2 py-0.5 rounded">WELCOME50</span> at checkout.</p>
          <p className="text-orange-100 text-xs mt-3 flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Refer friends & earn rewards (coming soon)</p>
        </section>

        {/* Recent */}
        {data.recent_tasks?.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-head font-bold text-slate-900">Recent requests</h2>
              <button onClick={() => nav("/app/tasks")} className="text-xs text-orange-500 font-semibold">View all</button>
            </div>
            <div className="space-y-2">
              {data.recent_tasks.map((t) => (
                <button key={t.id} onClick={() => nav(`/app/tasks/${t.id}`)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                  <div><p className="text-sm font-medium text-slate-800">{t.title}</p><p className="text-xs text-slate-400">{inr(t.fees?.grand_total)}</p></div>
                  <StatusBadge status={t.status} />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Support */}
        <button onClick={() => nav("/app/profile")} data-testid="home-support"
          className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-600 text-sm">
          <Headphones className="h-5 w-5 text-orange-500" /> Need help? Contact IntownPA support
        </button>
      </div>
    </div>
  );
}
