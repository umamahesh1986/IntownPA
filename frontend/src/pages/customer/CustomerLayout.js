import React from "react";
import { Outlet } from "react-router-dom";
import { Home, ClipboardList, MessageCircle, User } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const items = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/tasks", label: "My Tasks", icon: ClipboardList },
  { to: "/app/chat", label: "Chat", icon: MessageCircle },
  { to: "/app/profile", label: "Profile", icon: User },
];

export default function CustomerLayout() {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 relative overflow-x-hidden pb-20">
      <Outlet />
      <BottomNav items={items} />
    </div>
  );
}
