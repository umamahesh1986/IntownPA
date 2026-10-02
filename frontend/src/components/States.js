import React from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ icon: Icon = Inbox, title, subtitle, action, testid = "empty-state" }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6" data-testid={testid}>
      <div className="h-16 w-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-orange-400" />
      </div>
      <p className="font-head font-semibold text-slate-800">{title}</p>
      {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-xs">{subtitle}</p>}
      {action}
    </div>
  );
}

export function Loader({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" data-testid="loader">
      <div className="h-8 w-8 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
      <p className="text-sm text-slate-400 mt-3">{label}</p>
    </div>
  );
}
