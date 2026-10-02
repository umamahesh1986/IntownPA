import React from "react";
import { Outlet } from "react-router-dom";
import { ClipboardList, Wallet, User } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const items = [
  { to: "/pa", label: "Tasks", icon: ClipboardList, end: true },
  { to: "/pa/earnings", label: "Earnings", icon: Wallet },
  { to: "/pa/profile", label: "Profile", icon: User },
];

export default function PALayout() {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 relative overflow-x-hidden pb-20">
      <Outlet />
      <BottomNav items={items} />
    </div>
  );
}
