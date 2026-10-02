import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function NotificationBell() {
  const [data, setData] = useState({ items: [], unread: 0 });

  const load = async () => {
    try {
      const res = await api.get("/notifications");
      setData(res.data);
    } catch {}
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const markAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors" data-testid="notification-bell">
          <Bell className="h-5 w-5 text-slate-700" />
          {data.unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center"
              data-testid="notification-count">
              {data.unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white">
          <p className="font-semibold text-sm">Notifications</p>
          {data.unread > 0 && (
            <button onClick={markAll} className="text-xs text-orange-500 font-semibold" data-testid="mark-all-read">
              Mark all read
            </button>
          )}
        </div>
        {data.items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No notifications yet</p>
        ) : (
          data.items.map((n) => (
            <div key={n.id} className={`px-4 py-3 border-b last:border-0 ${n.read ? "" : "bg-orange-50/50"}`}
              data-testid={`notification-${n.id}`}>
              <p className="text-sm font-semibold text-slate-800">{n.title}</p>
              {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
              <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString("en-IN")}</p>
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
