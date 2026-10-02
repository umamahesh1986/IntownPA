import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { inr } from "@/lib/i18n";
import StatusBadge from "@/components/StatusBadge";
import StatusTimeline from "@/components/StatusTimeline";
import ChatPanel from "@/components/ChatPanel";
import { Loader } from "@/components/States";
import { toast } from "sonner";
import {
  ArrowLeft, Check, X, Camera, RefreshCw, Store, Phone, Star, CreditCard,
  ShieldCheck, Truck, AlertTriangle, Minus, Plus, FileText, Ban,
} from "lucide-react";

export default function CustomerTaskDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(params.get("tab") === "chat" ? "chat" : "details");
  const [qty, setQty] = useState({});
  const [payCfg, setPayCfg] = useState(null);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/tasks/${id}`); setData(data); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); nav("/app/tasks"); }
  }, [id, nav]);

  useEffect(() => { load(); api.get("/payments/config").then((r) => setPayCfg(r.data)); }, [load]);
  useEffect(() => { const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  if (!data) return <div className="min-h-screen bg-slate-50"><Loader /></div>;
  const { task, options, timeline, receipts, pa } = data;
  const approved = options.find((o) => o.approval_status === "approved");
  const getQty = (o) => qty[o.id] || 1;

  const act = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };

  const approve = (o) => act(() => api.post(`/customer/product-options/${o.id}/approve`, { quantity: getQty(o) }), "Purchase approved");
  const reject = (o) => act(() => api.post(`/customer/product-options/${o.id}/reject`), "Option rejected");
  const requestMore = (o) => act(() => api.post(`/customer/product-options/${o.id}/request-more`, {}), "Requested more details");
  const requestAlt = () => act(() => api.post(`/customer/tasks/${id}/request-alternative`, {}), "Requested alternatives");
  const confirmDelivery = () => act(() => api.post(`/customer/tasks/${id}/confirm-delivery`), "Delivery confirmed. Thank you!");
  const cancelTask = () => { if (window.confirm("Cancel this task?")) act(() => api.post(`/customer/tasks/${id}/cancel`), "Cancellation requested"); };
  const submitRating = () => act(() => api.post(`/customer/tasks/${id}/review`, { rating, review }), "Thanks for your rating!");

  const pay = async (payFor) => {
    try {
      const { data: order } = await api.post("/payments/create-order", { task_id: id, pay_for: payFor });
      if (order.placeholder) {
        await api.post("/payments/simulate-success", { order_id: order.order.id, payment_id: "sim", signature: "" });
        toast.success("Payment successful (test mode)"); load();
      } else {
        const rzp = new window.Razorpay({
          key: order.key_id, amount: order.order.amount, currency: "INR", order_id: order.order.id,
          name: "IntownPA", description: task.task_code,
          handler: async (res) => {
            await api.post("/payments/verify", { order_id: res.razorpay_order_id, payment_id: res.razorpay_payment_id, signature: res.razorpay_signature });
            toast.success("Payment successful"); load();
          },
        });
        rzp.open();
      }
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 animate-slide-up">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 h-16 flex items-center gap-3">
        <button onClick={() => nav("/app/tasks")} data-testid="task-back"><ArrowLeft className="h-5 w-5 text-slate-600" /></button>
        <div className="flex-1"><p className="font-head font-bold text-slate-900 text-sm leading-tight">{task.title}</p><p className="text-xs text-slate-400">{task.task_code}</p></div>
        <StatusBadge status={task.status} />
      </header>

      {/* Tabs */}
      <div className="flex gap-2 bg-white border-b border-slate-100 px-4">
        {[["details", "Details"], ["products", `Products${options.length ? ` (${options.length})` : ""}`], ["chat", "Chat"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`taskdetail-tab-${k}`}
            className={`py-3 text-sm font-semibold border-b-2 transition-colors ${tab === k ? "border-orange-500 text-orange-600" : "border-transparent text-slate-400"} flex-1`}>{l}</button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">
        {tab === "details" && (
          <>
            {/* PA card */}
            {pa ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg">{(pa.name || "P").charAt(0)}</div>
                <div className="flex-1"><p className="font-semibold text-slate-900 text-sm">{pa.name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {pa.rating || "New"}</p></div>
                {pa.mobile && <a href={`tel:${pa.mobile}`} className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center" data-testid="call-pa"><Phone className="h-4 w-4 text-emerald-600" /></a>}
                <button onClick={() => setTab("chat")} className="rounded-full bg-orange-500 text-white px-4 py-2 text-xs font-semibold" data-testid="chat-pa-btn">Chat</button>
              </div>
            ) : (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-sm text-sky-800">Your request is being matched with a verified PA.</div>
            )}

            {/* Signature promise reminder */}
            {task.status === "awaiting_approval" && (
              <button onClick={() => setTab("products")} className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-left" data-testid="approve-reminder">
                <Camera className="h-6 w-6 text-amber-600" />
                <div><p className="font-semibold text-amber-800 text-sm">Show Me Before You Buy</p><p className="text-xs text-amber-700">Your PA uploaded product options. Review & approve before purchase.</p></div>
              </button>
            )}

            {/* Task info */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
              <Info l="Category" v={task.category_name} />
              {task.description && <Info l="Description" v={task.description} />}
              {task.preferred_location && <Info l="Preferred location" v={task.preferred_location} />}
              {task.delivery_address && <Info l="Delivery to" v={task.delivery_address} />}
              {task.preferred_time && <Info l="Preferred time" v={`${task.preferred_date || ""} ${task.preferred_time}`} />}
              {task.instructions && <Info l="Instructions" v={task.instructions} />}
              <Info l="Product budget" v={inr(task.product_budget)} />
            </div>

            {/* Fees */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="font-head font-bold text-slate-900 mb-2 text-sm">Cost breakdown</p>
              <Info l="Product budget" v={inr(task.fees?.product_budget)} />
              <Info l="Service fee" v={inr(task.fees?.service_fee)} />
              {task.fees?.delivery_fee > 0 && <Info l="Delivery" v={inr(task.fees?.delivery_fee)} />}
              {task.fees?.discount > 0 && <Info l="Discount" v={`- ${inr(task.fees?.discount)}`} />}
              <Info l="Tax" v={inr(task.fees?.tax)} />
              <div className="border-t my-2" />
              <Info l="Estimated total" v={inr(task.fees?.grand_total)} bold />
              {task.approved_amount ? <Info l="Approved product amount" v={inr(task.approved_amount)} bold /> : null}
              {task.payment_status === "paid" && <p className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Payment received</p>}
            </div>

            {/* Receipts */}
            {receipts?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <p className="font-head font-bold text-slate-900 mb-2 text-sm flex items-center gap-1"><FileText className="h-4 w-4 text-orange-500" /> Receipt</p>
                {receipts.map((r) => (
                  <div key={r.id} className="text-sm">
                    <Info l="Actual amount paid" v={inr(r.actual_amount)} />
                    {r.variance !== 0 && <Info l="Variance vs approved" v={inr(r.variance)} />}
                    {r.shop_name && <Info l="Shop" v={r.shop_name} />}
                    {r.image && <img src={r.image} alt="receipt" className="rounded-xl mt-2 max-h-48" />}
                  </div>
                ))}
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="font-head font-bold text-slate-900 mb-3 text-sm">Task timeline</p>
              <StatusTimeline timeline={timeline} />
            </div>

            {/* Rating */}
            {task.status === "completed" && !task.rating && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <p className="font-head font-bold text-slate-900 mb-2 text-sm">Rate your PA</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)} data-testid={`rate-${n}`}><Star className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} /></button>
                  ))}
                </div>
                <textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder="Share feedback (optional)" data-testid="review-text" className="w-full mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm h-20" />
                <button onClick={submitRating} data-testid="submit-review" className="w-full mt-2 bg-orange-500 text-white rounded-full py-2.5 text-sm font-semibold">Submit rating</button>
              </div>
            )}
            {task.rating ? <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-2"><Star className="h-5 w-5 fill-amber-400 text-amber-400" /><span className="text-sm text-slate-700">You rated this {task.rating}/5</span></div> : null}
          </>
        )}

        {tab === "products" && (
          <>
            {options.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
                <Camera className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                No product options yet. Your PA will upload real photos & prices here.
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">Compare options below. <span className="font-semibold text-slate-700">Nothing is purchased until you approve.</span></p>
                {options.map((o) => (
                  <div key={o.id} data-testid={`product-option-${o.id}`}
                    className={`bg-white rounded-2xl border p-4 ${o.approval_status === "approved" ? "border-emerald-400 ring-2 ring-emerald-100" : o.approval_status === "rejected" ? "border-slate-200 opacity-60" : "border-slate-200"}`}>
                    {o.photos?.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
                        {o.photos.map((p, i) => <img key={i} src={p} alt="product" className="h-32 w-32 rounded-xl object-cover flex-shrink-0" />)}
                      </div>
                    ) : (
                      <div className="h-24 rounded-xl bg-slate-100 flex items-center justify-center mb-3 text-slate-300"><Camera className="h-8 w-8" /></div>
                    )}
                    <div className="flex items-start justify-between">
                      <div><p className="font-head font-bold text-slate-900">{o.name}</p>{o.brand && <p className="text-xs text-slate-400">{o.brand}</p>}</div>
                      <p className="font-head font-extrabold text-orange-600 text-lg">{inr(o.price)}</p>
                    </div>
                    {o.description && <p className="text-sm text-slate-600 mt-1">{o.description}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      {o.variants && <span>Variants: {o.variants}</span>}
                      {o.specifications && <span>{o.specifications}</span>}
                      <span className="flex items-center gap-1"><Store className="h-3 w-3" /> {o.shop_name || "Local shop"}</span>
                      <span className={o.in_stock ? "text-emerald-600" : "text-red-500"}>{o.in_stock ? "In stock" : "Out of stock"}</span>
                    </div>

                    {o.approval_status === "approved" ? (
                      <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
                        <Check className="h-4 w-4" /> Approved — {o.approved_quantity} × {inr(o.price)} = <b>{inr(o.approved_amount)}</b>
                      </div>
                    ) : o.approval_status === "rejected" ? (
                      <p className="mt-3 text-xs text-slate-400">Rejected</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                          <span className="text-sm text-slate-600">Quantity</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setQty({ ...qty, [o.id]: Math.max(1, getQty(o) - 1) })} data-testid={`qty-minus-${o.id}`} className="h-7 w-7 rounded-full bg-white border flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                            <span className="font-semibold w-5 text-center" data-testid={`qty-val-${o.id}`}>{getQty(o)}</span>
                            <button onClick={() => setQty({ ...qty, [o.id]: getQty(o) + 1 })} data-testid={`qty-plus-${o.id}`} className="h-7 w-7 rounded-full bg-white border flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm px-1">
                          <span className="text-slate-500">Final amount</span>
                          <span className="font-semibold text-slate-900">{inr(o.price * getQty(o))}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => approve(o)} data-testid={`approve-${o.id}`} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"><Check className="h-4 w-4" /> Approve</button>
                          <button onClick={() => reject(o)} data-testid={`reject-${o.id}`} className="bg-slate-100 text-slate-600 rounded-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1"><X className="h-4 w-4" /> Reject</button>
                          <button onClick={() => requestMore(o)} data-testid={`more-${o.id}`} className="bg-slate-100 text-slate-600 rounded-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1"><Camera className="h-3.5 w-3.5" /> More</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {!approved && (
                  <button onClick={requestAlt} data-testid="request-alternative" className="w-full bg-white border border-slate-200 rounded-2xl py-3 text-sm font-semibold text-slate-600 flex items-center justify-center gap-2"><RefreshCw className="h-4 w-4" /> Ask PA to find alternatives</button>
                )}
              </>
            )}
          </>
        )}

        {tab === "chat" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <ChatPanel taskId={id} height="h-[55vh]" />
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 px-4 py-3 space-y-2">
        {payCfg && payCfg.mode === "placeholder" && task.payment_status !== "paid" && (approved || task.status === "purchase_completed") && (
          <p className="text-[11px] text-center text-amber-600 bg-amber-50 rounded-lg py-1">Razorpay test placeholder — payment is simulated</p>
        )}
        <div className="flex gap-2">
          {task.payment_status !== "paid" && (approved || task.status === "purchase_completed" || task.status === "out_for_delivery") && (
            <button onClick={() => pay("total")} data-testid="pay-btn" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"><CreditCard className="h-4 w-4" /> Pay {inr((task.approved_amount || task.product_budget || 0) + (task.fees?.total_fees || 0))}</button>
          )}
          {["out_for_delivery", "delivered"].includes(task.status) && (
            <button onClick={confirmDelivery} data-testid="confirm-delivery-btn" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"><Truck className="h-4 w-4" /> Confirm delivery</button>
          )}
          {!["completed", "cancelled", "refunded"].includes(task.status) && (
            <button onClick={cancelTask} data-testid="cancel-task-btn" className="rounded-full border border-red-200 text-red-500 px-4 py-3 text-sm font-semibold flex items-center gap-1"><Ban className="h-4 w-4" /> Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ l, v, bold }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-sm text-slate-500 flex-shrink-0">{l}</span>
      <span className={`text-sm text-right ${bold ? "font-bold text-slate-900" : "text-slate-800"}`}>{v}</span>
    </div>
  );
}
