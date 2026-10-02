import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import ImageUpload from "@/components/ImageUpload";
import { LogOut, ShieldCheck, Clock, XCircle, Star } from "lucide-react";

export default function PAProfile() {
  const nav = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "", service_area: user?.service_area || "", address: user?.address || "",
    photo: user?.photo || "", id_document: "", id_number: user?.documents?.id_number || "",
    bank_account: "", bank_ifsc: "", emergency_contact: user?.emergency_contact || "",
  });
  const vs = user?.verification_status;
  const needsApply = vs === "unregistered" || vs === "rejected" || !vs;

  const apply = async () => {
    if (!form.service_area) return toast.error("Enter your service area");
    try {
      const { data } = await api.post("/pa/apply", form);
      updateUser(data);
      toast.success("Application submitted for verification");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const StatusBanner = () => {
    if (vs === "verified") return <Banner icon={ShieldCheck} color="emerald" title="Verified PA" sub="You can go online and accept tasks." />;
    if (vs === "pending") return <Banner icon={Clock} color="amber" title="Verification pending" sub="Our admin team is reviewing your application." />;
    if (vs === "rejected") return <Banner icon={XCircle} color="red" title="Application rejected" sub="Please update your details and re-apply." />;
    return <Banner icon={Clock} color="slate" title="Complete your application" sub="Submit the details below to get verified." />;
  };

  return (
    <div className="animate-slide-up">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-5 h-16 flex items-center">
        <h1 className="font-head text-xl font-bold text-slate-900">Profile</h1>
      </header>
      <div className="px-5 pt-5 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-bold overflow-hidden">
            {user?.photo ? <img src={user.photo} alt="" className="h-full w-full object-cover" /> : (user?.name || "P").charAt(0)}
          </div>
          <div><p className="text-xs text-slate-400">+91 {user?.mobile}</p><p className="font-semibold text-slate-900">{user?.name || "Personal Assistant"}</p>
            {vs === "verified" && <p className="text-xs text-amber-500 flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{user?.rating || "New"} · {user?.rating_count || 0} reviews</p>}</div>
        </div>

        <StatusBanner />

        {(needsApply || vs === "pending") && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="font-head font-bold text-slate-900 text-sm">PA application</p>
            <Field label="Full name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pa-name" className="inp" /></Field>
            <Field label="Profile photo"><ImageUpload images={form.photo ? [form.photo] : []} onChange={(p) => setForm({ ...form, photo: p[0] || "" })} label="Photo" max={1} testid="pa-photo" /></Field>
            <Field label="Service area *"><input value={form.service_area} onChange={(e) => setForm({ ...form, service_area: e.target.value })} placeholder="e.g. Banjara Hills, Jubilee Hills" data-testid="pa-service-area" className="inp" /></Field>
            <Field label="Address"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="pa-address" className="inp" /></Field>
            <Field label="ID document (Aadhaar/PAN)"><ImageUpload images={form.id_document ? [form.id_document] : []} onChange={(p) => setForm({ ...form, id_document: p[0] || "" })} label="ID" max={1} testid="pa-id-doc" /></Field>
            <Field label="ID number"><input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} data-testid="pa-id-number" className="inp" /></Field>
            <div className="flex gap-2">
              <Field label="Bank account"><input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} className="inp" /></Field>
              <Field label="IFSC"><input value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })} className="inp" /></Field>
            </div>
            <Field label="Emergency contact"><input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} data-testid="pa-emergency" className="inp" /></Field>
            <button onClick={apply} data-testid="submit-application" className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-full py-3 text-sm font-semibold transition-colors">
              {vs === "pending" ? "Update application" : "Submit for verification"}
            </button>
            <p className="text-[11px] text-slate-400">Your identity & bank details are stored securely and only used for verification and payouts.</p>
          </div>
        )}

        {vs === "verified" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 text-sm">
            <Row l="Service area" v={user?.service_area} />
            <Row l="ID" v={user?.documents?.id_number} />
            <Row l="Emergency contact" v={user?.emergency_contact} />
          </div>
        )}

        <button onClick={() => { logout(); nav("/"); }} data-testid="pa-logout" className="w-full bg-red-50 text-red-600 rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
      <style>{`.inp{width:100%;border-radius:0.75rem;border:1px solid #e2e8f0;padding:0.625rem 0.75rem;font-size:0.875rem;outline:none}.inp:focus{box-shadow:0 0 0 2px #f97316}`}</style>
    </div>
  );
}

function Field({ label, children }) { return <div className="flex-1"><label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>{children}</div>; }
function Row({ l, v }) { return <div className="flex justify-between"><span className="text-slate-500">{l}</span><span className="text-slate-800 font-medium">{v || "—"}</span></div>; }
function Banner({ icon: Icon, color, title, sub }) {
  const c = { emerald: "bg-emerald-50 border-emerald-200 text-emerald-800", amber: "bg-amber-50 border-amber-200 text-amber-800", red: "bg-red-50 border-red-200 text-red-800", slate: "bg-slate-100 border-slate-200 text-slate-700" }[color];
  return <div className={`rounded-2xl border p-4 flex items-center gap-3 ${c}`} data-testid="pa-status-banner"><Icon className="h-6 w-6" /><div><p className="font-semibold text-sm">{title}</p><p className="text-xs opacity-80">{sub}</p></div></div>;
}
