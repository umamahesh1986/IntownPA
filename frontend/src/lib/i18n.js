// Lightweight i18n. English-first; Telugu structure ready.
export const translations = {
  en: {
    tagline: "You Can't Go? Send IntownPA.",
    usp: "Show Me Before You Buy",
    supporting: "Your Personal Assistant for Everything Local",
    home: "Home", my_tasks: "My Tasks", chat: "Chat", profile: "Profile",
    tasks: "Tasks", earnings: "Earnings",
    book_pa: "Book a Personal Assistant",
    search_placeholder: "What do you need help with?",
    greeting: "Hi",
  },
  te: {
    tagline: "మీరు వెళ్లలేరా? IntownPA ని పంపండి.",
    usp: "కొనే ముందు చూపించు",
    supporting: "స్థానిక అవసరాలకు మీ వ్యక్తిగత సహాయకుడు",
    home: "హోమ్", my_tasks: "నా పనులు", chat: "చాట్", profile: "ప్రొఫైల్",
    tasks: "పనులు", earnings: "సంపాదన",
    book_pa: "పర్సనల్ అసిస్టెంట్‌ను బుక్ చేయండి",
    search_placeholder: "మీకు దేనికి సహాయం కావాలి?",
    greeting: "నమస్తే",
  },
};

export function t(key, lang = "en") {
  return (translations[lang] && translations[lang][key]) || translations.en[key] || key;
}

export const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Request submitted",
  awaiting_assignment: "Awaiting PA assignment",
  pa_assigned: "PA assigned",
  pa_travelling: "PA travelling",
  pa_arrived: "PA arrived",
  searching: "Searching for product",
  awaiting_approval: "Awaiting your approval",
  purchase_approved: "Purchase approved",
  purchase_completed: "Purchase completed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancellation_requested: "Cancellation requested",
  cancelled: "Cancelled",
  failed: "Failed",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  disputed: "Disputed",
};

export const STATUS_COLORS = {
  awaiting_approval: "bg-amber-100 text-amber-800",
  purchase_approved: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-slate-200 text-slate-700",
  awaiting_assignment: "bg-sky-100 text-sky-800",
};

export function inr(n) {
  const v = Number(n || 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
