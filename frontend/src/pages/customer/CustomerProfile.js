import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, LogOut, FileText, Headphones, Globe, ChevronRight, User } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

export default function CustomerProfile() {
  const nav = useNavigate();
  const { user, logout, updateUser, lang, changeLang } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [addrOpen, setAddrOpen] = useState(false);
  const [addr, setAddr] = useState({ label: "Home", line1: "", area: "", city: "Hyderabad", pincode: "", landmark: "" });
  const [supportOpen, setSupportOpen] = useState(false);
  const [ticket, setTicket] = useState({ subject: "", message: "" });
  const [policies, setPolicies] = useState([]);

  const loadAddr = () => api.get("/customer/addresses").then((r) => setAddresses(r.data));
  useEffect(() => { loadAddr(); api.get("/content/policies").then((r) => setPolicies(r.data)); }, []);

  const saveProfile = async () => {
    try {
      const { data } = await api.put("/auth/profile", { name, email });
      updateUser(data); toast.success("Profile updated");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const addAddress = async () => {
    if (!addr.line1) return toast.error("Enter address");
    await api.post("/customer/addresses", addr);
    setAddrOpen(false); setAddr({ label: "Home", line1: "", area: "", city: "Hyderabad", pincode: "", landmark: "" });
    loadAddr(); toast.success("Address added");
  };

  const delAddress = async (id) => { await api.delete(`/customer/addresses/${id}`); loadAddr(); };

  const submitTicket = async () => {
    if (!ticket.subject || !ticket.message) return toast.error("Fill subject & message");
    await api.post("/customer/support", ticket);
    setSupportOpen(false); setTicket({ subject: "", message: "" }); toast.success("Support request sent");
  };

  return (
    <div className="animate-slide-up">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-5 h-16 flex items-center">
        <h1 className="font-head text-xl font-bold text-slate-900">Profile</h1>
      </header>

      <div className="px-5 pt-5 space-y-5">
        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-bold">
              {(user?.name || "U").charAt(0)}
            </div>
            <div><p className="text-xs text-slate-400">+91 {user?.mobile}</p><p className="font-semibold text-slate-900">{user?.name || "IntownPA User"}</p></div>
          </div>
          <label className="text-xs font-semibold text-slate-600">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} data-testid="profile-name"
            className="w-full mt-1 mb-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" />
          <label className="text-xs font-semibold text-slate-600">Email (optional)</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} data-testid="profile-email"
            className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" />
          <button onClick={saveProfile} data-testid="save-profile"
            className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full py-2.5 text-sm font-semibold transition-colors">Save</button>
        </div>

        {/* Addresses */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-head font-bold text-slate-900 flex items-center gap-2"><MapPin className="h-4 w-4 text-orange-500" /> Saved addresses</p>
            <Dialog open={addrOpen} onOpenChange={setAddrOpen}>
              <DialogTrigger asChild>
                <button className="text-orange-500 text-sm font-semibold flex items-center gap-1" data-testid="add-address-btn"><Plus className="h-4 w-4" />Add</button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add address</DialogTitle></DialogHeader>
                <div className="space-y-2">
                  <input placeholder="Label (Home/Office)" value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                  <input placeholder="Flat / House, street" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} data-testid="addr-line1" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                  <input placeholder="Area" value={addr.area} onChange={(e) => setAddr({ ...addr, area: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                  <div className="flex gap-2">
                    <input placeholder="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} className="flex-1 rounded-xl border px-3 py-2.5 text-sm" />
                    <input placeholder="Pincode" value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value })} className="flex-1 rounded-xl border px-3 py-2.5 text-sm" />
                  </div>
                  <input placeholder="Landmark" value={addr.landmark} onChange={(e) => setAddr({ ...addr, landmark: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                </div>
                <DialogFooter><button onClick={addAddress} data-testid="save-address" className="bg-orange-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold">Save address</button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {addresses.length === 0 ? <p className="text-sm text-slate-400">No saved addresses.</p> : (
            <div className="space-y-2">
              {addresses.map((a) => (
                <div key={a.id} className="flex items-start justify-between rounded-xl bg-slate-50 p-3">
                  <div><p className="text-sm font-semibold text-slate-800">{a.label}</p><p className="text-xs text-slate-500">{a.line1}, {a.area}, {a.city} {a.pincode}</p></div>
                  <button onClick={() => delAddress(a.id)} data-testid={`del-addr-${a.id}`}><Trash2 className="h-4 w-4 text-slate-400" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Language */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="font-head font-bold text-slate-900 flex items-center gap-2 mb-3"><Globe className="h-4 w-4 text-orange-500" /> Language</p>
          <div className="flex gap-2">
            {[["en", "English"], ["te", "తెలుగు"]].map(([k, l]) => (
              <button key={k} onClick={() => changeLang(k)} data-testid={`lang-${k}`}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${lang === k ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-500"}`}>{l}</button>
            ))}
          </div>
        </div>

        {/* Support */}
        <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
          <DialogTrigger asChild>
            <button className="w-full bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between" data-testid="support-btn">
              <span className="flex items-center gap-2 text-slate-700 text-sm font-medium"><Headphones className="h-4 w-4 text-orange-500" /> Contact support</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Contact support</DialogTitle></DialogHeader>
            <input placeholder="Subject" value={ticket.subject} onChange={(e) => setTicket({ ...ticket, subject: e.target.value })} data-testid="ticket-subject" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            <textarea placeholder="How can we help?" value={ticket.message} onChange={(e) => setTicket({ ...ticket, message: e.target.value })} data-testid="ticket-message" className="w-full rounded-xl border px-3 py-2.5 text-sm h-24" />
            <DialogFooter><button onClick={submitTicket} data-testid="submit-ticket" className="bg-orange-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold">Send</button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Policies */}
        <div className="bg-white rounded-2xl border border-slate-200 divide-y">
          {policies.map((p) => (
            <details key={p.key} className="p-4" data-testid={`policy-${p.key}`}>
              <summary className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer"><FileText className="h-4 w-4 text-orange-500" /> {p.title}</summary>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{p.content}</p>
            </details>
          ))}
        </div>

        <button onClick={() => { logout(); nav("/"); }} data-testid="logout-btn"
          className="w-full bg-red-50 text-red-600 rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
          <LogOut className="h-4 w-4" /> Log out
        </button>
        <p className="text-center text-xs text-slate-400 pb-4">IntownPA · Yagnavihar Lifestyle Pvt Ltd</p>
      </div>
    </div>
  );
}
