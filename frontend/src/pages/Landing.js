import React from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Camera, CheckCircle2, Truck, MapPin, ShieldCheck, ArrowRight, Search, Gift, Shirt, Smartphone } from "lucide-react";
import Logo from "@/components/Logo";

const STEPS = [
  { icon: ShoppingBag, title: "Book a PA", desc: "Tell us what you need from any local shop or market." },
  { icon: Camera, title: "Show Me Before You Buy", desc: "Your PA sends real photos, prices & details." },
  { icon: CheckCircle2, title: "You approve", desc: "Nothing is purchased until you approve product & price." },
  { icon: Truck, title: "Delivered", desc: "Your PA buys it and delivers to your door." },
];

const CATS = [
  { icon: ShoppingBag, name: "Local Shopping" }, { icon: Search, name: "Price Comparison" },
  { icon: Shirt, name: "Clothing" }, { icon: Smartphone, name: "Electronics" },
  { icon: Gift, name: "Gifts" }, { icon: MapPin, name: "Local Errands" },
];

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo size="md" />
          <button onClick={() => nav("/login")} data-testid="header-login-btn"
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold px-5 py-2.5 text-sm transition-colors active:scale-95">
            Get Started
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-10 pb-16 grid md:grid-cols-2 gap-10 items-center">
        <div className="animate-slide-up">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 text-orange-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide">
            <MapPin className="h-3.5 w-3.5" /> Now in Hyderabad
          </span>
          <h1 className="font-head text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mt-5 leading-[1.05]">
            You Can't Go?<br /><span className="text-orange-500">Send IntownPA.</span>
          </h1>
          <p className="text-lg text-slate-600 mt-5 max-w-md">
            Verified personal assistants shop local markets for you. The signature promise —
            <span className="font-bold text-slate-900"> Show Me Before You Buy.</span>
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <button onClick={() => nav("/login")} data-testid="hero-book-btn"
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold px-7 py-3.5 flex items-center gap-2 transition-colors active:scale-95 shadow-sm shadow-orange-200">
              Book a Personal Assistant <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => nav("/login")} data-testid="hero-pa-btn"
              className="bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-full font-semibold px-7 py-3.5 transition-colors">
              Become a PA
            </button>
          </div>
          <div className="flex items-center gap-5 mt-8 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Verified PAs</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Approve before buy</span>
          </div>
        </div>
        <div className="relative">
          <img src="https://images.unsplash.com/photo-1697425206245-250e9c651119?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
            alt="Local market in India" className="rounded-3xl shadow-xl w-full object-cover aspect-[4/5] md:aspect-square" />
          <div className="absolute -bottom-5 -left-3 bg-white rounded-2xl shadow-lg p-4 border border-slate-100 max-w-[220px]">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-orange-500 flex items-center justify-center"><Camera className="h-4 w-4 text-white" /></div>
              <div><p className="text-xs font-bold text-slate-900">New product photo</p><p className="text-[11px] text-slate-500">Tap to approve ₹620</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-5">
          <h2 className="font-head text-2xl sm:text-3xl font-bold text-slate-900 text-center">How IntownPA works</h2>
          <p className="text-slate-500 text-center mt-2">Your Personal Assistant for Everything Local</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
            {STEPS.map((s, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="h-11 w-11 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
                  <s.icon className="h-5 w-5 text-orange-500" />
                </div>
                <p className="font-head font-bold text-slate-900">{i + 1}. {s.title}</p>
                <p className="text-sm text-slate-500 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <h2 className="font-head text-2xl sm:text-3xl font-bold text-slate-900 text-center">Anything local, done for you</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-10">
          {CATS.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center text-center hover:border-orange-300 transition-colors">
              <c.icon className="h-7 w-7 text-orange-500" />
              <p className="text-sm font-semibold text-slate-700 mt-2">{c.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="bg-slate-900 rounded-3xl p-10 text-center">
          <h2 className="font-head text-2xl sm:text-3xl font-bold text-white">Ready to send your IntownPA?</h2>
          <p className="text-slate-300 mt-2">Launching in Hyderabad. Join now.</p>
          <button onClick={() => nav("/login")} data-testid="cta-btn"
            className="mt-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold px-8 py-3.5 transition-colors active:scale-95">
            Get Started
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        <Logo size="sm" /> · A product of Yagnavihar Lifestyle Private Limited, India
        <p className="mt-1 text-xs">intownlocal.com</p>
      </footer>
    </div>
  );
}
