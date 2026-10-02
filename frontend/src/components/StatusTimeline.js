import React from "react";
import { STATUS_LABELS } from "@/lib/i18n";
import { Check } from "lucide-react";

export default function StatusTimeline({ timeline = [] }) {
  if (!timeline.length) return null;
  return (
    <div className="space-y-0" data-testid="status-timeline">
      {timeline.map((s, i) => {
        const last = i === timeline.length - 1;
        return (
          <div key={s.id || i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`h-3.5 w-3.5 rounded-full mt-1.5 ${last ? "bg-orange-500 ring-4 ring-orange-100" : "bg-emerald-500"}`}>
                {!last && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </div>
              {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
            </div>
            <div className={`pb-5 ${last ? "" : ""}`}>
              <p className={`text-sm font-semibold ${last ? "text-orange-600" : "text-slate-800"}`}>
                {STATUS_LABELS[s.status] || s.label || s.status}
              </p>
              {s.note ? <p className="text-xs text-slate-500">{s.note}</p> : null}
              <p className="text-[11px] text-slate-400">{new Date(s.created_at).toLocaleString("en-IN")}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
