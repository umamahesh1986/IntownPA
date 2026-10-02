import React, { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { Loader, EmptyState } from "@/components/States";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BriefcaseBusiness, ShieldCheck, Star } from "lucide-react";

const TABS = [["", "All"], ["pending", "Pending"], ["verified", "Verified"], ["rejected", "Rejected"]];

export default function AdminPAs() {
  const [pas, setPAs] = useState(null);
  const [tab, setTab] = useState("pending");
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => {
    const q = tab ? `?status=${tab}` : "";
    api.get(`/admin/pas${q}`).then((r) => setPAs(r.data)).catch(() => setPAs([]));
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const action = async (id, act, area) => {
    try { await api.post(`/admin/pas/${id}/verify`, { action: act, service_area: area }); toast.success(`PA ${act}ed`); setDetail(null); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const openDetail = async (id) => { const { data } = await api.get(`/admin/pas/${id}`); setDetail(data); };

  if (!pas) return <Loader />;

  return (
    <div className="animate-slide-up">
      <h1 className="font-head text-2xl font-bold text-slate-900">Personal Assistants</h1>
      <p className="text-slate-500 text-sm">Review applications, verify documents & manage PAs.</p>

      <div className="flex gap-2 mt-5">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`pa-filter-${k || "all"}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tab === k ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>{l}</button>
        ))}
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {pas.length === 0 ? <EmptyState icon={BriefcaseBusiness} title="No PAs here" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr>
                <th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Mobile</th>
                <th className="text-left px-4 py-3">Service area</th><th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Rating</th><th className="text-right px-4 py-3">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {pas.map((p) => (
                  <tr key={p.id} data-testid={`admin-pa-${p.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">+91 {p.mobile}</td>
                    <td className="px-4 py-3 text-slate-600">{p.service_area || "—"}</td>
                    <td className="px-4 py-3"><StatusPill s={p.verification_status} /></td>
                    <td className="px-4 py-3 text-slate-600">{p.rating ? `⭐ ${p.rating}` : "New"}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => openDetail(p.id)} data-testid={`review-pa-${p.id}`} className="text-orange-600 font-semibold text-xs">Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>PA application review</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-bold overflow-hidden">
                  {detail.photo ? <img src={detail.photo} alt="" className="h-full w-full object-cover" /> : (detail.name || "P").charAt(0)}
                </div>
                <div><p className="font-semibold text-slate-900">{detail.name}</p><p className="text-xs text-slate-400">+91 {detail.mobile}</p></div>
              </div>
              <Row l="Service area" v={detail.service_area} />
              <Row l="Address" v={detail.address} />
              <Row l="ID number" v={detail.documents?.id_number} />
              <Row l="Bank" v={`${detail.bank?.account || "—"} / ${detail.bank?.ifsc || "—"}`} />
              <Row l="Emergency contact" v={detail.emergency_contact} />
              {detail.documents?.id_document && <img src={detail.documents.id_document} alt="ID" className="rounded-xl max-h-48" />}
              <p className="text-xs text-slate-400">Completed tasks: {detail.tasks?.length || 0} · Reviews: {detail.reviews?.length || 0}</p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={() => action(detail.id, "verify", detail.service_area)} data-testid="verify-pa" className="bg-emerald-500 text-white rounded-full py-2.5 text-sm font-semibold flex items-center justify-center gap-1"><ShieldCheck className="h-4 w-4" /> Verify</button>
                <button onClick={() => action(detail.id, "reject")} data-testid="reject-pa" className="bg-red-50 text-red-600 rounded-full py-2.5 text-sm font-semibold">Reject</button>
                {detail.verification_status === "verified" && <button onClick={() => action(detail.id, "suspend")} className="col-span-2 bg-slate-100 text-slate-600 rounded-full py-2.5 text-sm font-semibold">Suspend</button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ s }) {
  const c = { verified: "bg-emerald-100 text-emerald-700", pending: "bg-amber-100 text-amber-700", rejected: "bg-red-100 text-red-700", unregistered: "bg-slate-100 text-slate-500" }[s] || "bg-slate-100 text-slate-500";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c}`}>{s}</span>;
}
function Row({ l, v }) { return <div className="flex justify-between text-sm"><span className="text-slate-500">{l}</span><span className="text-slate-800 font-medium text-right">{v || "—"}</span></div>; }
