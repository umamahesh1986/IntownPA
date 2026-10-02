import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { inr } from "@/lib/i18n";
import StatusBadge from "@/components/StatusBadge";
import { Loader, EmptyState } from "@/components/States";
import { ClipboardList } from "lucide-react";

const TABS = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "draft", label: "Drafts" },
];

export default function MyTasks() {
  const nav = useNavigate();
  const [tasks, setTasks] = useState(null);
  const [tab, setTab] = useState("active");

  useEffect(() => {
    api.get("/customer/tasks").then((r) => setTasks(r.data)).catch(() => setTasks([]));
  }, []);

  if (!tasks) return <Loader />;

  const filtered = tasks.filter((t) => {
    if (tab === "draft") return t.status === "draft";
    if (tab === "completed") return ["completed", "cancelled", "refunded", "failed"].includes(t.status);
    return !["completed", "cancelled", "refunded", "failed", "draft"].includes(t.status);
  });

  return (
    <div className="animate-slide-up">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-5 h-16 flex items-center">
        <h1 className="font-head text-xl font-bold text-slate-900">My Tasks</h1>
      </header>

      <div className="px-5 pt-4">
        <div className="flex gap-2 bg-slate-100 rounded-full p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} data-testid={`tasks-tab-${t.key}`}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${tab === t.key ? "bg-white text-orange-600 shadow-sm" : "text-slate-500"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nothing here yet"
              subtitle={tab === "draft" ? "Your saved drafts will appear here." : "Book a Personal Assistant to get started."}
              action={<button onClick={() => nav("/app/book")} className="mt-4 bg-orange-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold">Book a PA</button>} />
          ) : (
            filtered.map((t) => (
              <button key={t.id} onClick={() => nav(t.status === "draft" ? `/app/book?draft=${t.id}` : `/app/tasks/${t.id}`)}
                data-testid={`task-item-${t.id}`}
                className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900 text-sm">{t.title}</p>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{t.task_code} · {t.category_name}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-500">Est. total {inr(t.fees?.grand_total)}</p>
                  <p className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString("en-IN")}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
