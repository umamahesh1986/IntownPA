import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { Loader, EmptyState } from "@/components/States";
import { MessageCircle } from "lucide-react";

export default function CustomerChatList() {
  const nav = useNavigate();
  const [tasks, setTasks] = useState(null);

  useEffect(() => {
    api.get("/customer/tasks").then((r) => setTasks(r.data.filter((t) => t.pa_id && t.status !== "draft"))).catch(() => setTasks([]));
  }, []);

  if (!tasks) return <Loader />;

  return (
    <div className="animate-slide-up">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-5 h-16 flex items-center">
        <h1 className="font-head text-xl font-bold text-slate-900">Chat</h1>
      </header>
      <div className="px-5 pt-4 space-y-3">
        {tasks.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No conversations yet"
            subtitle="Once a PA is assigned to your task, you can chat with them here." />
        ) : (
          tasks.map((t) => (
            <button key={t.id} onClick={() => nav(`/app/tasks/${t.id}?tab=chat`)} data-testid={`chat-task-${t.id}`}
              className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className="h-11 w-11 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                {(t.pa_name || "PA").charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">{t.pa_name || "PA"}</p>
                <p className="text-xs text-slate-400">{t.title}</p>
              </div>
              <StatusBadge status={t.status} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
