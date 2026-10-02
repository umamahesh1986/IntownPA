import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { inr } from "@/lib/i18n";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { ArrowLeft, ArrowRight, Check, Save, Loader2, Tag } from "lucide-react";

const STEPS = ["Category", "Describe", "Product", "Location", "Schedule", "Review"];

export default function Booking() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const draftId = params.get("draft");

  const [form, setForm] = useState({
    category_id: params.get("category") || "", category_name: "",
    title: "", description: "", reference_photos: [],
    product_spec: { name: "", brand: "", size: "", color: "", quantity: 1, specifications: "" },
    product_budget: "", preferred_location: "", delivery_address: "", include_delivery: true,
    preferred_date: "", preferred_time: "", instructions: "", promo_code: "",
  });

  useEffect(() => {
    api.get("/categories").then((r) => {
      setCategories(r.data);
      if (form.category_id) {
        const c = r.data.find((x) => x.id === form.category_id);
        if (c) { setForm((f) => ({ ...f, category_name: c.name })); setStep(1); }
      }
    });
    api.get("/customer/addresses").then((r) => {
      setAddresses(r.data);
      if (r.data[0]) setForm((f) => ({ ...f, delivery_address: f.delivery_address || `${r.data[0].line1}, ${r.data[0].area}, ${r.data[0].city} ${r.data[0].pincode}` }));
    });
    if (draftId) {
      api.get("/customer/tasks").then((r) => {
        const d = r.data.find((t) => t.id === draftId);
        if (d) setForm((f) => ({ ...f, ...d, product_budget: String(d.product_budget || ""), promo_code: d.promo_code || "" }));
      });
    }
    // eslint-disable-next-line
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSpec = (k, v) => setForm((f) => ({ ...f, product_spec: { ...f.product_spec, [k]: v } }));

  const pickCategory = (c) => { set("category_id", c.id); set("category_name", c.name); setStep(1); };

  const loadEstimate = async () => {
    try {
      const { data } = await api.post("/customer/estimate", {
        category_id: form.category_id, include_delivery: form.include_delivery,
        product_budget: Number(form.product_budget || 0), promo_code: form.promo_code || null,
      });
      setEstimate(data);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const next = async () => {
    if (step === 1 && !form.title) return toast.error("Add a task title");
    if (step === 4) await loadEstimate();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async (isDraft) => {
    setLoading(true);
    try {
      const payload = { ...form, product_budget: Number(form.product_budget || 0), promo_code: form.promo_code || null, is_draft: isDraft };
      let res;
      if (draftId) res = await api.put(`/customer/tasks/${draftId}`, payload);
      else res = await api.post("/customer/tasks", payload);
      if (isDraft) { toast.success("Saved as draft"); nav("/app/tasks"); }
      else { toast.success(`Task ${res.data.task_code} submitted!`); nav(`/app/tasks/${res.data.id}`); }
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const CatIcon = (name) => Icons[name] || Icons.ShoppingBag;

  return (
    <div className="min-h-screen bg-slate-50 animate-slide-up">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-5 h-16 flex items-center gap-3">
        <button onClick={() => (step === 0 ? nav(-1) : setStep((s) => s - 1))} data-testid="booking-back"><ArrowLeft className="h-5 w-5 text-slate-600" /></button>
        <div className="flex-1"><p className="font-head font-bold text-slate-900">{STEPS[step]}</p><p className="text-xs text-slate-400">Step {step + 1} of {STEPS.length}</p></div>
      </header>

      <div className="h-1 bg-slate-100"><div className="h-full bg-orange-500 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>

      <div className="px-5 py-5 pb-28">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {categories.map((c) => {
              const Ic = CatIcon(c.icon);
              return (
                <button key={c.id} onClick={() => pickCategory(c)} data-testid={`book-category-${c.id}`}
                  className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-orange-400 transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center mb-2"><Ic className="h-5 w-5 text-orange-500" /></div>
                  <p className="text-sm font-semibold text-slate-800 leading-tight">{c.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div><label className="text-xs font-semibold text-slate-600">What do you need? *</label>
              <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Buy 5kg basmati rice" data-testid="book-title"
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" /></div>
            <div><label className="text-xs font-semibold text-slate-600">Describe the task</label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Add any details to help your PA" data-testid="book-description"
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-3 text-sm h-28 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" /></div>
            <div><label className="text-xs font-semibold text-slate-600">Reference photos</label>
              <div className="mt-2"><ImageUpload images={form.reference_photos} onChange={(imgs) => set("reference_photos", imgs)} testid="book-ref-photos" /></div></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {[["name", "Product name"], ["brand", "Brand"], ["size", "Size"], ["color", "Color"], ["specifications", "Preferred specifications"]].map(([k, l]) => (
              <div key={k}><label className="text-xs font-semibold text-slate-600">{l}</label>
                <input value={form.product_spec[k]} onChange={(e) => setSpec(k, e.target.value)} data-testid={`book-spec-${k}`}
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" /></div>
            ))}
            <div className="flex gap-3">
              <div className="flex-1"><label className="text-xs font-semibold text-slate-600">Quantity</label>
                <input type="number" min={1} value={form.product_spec.quantity} onChange={(e) => setSpec("quantity", Number(e.target.value))} data-testid="book-spec-quantity"
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
              <div className="flex-1"><label className="text-xs font-semibold text-slate-600">Est. product budget (₹)</label>
                <input type="number" min={0} value={form.product_budget} onChange={(e) => set("product_budget", e.target.value)} placeholder="0" data-testid="book-budget"
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div><label className="text-xs font-semibold text-slate-600">Preferred shop / market / location</label>
              <input value={form.preferred_location} onChange={(e) => set("preferred_location", e.target.value)} placeholder="e.g. More Supermarket, Banjara Hills" data-testid="book-location"
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
            <div><label className="text-xs font-semibold text-slate-600">Delivery address</label>
              {addresses.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2 pb-1">
                  {addresses.map((a) => (
                    <button key={a.id} onClick={() => set("delivery_address", `${a.line1}, ${a.area}, ${a.city} ${a.pincode}`)}
                      className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-orange-400">{a.label}</button>
                  ))}
                </div>
              )}
              <textarea value={form.delivery_address} onChange={(e) => set("delivery_address", e.target.value)} placeholder="Where should we deliver?" data-testid="book-delivery"
                className="w-full mt-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm h-20" /></div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.include_delivery} onChange={(e) => set("include_delivery", e.target.checked)} data-testid="book-include-delivery" className="h-4 w-4 accent-orange-500" />
              Include home delivery
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1"><label className="text-xs font-semibold text-slate-600">Preferred date</label>
                <input type="date" value={form.preferred_date} onChange={(e) => set("preferred_date", e.target.value)} data-testid="book-date"
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
              <div className="flex-1"><label className="text-xs font-semibold text-slate-600">Preferred time</label>
                <input value={form.preferred_time} onChange={(e) => set("preferred_time", e.target.value)} placeholder="e.g. Evening" data-testid="book-time"
                  className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
            </div>
            <div><label className="text-xs font-semibold text-slate-600">Instructions for your PA</label>
              <textarea value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Any special instructions" data-testid="book-instructions"
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm h-20" /></div>
            <div><label className="text-xs font-semibold text-slate-600">Promo code</label>
              <div className="flex items-center rounded-xl border border-slate-200 mt-1">
                <Tag className="h-4 w-4 text-slate-400 ml-3" />
                <input value={form.promo_code} onChange={(e) => set("promo_code", e.target.value.toUpperCase())} placeholder="WELCOME50" data-testid="book-promo"
                  className="flex-1 px-2 py-2.5 text-sm focus:outline-none" /></div></div>
          </div>
        )}

        {step === 5 && estimate && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="font-head font-bold text-slate-900 mb-1">{form.title}</p>
              <p className="text-xs text-slate-400">{form.category_name}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="font-head font-bold text-slate-900 mb-3">Transparent cost estimate</p>
              <Row l="Product purchase budget" v={estimate.product_budget} muted />
              <div className="my-2 border-t border-dashed" />
              <Row l="IntownPA service fee" v={estimate.service_fee} />
              {estimate.delivery_fee > 0 && <Row l="Delivery fee" v={estimate.delivery_fee} />}
              {estimate.discount > 0 && <Row l={`Discount ${estimate.promo_applied ? `(${estimate.promo_applied})` : ""}`} v={-estimate.discount} green />}
              <Row l={`Taxes (${estimate.tax_percent}%)`} v={estimate.tax} />
              <div className="my-2 border-t" />
              <Row l="IntownPA charges total" v={estimate.total_fees} bold />
              <div className="my-2 border-t" />
              <div className="flex justify-between items-center">
                <span className="font-head font-bold text-slate-900">Total estimated amount</span>
                <span className="font-head font-extrabold text-orange-600 text-lg" data-testid="estimate-grand-total">{inr(estimate.grand_total)}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-3">Product cost is kept separate from IntownPA's service revenue. Final product price is confirmed by you before purchase. No hidden fees.</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 px-5 py-3 flex gap-3">
        <button onClick={() => submit(true)} disabled={loading || !form.title} data-testid="save-draft-btn"
          className="rounded-full border border-slate-200 text-slate-600 px-4 py-3 text-sm font-semibold flex items-center gap-1 disabled:opacity-50"><Save className="h-4 w-4" /> Draft</button>
        {step < STEPS.length - 1 ? (
          <button onClick={next} disabled={step === 0 && !form.category_id} data-testid="booking-next"
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => submit(false)} disabled={loading} data-testid="confirm-booking-btn"
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm & Submit
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ l, v, bold, muted, green }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className={`text-sm ${muted ? "text-slate-400" : "text-slate-600"} ${bold ? "font-semibold text-slate-900" : ""}`}>{l}</span>
      <span className={`text-sm ${bold ? "font-semibold text-slate-900" : green ? "text-emerald-600 font-medium" : "text-slate-700"}`}>{inr(v)}</span>
    </div>
  );
}
