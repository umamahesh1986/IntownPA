import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Loader, EmptyState } from "@/components/States";
import { toast } from "sonner";
import { Users } from "lucide-react";

export default function AdminCustomers() {
  const [rows, setRows] = useState(null);
  const load = () => api.get("/admin/customers").then((r) => setRows(r.data)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const suspend = async (id, val) => {
    try { await api.post(`/admin/users/${id}/suspend?suspend=${val}`); toast.success(val ? "Suspended" : "Activated"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  if (!rows) return <Loader />;

  return (
    <div className="animate-slide-up">
      <h1 className="font-head text-2xl font-bold text-slate-900">Customers</h1>
      <p className="text-slate-500 text-sm">Manage customer accounts & booking history.</p>
      <div className="mt-5 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {rows.length === 0 ? <EmptyState icon={Users} title="No customers yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr>
                <th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Mobile</th>
                <th className="text-left px-4 py-3">Bookings</th><th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} data-testid={`admin-customer-${c.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{c.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">+91 {c.mobile}</td>
                    <td className="px-4 py-3 text-slate-600">{c.booking_count}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.status === "suspended" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{c.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      {c.status === "suspended"
                        ? <button onClick={() => suspend(c.id, false)} data-testid={`activate-${c.id}`} className="text-emerald-600 font-semibold text-xs">Activate</button>
                        : <button onClick={() => suspend(c.id, true)} data-testid={`suspend-${c.id}`} className="text-red-500 font-semibold text-xs">Suspend</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
