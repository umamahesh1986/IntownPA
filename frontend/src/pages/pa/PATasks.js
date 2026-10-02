import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { inr } from "@/lib/i18n";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import StatusBadge from "@/components/StatusBadge";
import { Loader, EmptyState } from "@/components/States";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ClipboardList, MapPin, Clock, ShieldAlert } from "lucide-react";

export default function PATasks() {
  const nav = useNavigate();
  const { user, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [online, setOnline] = useState(user?.online || false);

  const load = useCallback(() => {
    api.get("/pa/tasks").then((r) => setData(r.data)).catch(() => setData({ offered: [], active: [], completed: [] }));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const verified = user?.verification_status === "verified";

  const toggleOnline = async (v) => {
    try { await api.put("/pa/availability", { online: v }); setOnline(v); updateUser({ ...user, online: v }); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const accept = async (id) => { try { await api.post(`/pa/tasks/${id}/accept`); toast.success("Task accepted"); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };
  const reject = async (id) => { try { await api.post(`/pa/tasks/${id}/reject`); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };

  if (!data) return <Loader />;

  return (
    <div className="animate-slide-up">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-5 h-16 flex items-center justify-between">
        <div><p className="text-xs text-slate-400">Personal Assistant</p><Logo size="sm" /></div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2"><span className={`text-xs font-semibold ${online ? "text-emerald-600" : "text-slate-400"}`}>{online ? "Online" : "Offline"}</span>
            <Switch checked={online} onCheckedChange={toggleOnline} disabled={!verified} data-testid="availability-toggle" /></div>
          <NotificationBell />
        </div>
      </header>

      <div className="px-5 pt-5 space-y-5">
        {!verified && (
          <button onClick={() => nav("/pa/profile")} className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-left" data-testid="verify-banner">
            <ShieldAlert className="h-6 w-6 text-amber-600" />
            <div><p className="font-semibold text-amber-800 text-sm">{user?.verification_status === "pending" ? "Verification pending" : "Complete your profile"}</p>
              <p className="text-xs text-amber-700">{user?.verification_status === "pending" ? "Admin will review your application soon." : "Submit your details to start accepting tasks."}</p></div>
          </button>
        )}

        {/* Offered */}
        {data.offered.length > 0 && (
          <section>
            <h2 className="font-head font-bold text-slate-900 mb-3">New task requests</h2>
            <div className="space-y-3">
              {data.offered.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl border border-orange-200 p-4" data-testid={`offered-task-${t.id}`}>
                  <p className="font-semibold text-slate-900 text-sm">{t.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.task_code} · {t.category_name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                    {t.preferred_location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t.preferred_location}</span>}
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">Earn {inr(t.fees?.service_fee)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button onClick={() => accept(t.id)} data-testid={`accept-${t.id}`} className="bg-orange-500 hover:bg-orange-600 text-white rounded-full py-2.5 text-sm font-semibold transition-colors">Accept</button>
                    <button onClick={() => reject(t.id)} data-testid={`decline-${t.id}`} className="bg-slate-100 text-slate-600 rounded-full py-2.5 text-sm font-semibold">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active */}
        <section>
          <h2 className="font-head font-bold text-slate-900 mb-3">Active tasks</h2>
          {data.active.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No active tasks" subtitle={verified ? "Go online to receive new task requests." : "Get verified to start."} />
          ) : (
            <div className="space-y-3">
              {data.active.map((t) => (
                <button key={t.id} onClick={() => nav(`/pa/tasks/${t.id}`)} data-testid={`active-task-${t.id}`}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between"><p className="font-semibold text-slate-900 text-sm">{t.title}</p><StatusBadge status={t.status} /></div>
                  <p className="text-xs text-slate-400 mt-0.5">{t.task_code} · {t.category_name}</p>
                  {t.status === "purchase_approved" && <p className="text-xs text-emerald-600 font-semibold mt-2">✓ Purchase authorized — proceed to buy</p>}
                  {t.status === "awaiting_approval" && <p className="text-xs text-amber-600 font-semibold mt-2">Awaiting customer approval</p>}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Completed */}
        {data.completed.length > 0 && (
          <section>
            <h2 className="font-head font-bold text-slate-900 mb-3">Completed</h2>
            <div className="space-y-2">
              {data.completed.map((t) => (
                <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                  <div><p className="text-sm font-medium text-slate-700">{t.title}</p><p className="text-xs text-slate-400">{t.task_code}</p></div>
                  <span className="text-xs text-emerald-600 font-semibold">{inr(t.fees?.service_fee)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
