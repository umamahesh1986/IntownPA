import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import Logo from "@/components/Logo";
import { toast } from "sonner";
import { Smartphone, ShoppingBag, Briefcase, ArrowLeft, Loader2 } from "lucide-react";

export default function Login() {
  const nav = useNavigate();
  const { sendOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("customer");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const digits = mobile.replace(/\D/g, "");
    if (digits.length !== 10) return toast.error("Enter a valid 10-digit mobile number");
    setLoading(true);
    try {
      const res = await sendOtp(digits);
      if (res.dev_otp) { setDevOtp(res.dev_otp); setOtp(res.dev_otp); }
      setStep(2);
      toast.success("OTP sent");
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (otp.length < 4) return toast.error("Enter the OTP");
    setLoading(true);
    try {
      const data = await verifyOtp(mobile.replace(/\D/g, ""), otp, name, role);
      const r = data.user.role;
      toast.success(`Welcome${data.user.name ? ", " + data.user.name : ""}!`);
      nav(r === "admin" ? "/admin" : r === "pa" ? "/pa" : "/app", { replace: true });
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col px-6 py-8">
        <button onClick={() => (step === 2 ? setStep(1) : nav("/"))} className="text-slate-500 flex items-center gap-1 text-sm mb-6" data-testid="login-back">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="text-slate-500 mt-2 text-sm">You Can't Go? Send IntownPA.</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm animate-slide-up">
          {step === 1 ? (
            <>
              <h1 className="font-head text-xl font-bold text-slate-900">Login or Sign up</h1>
              <p className="text-sm text-slate-500 mt-1">We'll send a one-time password to your mobile.</p>

              <label className="block text-xs font-semibold text-slate-600 mt-5 mb-2">I want to join as</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setRole("customer")} data-testid="role-customer"
                  className={`rounded-2xl border p-3 flex flex-col items-center gap-1 transition-colors ${role === "customer" ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-500"}`}>
                  <ShoppingBag className="h-5 w-5" /><span className="text-xs font-semibold">Customer</span>
                </button>
                <button onClick={() => setRole("pa")} data-testid="role-pa"
                  className={`rounded-2xl border p-3 flex flex-col items-center gap-1 transition-colors ${role === "pa" ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-500"}`}>
                  <Briefcase className="h-5 w-5" /><span className="text-xs font-semibold">Personal Assistant</span>
                </button>
              </div>

              <label className="block text-xs font-semibold text-slate-600 mt-4 mb-1">Name (for new accounts)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" data-testid="login-name"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" />

              <label className="block text-xs font-semibold text-slate-600 mt-4 mb-1">Mobile number</label>
              <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-orange-500">
                <span className="px-3 py-3 bg-slate-50 text-slate-500 text-sm flex items-center gap-1 border-r"><Smartphone className="h-4 w-4" />+91</span>
                <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit number" inputMode="numeric" maxLength={10} data-testid="login-mobile"
                  className="flex-1 px-3 py-3 text-sm focus:outline-none" />
              </div>

              <button onClick={handleSend} disabled={loading} data-testid="send-otp-btn"
                className="w-full mt-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-full font-semibold py-3.5 transition-colors active:scale-95 flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send OTP
              </button>
            </>
          ) : (
            <>
              <h1 className="font-head text-xl font-bold text-slate-900">Enter OTP</h1>
              <p className="text-sm text-slate-500 mt-1">Sent to +91 {mobile}</p>
              {devOtp && (
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800" data-testid="dev-otp-notice">
                  Development OTP: <span className="font-bold">{devOtp}</span>
                </div>
              )}
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="6-digit OTP" inputMode="numeric" maxLength={6} data-testid="otp-input"
                className="w-full mt-4 rounded-xl border border-slate-200 px-4 py-3 text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" />
              <button onClick={handleVerify} disabled={loading} data-testid="verify-otp-btn"
                className="w-full mt-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-full font-semibold py-3.5 transition-colors active:scale-95 flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Verify & Continue
              </button>
              <button onClick={handleSend} className="w-full mt-3 text-sm text-orange-500 font-semibold" data-testid="resend-otp">Resend OTP</button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By continuing you agree to IntownPA's Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
