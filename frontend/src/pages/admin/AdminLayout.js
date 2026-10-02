import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import {
  LayoutDashboard, Users, BriefcaseBusiness, ClipboardList, IndianRupee,
  CreditCard, FileCog, LogOut, Menu, X,
} from "lucide-react";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/admin/pas", label: "Personal Assistants", icon: BriefcaseBusiness },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/pricing", label: "Pricing", icon: IndianRupee },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/content", label: "Content", icon: FileCog },
];

export default function AdminLayout() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const Sidebar = () => (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-slate-800"><Logo size="md" onDark /></div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
            data-testid={`admin-nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-orange-500 text-white" : "hover:bg-slate-800 text-slate-300"}`}>
            <n.icon className="h-4 w-4" /> {n.label}
          </NavLink>
        ))}
      </nav>
      <button onClick={() => { logout(); nav("/"); }} data-testid="admin-logout" className="m-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-slate-800">
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[256px_1fr]">
      <div className="hidden lg:block fixed inset-y-0 w-64"><Sidebar /></div>
      <div className="hidden lg:block" />
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64"><Sidebar /></div>
        </div>
      )}
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 h-16 flex items-center justify-between px-5">
          <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="admin-menu-toggle"><Menu className="h-6 w-6" /></button>
          <div className="hidden lg:block"><p className="text-sm text-slate-400">Admin Dashboard · Hyderabad</p></div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">{(user?.name || "A").charAt(0)}</div>
              <span className="text-sm font-semibold text-slate-700 hidden sm:block">{user?.name}</span></div>
          </div>
        </header>
        <main className="flex-1 p-5 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
