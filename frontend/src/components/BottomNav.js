import React from "react";
import { NavLink } from "react-router-dom";

export default function BottomNav({ items }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 flex justify-around items-center h-16 pb-safe z-50"
      data-testid="bottom-nav">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end}
          data-testid={`nav-${it.label.toLowerCase().replace(/\s/g, "-")}`}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              isActive ? "text-orange-500" : "text-slate-400"
            }`
          }>
          {({ isActive }) => (
            <>
              <it.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[11px] font-semibold">{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
