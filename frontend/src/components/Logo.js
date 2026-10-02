import React from "react";

// Text-based logo treatment. Replace with official brand asset later.
export default function Logo({ size = "md", className = "", onDark = false }) {
  const sizes = { sm: "text-lg", md: "text-2xl", lg: "text-4xl", xl: "text-5xl" };
  return (
    <span className={`font-head font-extrabold tracking-tight ${sizes[size]} ${className}`} data-testid="app-logo">
      <span className={onDark ? "text-white" : "text-slate-900"}>Intown</span>
      <span className="text-orange-500">PA</span>
    </span>
  );
}
