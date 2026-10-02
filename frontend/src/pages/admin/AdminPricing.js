import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { inr } from "@/lib/i18n";
import { Loader } from "@/components/States";
import { toast } from "sonner";
import { IndianRupee, Save } from "lucide-react";

const MODELS = [["fixed", "Fixed fee per task"], ["hourly", "Hourly fee"], ["distance", "Distance-based"], ["category", "Category-specific"]];
const FIELDS = [
  ["base_service_fee", "Base service fee (₹)"], ["hourly_fee", "Hourly fee (₹)"],
  ["distance_fee_per_km", "Distance fee / km (₹)"], ["waiting_charge_per_min", "Waiting charge / min (₹)"],
  ["delivery_fee", "Delivery fee (₹)"], ["cancellation_fee", "Cancellation fee (₹)"], ["tax_percent", "Tax (%)"],
];

export default function AdminPricing() {
  const [p, setP] = useState(null);
  const [cats, setCats] = useState([]);

  useEffect(() => {
    api.get("/admin/pricing").then((r) => setP(r.data));
    api.get("/admin/categories").then((r) => setCats(r.data));
  }, []);

  const save = async () => {
    try {
      const payload = { ...p, category_fees: p.category_fees || {} };
      FIELDS.forEach(([k]) => (payload[k] = Number(payload[k])));
      await api.put("/admin/pricing", payload);
      toast.success("Pricing updated");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  if (!p) return <Loader />;

  return (
    <div className="animate-slide-up max-w-3xl">
      <h1 className="font-head text-2xl font-bold text-slate-900">Pricing management</h1>
      <p className="text-slate-500 text-sm">Configure the commercial model. Nothing is hardcoded — all fees are editable.</p>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-5">
        <label className="text-xs font-semibold text-slate-600">Commercial model</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          {MODELS.map(([k, l]) => (
            <button key={k} onClick={() => setP({ ...p, pricing_model: k })} data-testid={`model-${k}`}
              className={`rounded-xl border p-3 text-xs font-semibold transition-colors ${p.pricing_model === k ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-500"}`}>{l}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {FIELDS.map(([k, l]) => (
            <div key={k}>
              <label className="text-xs font-semibold text-slate-600">{l}</label>
              <input type="number" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} data-testid={`pricing-${k}`}
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" />
            </div>
          ))}
        </div>

        {p.pricing_model === "category" && cats.length > 0 && (
          <div className="mt-6">
            <label className="text-xs font-semibold text-slate-600">Category-specific service fees (₹)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {cats.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 flex-1">{c.name}</span>
                  <input type="number" value={(p.category_fees || {})[c.id] ?? ""} placeholder={String(p.base_service_fee)}
                    onChange={(e) => setP({ ...p, category_fees: { ...(p.category_fees || {}), [c.id]: Number(e.target.value) } })}
                    data-testid={`catfee-${c.id}`} className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={save} data-testid="save-pricing" className="mt-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full px-6 py-3 text-sm font-semibold flex items-center gap-2 transition-colors"><Save className="h-4 w-4" /> Save pricing</button>
      </div>
    </div>
  );
}
