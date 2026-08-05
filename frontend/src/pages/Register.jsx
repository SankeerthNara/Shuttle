import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api, { setSession, loadRazorpay } from "../lib/api";
import { toast } from "sonner";
import Header from "../components/Header";
import { ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMobileOtp } from "../hooks/useMobileOtp";
import MobileOtpField, { RECAPTCHA_CONTAINER_ID } from "../components/MobileOtpField";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", mobile: "", email: "", flat_number: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [deposit, setDeposit] = useState(1000);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const otp = useMobileOtp(RECAPTCHA_CONTAINER_ID);

  useEffect(() => {
    api.get("/config").then((r) => setDeposit(r.data.security_deposit)).catch(() => {});
  }, []);

  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (k === "mobile") otp.onMobileChanged(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.otpStatus !== "verified" || !otp.firebaseIdToken) {
      toast.error("Please verify your mobile number with the OTP first.");
      return;
    }
    if (!acceptedPolicy) {
      toast.error("Please accept the Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load payment gateway");

      const { data } = await api.post("/auth/register/init", {
        ...form,
        firebase_id_token: otp.firebaseIdToken,
      });

      const primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim() || "#FF3B30";

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: "Colony Badminton Court",
        description: "One-time security deposit",
        prefill: { name: data.name, contact: data.mobile },
        theme: { color: primaryColor },
        handler: async (response) => {
          try {
            const verifyRes = await api.post("/auth/register/verify", {
              pending_user_id: data.pending_user_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setSession(verifyRes.data.token, verifyRes.data.user);
            toast.success("Welcome! Deposit received.");
            navigate("/dashboard");
          } catch (err) {
            toast.error(err?.response?.data?.detail || "Payment verification failed");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast("Payment cancelled. You can complete it again.", { description: "Your account is pending." });
          },
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (r) => {
        toast.error(r?.error?.description || "Payment failed");
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || "Registration failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" data-testid="register-page">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12 grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="label-eyebrow mb-3">Become a member</div>
          <h1 className="font-display text-5xl sm:text-6xl font-black uppercase leading-[0.9] tracking-tighter">
            One <span className="text-[var(--primary)]">deposit</span>.<br />
            All courts.
          </h1>
          <div className="mt-10 border border-[var(--border)] bg-[var(--surface)] p-6 rounded-md">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--primary)_30%,transparent)] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div>
                <div className="font-display text-xl font-bold uppercase tracking-tight">Security deposit</div>
                <p className="text-sm text-[var(--muted)] mt-2">
                  ₹{deposit.toLocaleString("en-IN")} one-time security deposit to verify you as a colony resident. This
                  deposit is non-refundable.
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-px bg-[var(--surface-hover)] border border-[var(--border)]">
              <div className="bg-[var(--surface)] p-4">
                <div className="label-eyebrow">Deposit</div>
                <div className="font-display text-3xl font-black mt-1">₹{deposit.toLocaleString("en-IN")}</div>
              </div>
              <div className="bg-[var(--surface)] p-4">
                <div className="label-eyebrow">Refund</div>
                <div className="font-display text-3xl font-black text-[var(--primary)] mt-1">None</div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="md:col-span-7 md:col-start-7 border border-[var(--border)] bg-[var(--surface)] p-8 rounded-md" data-testid="register-form">
          <div className="label-eyebrow mb-6">Your details</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name" value={form.name} onChange={set("name")} required testid="name" />

            <MobileOtpField mobile={form.mobile} onMobileChange={set("mobile")} otp={otp} testidPrefix="register" />

            <Field label="Flat number" value={form.flat_number} onChange={set("flat_number")} testid="flat" />
            <Field label="Email (optional)" value={form.email} onChange={set("email")} type="email" testid="email" />
            <div className="sm:col-span-2">
              <Field label="Password (min 6 chars)" value={form.password} onChange={set("password")} type="password" required testid="password" />
            </div>
          </div>
          <div className="mt-6 flex items-start gap-3">
            <Checkbox
              id="accept-privacy-policy"
              checked={acceptedPolicy}
              onCheckedChange={(value) => setAcceptedPolicy(value === true)}
              data-testid="register-accept-privacy-checkbox"
              className="mt-0.5"
            />
            <label htmlFor="accept-privacy-policy" className="text-sm text-[var(--muted)] select-none cursor-pointer">
              I have read and accept the{" "}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:text-[var(--primary-hover)] font-bold">
                Privacy Policy
              </Link>
              .
            </label>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-[var(--muted)] max-w-sm">
              On submit you'll be taken to Razorpay to pay ₹{deposit.toLocaleString("en-IN")} (non-refundable deposit). Your account
              activates after successful payment.
            </p>
            <button
              type="submit"
              disabled={loading || !acceptedPolicy || otp.otpStatus !== "verified"}
              className="btn-primary"
              data-testid="register-submit"
              title={
                otp.otpStatus !== "verified"
                  ? "Verify your mobile number to continue"
                  : !acceptedPolicy
                  ? "Accept the Privacy Policy to continue"
                  : undefined
              }
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Pay & Register <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
          <p className="mt-6 text-sm text-[var(--muted)]">
            Already a member?{" "}
            <Link to="/login" className="text-[var(--primary)] hover:text-[var(--primary-hover)] font-bold" data-testid="link-login">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, testid, ...props }) {
  return (
    <label className="block">
      <span className="label-eyebrow block mb-2">{label}</span>
      <input
        {...props}
        data-testid={`register-${testid}-input`}
        className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none text-[var(--text)] rounded-md px-4 py-3 text-sm"
      />
    </label>
  );
}
