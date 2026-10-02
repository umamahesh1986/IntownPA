import React, { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Loader } from "@/components/States";
import { toast } from "sonner";
import { Plus, Trash2, Tag, Image, HelpCircle, FileText, LayoutGrid } from "lucide-react";

const TABS = [["categories", "Categories", LayoutGrid], ["promos", "Promo codes", Tag], ["banners", "Banners", Image], ["faqs", "FAQs", HelpCircle], ["policies", "Policies", FileText]];

export default function AdminContent() {
  const [tab, setTab] = useState("categories");
  return (
    <div className="animate-slide-up">
      <h1 className="font-head text-2xl font-bold text-slate-900">Content management</h1>
      <p className="text-slate-500 text-sm">Manage categories, promotions, banners, FAQs & policies.</p>
      <div className="flex gap-2 mt-5 flex-wrap">
        {TABS.map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`content-tab-${k}`}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tab === k ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>
            <Icon className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "categories" && <Categories />}
        {tab === "promos" && <Promos />}
        {tab === "banners" && <Banners />}
        {tab === "faqs" && <Faqs />}
        {tab === "policies" && <Policies />}
      </div>
    </div>
  );
}

function Categories() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ name: "", icon: "ShoppingBag", description: "", order: 0, active: true });
  const load = () => api.get("/admin/categories").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!form.name) return toast.error("Name required"); await api.post("/admin/categories", { ...form, order: rows.length }); setForm({ name: "", icon: "ShoppingBag", description: "", order: 0, active: true }); load(); toast.success("Added"); };
  const toggle = async (c) => { await api.put(`/admin/categories/${c.id}`, { ...c, active: !c.active }); load(); };
  const del = async (id) => { await api.delete(`/admin/categories/${id}`); load(); };
  if (!rows) return <Loader />;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Category name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="cat-name" className="flex-1 min-w-40 rounded-xl border px-3 py-2.5 text-sm" />
        <input placeholder="Lucide icon (e.g. Gift)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-40 rounded-xl border px-3 py-2.5 text-sm" />
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="flex-1 min-w-40 rounded-xl border px-3 py-2.5 text-sm" />
        <button onClick={add} data-testid="add-category" className="bg-orange-500 text-white rounded-full px-5 py-2.5 text-sm font-semibold flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4" data-testid={`admin-cat-${c.id}`}>
            <div><p className="font-semibold text-slate-800 text-sm">{c.name}</p><p className="text-xs text-slate-400">{c.icon} · {c.description}</p></div>
            <div className="flex items-center gap-3">
              <button onClick={() => toggle(c)} className={`text-xs font-semibold ${c.active ? "text-emerald-600" : "text-slate-400"}`}>{c.active ? "Active" : "Disabled"}</button>
              <button onClick={() => del(c.id)} data-testid={`del-cat-${c.id}`}><Trash2 className="h-4 w-4 text-slate-400" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Promos() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ code: "", type: "percent", value: 10, max_discount: 100, active: true });
  const load = () => api.get("/admin/promos").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!form.code) return toast.error("Code required"); try { await api.post("/admin/promos", { ...form, value: Number(form.value), max_discount: Number(form.max_discount) }); load(); toast.success("Saved"); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };
  const del = async (code) => { await api.delete(`/admin/promos/${code}`); load(); };
  if (!rows) return <Loader />;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-2 items-end">
        <input placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} data-testid="promo-code" className="w-32 rounded-xl border px-3 py-2.5 text-sm" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-xl border px-3 py-2.5 text-sm"><option value="percent">Percent</option><option value="flat">Flat</option></select>
        <input type="number" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="w-24 rounded-xl border px-3 py-2.5 text-sm" />
        <input type="number" placeholder="Max ₹" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} className="w-24 rounded-xl border px-3 py-2.5 text-sm" />
        <button onClick={add} data-testid="add-promo" className="bg-orange-500 text-white rounded-full px-5 py-2.5 text-sm font-semibold flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y">
        {rows.map((p) => (
          <div key={p.code} className="flex items-center justify-between p-4">
            <div><p className="font-semibold text-slate-800 text-sm">{p.code}</p><p className="text-xs text-slate-400">{p.type === "percent" ? `${p.value}% off (max ₹${p.max_discount || "—"})` : `₹${p.value} off`}</p></div>
            <button onClick={() => del(p.code)}><Trash2 className="h-4 w-4 text-slate-400" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Banners() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ title: "", subtitle: "", cta: "", order: 0, active: true });
  const load = () => api.get("/admin/banners").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!form.title) return toast.error("Title required"); await api.post("/admin/banners", { ...form, order: rows.length }); setForm({ title: "", subtitle: "", cta: "", order: 0, active: true }); load(); };
  const del = async (id) => { await api.delete(`/admin/banners/${id}`); load(); };
  if (!rows) return <Loader />;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-2 items-end">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="banner-title" className="flex-1 min-w-40 rounded-xl border px-3 py-2.5 text-sm" />
        <input placeholder="Subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="flex-1 min-w-40 rounded-xl border px-3 py-2.5 text-sm" />
        <input placeholder="CTA" value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} className="w-32 rounded-xl border px-3 py-2.5 text-sm" />
        <button onClick={add} data-testid="add-banner" className="bg-orange-500 text-white rounded-full px-5 py-2.5 text-sm font-semibold flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y">
        {rows.map((b) => (
          <div key={b.id} className="flex items-center justify-between p-4"><div><p className="font-semibold text-slate-800 text-sm">{b.title}</p><p className="text-xs text-slate-400">{b.subtitle}</p></div><button onClick={() => del(b.id)}><Trash2 className="h-4 w-4 text-slate-400" /></button></div>
        ))}
      </div>
    </div>
  );
}

function Faqs() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ question: "", answer: "", order: 0, active: true });
  const load = () => api.get("/admin/faqs").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!form.question) return toast.error("Question required"); await api.post("/admin/faqs", { ...form, order: rows.length }); setForm({ question: "", answer: "", order: 0, active: true }); load(); };
  const del = async (id) => { await api.delete(`/admin/faqs/${id}`); load(); };
  if (!rows) return <Loader />;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        <input placeholder="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} data-testid="faq-question" className="w-full rounded-xl border px-3 py-2.5 text-sm" />
        <textarea placeholder="Answer" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="w-full rounded-xl border px-3 py-2.5 text-sm h-20" />
        <button onClick={add} data-testid="add-faq" className="bg-orange-500 text-white rounded-full px-5 py-2.5 text-sm font-semibold flex items-center gap-1"><Plus className="h-4 w-4" /> Add FAQ</button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y">
        {rows.map((f) => (
          <div key={f.id} className="flex items-start justify-between p-4"><div><p className="font-semibold text-slate-800 text-sm">{f.question}</p><p className="text-xs text-slate-400 mt-0.5">{f.answer}</p></div><button onClick={() => del(f.id)}><Trash2 className="h-4 w-4 text-slate-400" /></button></div>
        ))}
      </div>
    </div>
  );
}

function Policies() {
  const [rows, setRows] = useState(null);
  const load = () => api.get("/admin/policies").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const save = async (p) => { try { await api.put(`/admin/policies/${p.key}`, { key: p.key, title: p.title, content: p.content }); toast.success("Saved"); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };
  if (!rows) return <Loader />;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">⚠ These are editable placeholder templates. All legal documents require professional review before launch (India DPDP Act & consumer law).</div>
      {rows.map((p, i) => (
        <div key={p.key} className="bg-white rounded-2xl border border-slate-200 p-4" data-testid={`policy-edit-${p.key}`}>
          <input value={p.title} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} className="w-full font-semibold rounded-xl border px-3 py-2 text-sm mb-2" />
          <textarea value={p.content} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, content: e.target.value } : x))} className="w-full rounded-xl border px-3 py-2 text-sm h-28" />
          <button onClick={() => save(p)} data-testid={`save-policy-${p.key}`} className="mt-2 bg-orange-500 text-white rounded-full px-5 py-2 text-sm font-semibold">Save</button>
        </div>
      ))}
    </div>
  );
}
