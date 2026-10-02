import React from "react";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/i18n";

export default function StatusBadge({ status, className = "" }) {
  const color = STATUS_COLORS[status] || "bg-slate-100 text-slate-700";
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${color} ${className}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
