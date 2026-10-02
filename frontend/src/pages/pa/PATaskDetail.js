import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { inr } from "@/lib/i18n";
import StatusBadge from "@/components/StatusBadge";
import StatusTimeline from "@/components/StatusTimeline";
import ChatPanel from "@/components/ChatPanel";
import ImageUpload from "@/components/ImageUpload";
import { Loader } from "@/components/States";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Navigation, Camera, Plus, CheckCircle2, Lock, Receipt, Truck,
  PackageX, ShieldCheck, Store,
} from "lucide-react";

const NEXT = {
  pa_assigned: { to: "pa_travelling", label: "Start travelling" },
  pa_travelling: { to: "pa_arrived", label: "Mark arrived" },
  pa_arrived: { to: "searching", label: "Start searching" },
};

export default function PATaskDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("work");
  const [optOpen, setOptOpen] = useState(false);
  const [rcptOpen, setRcptOpen] = useState(false);
  const [podOpen, setPodOpen] = useState(false);
  const [opt, setOpt] = useState({ name: "", price: "", brand: "", description: "", specifications: "", variants: "", shop_name: "", shop_location: "", quantity_available: 1, in_stock: true, photos: [], videos: [] });
  const [rcpt, setRcpt] = useState({ actual_amount: "", shop_name: "", receipt_image: "", note: "" });
  const [pod, setPod] = useState({ proof_image: "", note: "" });

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/tasks/${id}`); setData(data); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); nav("/pa"); }
  }, [id, nav]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  if (!data) return <div className="min-h-screen bg-slate-50"><Loader /></div>;
  const { task, options, timeline, pa } = data;
  const approved = options.find((o) => o.approval_status === "approved");
  const authorized = task.status === "purchase_approved" || (approved && !task.actual_purchase_amount);

  const act = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };
  const setStatus = (status) => act(() => api.post(`/pa/tasks/${id}/status`, { status }), "Status updated");

  const addOption = () => {
    if (!opt.name || !opt.price) return toast.error("Enter product name & price");
    act(() => api.post(`/pa/tasks/${id}/product-options`, { ...opt, price: Number(opt.price), quantity_available: Number(opt.quantity_available) }), "Option sent to customer")
      .then(() => { setOptOpen(false); setOpt({ name: "", price: "", brand: "", description: "", specifications: "", variants: "", shop_name: "", shop_location: "", quantity_available: 1, in_stock: true, photos: [], videos: [] }); });
  };
  const uploadReceipt = () => {
    if (!rcpt.actual_amount) return toast.error("Enter actual amount");
    act(() => api.post(`/pa/tasks/${id}/receipt`, { ...rcpt, actual_amount: Number(rcpt.actual_amount) }), "Receipt uploaded")
      .then(() => setRcptOpen(false));
  };
  const uploadPod = () => {
    act(() => api.post(`/pa/tasks/${id}/proof-of-delivery`, pod), "Delivery proof captured").then(() => setPodOpen(false));
  };
  const markUnavailable = () => { const note = window.prompt("Describe why the item is unavailable:"); if (note != null) act(() => api.post(`/pa/tasks/${id}/unavailable?note=${encodeURIComponent(note)}`), "Reported to customer"); };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.preferred_location || task.delivery_address || "Hyderabad")}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-28 animate-slide-up">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 h-16 flex items-center gap-3">
        <button onClick={() => nav("/pa")} data-testid="pa-task-back"><ArrowLeft className="h-5 w-5 text-slate-600" /></button>
        <div className="flex-1"><p className="font-head font-bold text-slate-900 text-sm leading-tight">{task.title}</p><p className="text-xs text-slate-400">{task.task_code}</p></div>
        <StatusBadge status={task.status} />
      </header>

      <div className="flex gap-2 bg-white border-b border-slate-100 px-4">
        {[["work", "Work"], ["chat", "Chat"], ["timeline", "Timeline"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`pa-tab-${k}`}
            className={`py-3 text-sm font-semibold border-b-2 transition-colors flex-1 ${tab === k ? "border-orange-500 text-orange-600" : "border-transparent text-slate-400"}`}>{l}</button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">
        {tab === "work" && (
          <>
            {/* Purchase authorization banner */}
            <div className={`rounded-2xl p-4 flex items-center gap-3 ${authorized ? "bg-emerald-50 border border-emerald-200" : "bg-slate-100 border border-slate-200"}`} data-testid="purchase-auth-banner">
              {authorized ? <ShieldCheck className="h-6 w-6 text-emerald-600" /> : <Lock className="h-6 w-6 text-slate-400" />}
              <div>
                <p className={`font-semibold text-sm ${authorized ? "text-emerald-800" : "text-slate-600"}`}>{authorized ? "Purchase authorized" : "Purchase NOT authorized"}</p>
                <p className={`text-xs ${authorized ? "text-emerald-700" : "text-slate-500"}`}>
                  {authorized ? `Customer approved ${approved?.name} × ${approved?.approved_quantity} = ${inr(approved?.approved_amount)}. You may buy.` : "Do not purchase until the customer approves a product, quantity & amount."}
                </p>
              </div>
            </div>

            {/* Customer instructions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
              <p className="font-head font-bold text-slate-900 text-sm">Customer request</p>
              {task.description && <Info l="Details" v={task.description} />}
              <Info l="Product" v={`${task.product_spec?.name || task.title} ${task.product_spec?.brand ? "· " + task.product_spec.brand : ""}`} />
              {task.product_spec?.size && <Info l="Size" v={task.product_spec.size} />}
              {task.product_spec?.color && <Info l="Color" v={task.product_spec.color} />}
              <Info l="Quantity" v={task.product_spec?.quantity || 1} />
              <Info l="Budget" v={inr(task.product_budget)} />
              {task.preferred_location && <Info l="Location" v={task.preferred_location} />}
              {task.instructions && <Info l="Instructions" v={task.instructions} />}
              {task.reference_photos?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">{task.reference_photos.map((p, i) => <img key={i} src={p} alt="ref" className="h-16 w-16 rounded-lg object-cover" />)}</div>
              )}
              <a href={mapsUrl} target="_blank" rel="noreferrer" data-testid="open-maps" className="mt-2 inline-flex items-center gap-2 rounded-full bg-sky-50 text-sky-700 px-4 py-2 text-sm font-semibold"><Navigation className="h-4 w-4" /> Open in Maps</a>
            </div>

            {/* Status progression */}
            {NEXT[task.status] && task.pa_accepted && (
              <button onClick={() => setStatus(NEXT[task.status].to)} data-testid="advance-status"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-full py-3 text-sm font-semibold transition-colors">{NEXT[task.status].label}</button>
            )}

            {/* Product options management */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-head font-bold text-slate-900 text-sm">Product options ({options.length})</p>
                <Dialog open={optOpen} onOpenChange={setOptOpen}>
                  <DialogTrigger asChild>
                    <button className="text-orange-500 text-sm font-semibold flex items-center gap-1" data-testid="add-option-btn"><Plus className="h-4 w-4" /> Add</button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Show Me Before You Buy</DialogTitle></DialogHeader>
                    <div className="space-y-2">
                      <ImageUpload images={opt.photos} onChange={(p) => setOpt({ ...opt, photos: p })} label="Photo" testid="opt-photos" />
                      <input placeholder="Product name *" value={opt.name} onChange={(e) => setOpt({ ...opt, name: e.target.value })} data-testid="opt-name" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                      <input placeholder="Actual selling price (₹) *" type="number" value={opt.price} onChange={(e) => setOpt({ ...opt, price: e.target.value })} data-testid="opt-price" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                      <input placeholder="Brand" value={opt.brand} onChange={(e) => setOpt({ ...opt, brand: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                      <input placeholder="Description" value={opt.description} onChange={(e) => setOpt({ ...opt, description: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                      <input placeholder="Specifications" value={opt.specifications} onChange={(e) => setOpt({ ...opt, specifications: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                      <input placeholder="Available sizes / colors / variants" value={opt.variants} onChange={(e) => setOpt({ ...opt, variants: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                      <div className="flex gap-2">
                        <input placeholder="Shop name" value={opt.shop_name} onChange={(e) => setOpt({ ...opt, shop_name: e.target.value })} className="flex-1 rounded-xl border px-3 py-2.5 text-sm" />
                        <input placeholder="Stock qty" type="number" value={opt.quantity_available} onChange={(e) => setOpt({ ...opt, quantity_available: e.target.value })} className="w-24 rounded-xl border px-3 py-2.5 text-sm" />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={opt.in_stock} onChange={(e) => setOpt({ ...opt, in_stock: e.target.checked })} className="h-4 w-4 accent-orange-500" /> In stock</label>
                    </div>
                    <DialogFooter><button onClick={addOption} data-testid="submit-option" className="bg-orange-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold">Send to customer</button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              {options.length === 0 ? <p className="text-sm text-slate-400">Upload real product photos & prices for the customer to approve.</p> : (
                <div className="space-y-2">
                  {options.map((o) => (
                    <div key={o.id} className="rounded-xl bg-slate-50 p-3" data-testid={`pa-option-${o.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {o.photos?.[0] && <img src={o.photos[0]} alt="" className="h-9 w-9 rounded-lg object-cover" />}
                          <div><p className="text-sm font-semibold text-slate-800">{o.name}</p><p className="text-xs text-slate-400 flex items-center gap-1"><Store className="h-3 w-3" />{o.shop_name || "Shop"}</p></div>
                        </div>
                        <div className="text-right"><p className="font-semibold text-slate-900 text-sm">{inr(o.price)}</p>
                          <StatusBadge status={o.approval_status === "approved" ? "purchase_approved" : o.approval_status === "rejected" ? "cancelled" : "awaiting_approval"} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Receipt */}
            {authorized && (
              <Dialog open={rcptOpen} onOpenChange={setRcptOpen}>
                <DialogTrigger asChild>
                  <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors" data-testid="upload-receipt-btn"><Receipt className="h-4 w-4" /> Record purchase & upload receipt</button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record purchase</DialogTitle></DialogHeader>
                  <p className="text-xs text-slate-500">Approved amount: <b>{inr(approved?.approved_amount)}</b>. If actual exceeds this, the customer must re-approve.</p>
                  <input placeholder="Actual amount paid (₹) *" type="number" value={rcpt.actual_amount} onChange={(e) => setRcpt({ ...rcpt, actual_amount: e.target.value })} data-testid="receipt-amount" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                  <input placeholder="Shop name" value={rcpt.shop_name} onChange={(e) => setRcpt({ ...rcpt, shop_name: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                  <ImageUpload images={rcpt.receipt_image ? [rcpt.receipt_image] : []} onChange={(p) => setRcpt({ ...rcpt, receipt_image: p[0] || "" })} label="Bill" max={1} testid="receipt-image" />
                  <DialogFooter><button onClick={uploadReceipt} data-testid="submit-receipt" className="bg-orange-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold">Submit</button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Out for delivery / POD */}
            {task.status === "purchase_completed" && (
              <button onClick={() => setStatus("out_for_delivery")} data-testid="out-for-delivery-btn" className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2"><Truck className="h-4 w-4" /> Out for delivery</button>
            )}
            {task.status === "out_for_delivery" && (
              <Dialog open={podOpen} onOpenChange={setPodOpen}>
                <DialogTrigger asChild>
                  <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2" data-testid="pod-btn"><CheckCircle2 className="h-4 w-4" /> Capture proof of delivery</button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Proof of delivery</DialogTitle></DialogHeader>
                  <ImageUpload images={pod.proof_image ? [pod.proof_image] : []} onChange={(p) => setPod({ ...pod, proof_image: p[0] || "" })} label="Photo" max={1} testid="pod-image" />
                  <input placeholder="Note (optional)" value={pod.note} onChange={(e) => setPod({ ...pod, note: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                  <DialogFooter><button onClick={uploadPod} data-testid="submit-pod" className="bg-orange-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold">Mark delivered</button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {["pa_arrived", "searching", "awaiting_approval"].includes(task.status) && (
              <button onClick={markUnavailable} data-testid="unavailable-btn" className="w-full border border-slate-200 text-slate-600 rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2"><PackageX className="h-4 w-4" /> Item unavailable</button>
            )}
          </>
        )}

        {tab === "chat" && <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><ChatPanel taskId={id} height="h-[55vh]" /></div>}
        {tab === "timeline" && <div className="bg-white rounded-2xl border border-slate-200 p-4"><StatusTimeline timeline={timeline} /></div>}
      </div>
    </div>
  );
}

function Info({ l, v }) {
  return <div className="flex justify-between gap-4 py-0.5"><span className="text-sm text-slate-500 flex-shrink-0">{l}</span><span className="text-sm text-right text-slate-800">{v}</span></div>;
}
