import React, { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { inr } from "@/lib/i18n";
import StatusBadge from "@/components/StatusBadge";
import { Loader, EmptyState } from "@/components/States";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { ClipboardList, UserPlus, Download, RotateCcw } from "lucide-react";

export default function AdminTasks() {
  const [tasks, setTasks] = useState(null);
  const [cats, setCats] = useState([]);
  const [pas, setPAs] = useState([]);
  const [filter, setFilter] = useState({ status: "", category_id: "" });
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (filter.status) q.set("status", filter.status);
    if (filter.category_id) q.set("category_id", filter.category_id);
    api.get(`/admin/tasks?${q}`).then((r) => setTasks(r.data)).catch(() => setTasks([]));
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/admin/categories").then((r) => setCats(r.data));
    api.get("/admin/pas?status=verified").then((r) => setPAs(r.data));
  }, []);

  const openDetail = async (id) => { const { data } = await api.get(`/tasks/${id}`); setDetail(data); };
  const assign = async (taskId, paId) => {
    try { await api.post(`/admin/tasks/${taskId}/assign`, { pa_id: paId }); toast.success("PA assigned"); setDetail(null); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const refund = async (taskId, amount) => {
    const a = window.prompt("Refund amount (₹):", amount); if (a == null) return;
    try { await api.post("/admin/refunds", { task_id: taskId, amount: Number(a), reason: "Admin refund" }); toast.success("Refund processed"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const exportCsv = async () => {
    try {
      const res = await api.get("/admin/reports/tasks.csv", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "intownpa_tasks.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Export failed"); }
  };

  if (!tasks) return <Loader />;

  const STATUSES = ["awaiting_assignment", "pa_assigned", "awaiting_approval", "purchase_approved", "purchase_completed", "out_for_delivery", "delivered", "completed", "cancelled", "refunded"];

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-head text-2xl font-bold text-slate-900">Tasks</h1><p className="text-slate-500 text-sm">Assign, monitor & manage all bookings.</p></div>
        <button onClick={exportCsv} data-testid="export-csv" className="flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold"><Download className="h-4 w-4" /> Export CSV</button>
      </div>

      <div className="flex gap-3 mt-5 flex-wrap">
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} data-testid="filter-status" className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white">
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.category_id} onChange={(e) => setFilter({ ...filter, category_id: e.target.value })} data-testid="filter-category" className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white">
          <option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {tasks.length === 0 ? <EmptyState icon={ClipboardList} title="No tasks" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr>
                <th className="text-left px-4 py-3">Task</th><th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">PA</th><th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => (
                  <tr key={t.id} data-testid={`admin-task-${t.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><p className="font-semibold text-slate-800">{t.title}</p><p className="text-xs text-slate-400">{t.task_code} · {t.category_name}</p></td>
                    <td className="px-4 py-3 text-slate-600">{t.customer_name}</td>
                    <td className="px-4 py-3 text-slate-600">{t.pa_name || <span className="text-amber-600">Unassigned</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{inr(t.approved_amount || t.fees?.grand_total)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openDetail(t.id)} data-testid={`assign-btn-${t.id}`} className="text-orange-600 font-semibold text-xs mr-3">{t.pa_name ? "Reassign" : "Assign PA"}</button>
                      {["purchase_completed", "delivered", "completed", "cancellation_requested"].includes(t.status) && (
                        <button onClick={() => refund(t.id, t.approved_amount || 0)} data-testid={`refund-btn-${t.id}`} className="text-slate-500 font-semibold text-xs">Refund</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Assign a verified PA</DialogTitle></DialogHeader>
          {detail && (
            <>
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-semibold">{detail.task.title}</p>
                <p className="text-xs text-slate-500">{detail.task.task_code} · {detail.task.preferred_location || "—"}</p>
              </div>
              <div className="space-y-2 mt-2">
                {pas.length === 0 ? <p className="text-sm text-slate-400">No verified PAs available.</p> : pas.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <div><p className="text-sm font-semibold text-slate-800">{p.name}</p><p className="text-xs text-slate-400">{p.service_area} · ⭐ {p.rating || "New"} · {p.online ? "Online" : "Offline"}</p></div>
                    <button onClick={() => assign(detail.task.id, p.id)} data-testid={`assign-pa-${p.id}`} className="bg-orange-500 text-white rounded-full px-4 py-2 text-xs font-semibold">Assign</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
