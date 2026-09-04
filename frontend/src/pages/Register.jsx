import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api, { setSession, loadRazorpay } from "../lib/api";
import { isNativePlatform, openNativeCheckout } from "../lib/nativeRazorpay";
import { toast } from "sonner";
import Header from "../components/Header";
import { ArrowRight, ShieldCheck, Loader2, Briefcase, Users, UserRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const TYPE_ICONS = { employee: Briefcase, family: Users, visitor: UserRound };
const DEFAULT_DEPOSITS = {
  employee: { amount: 1000, cycle: "lifetime", label: "Employee" },
  family: { amount: 500, cycle: "lifetime", label: "Family member" },
  visitor: { amount: 1000, cycle: "yearly", label: "Visitor" },
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", mobile: "", email: "", flat_number: "", password: "", user_type: "employee" });
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState(DEFAULT_DEPOSITS);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  useEffect(() => {
    api.get("/config").then((r) => {
      if (r.data.deposits) setDeposits(r.data.deposits);
    }).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const selected = deposits[form.user_type] || DEFAULT_DEPOSITS[form.user_type];
  const cycleLabel = selected.cycle === "yearly" ? "per year" : "one-time, lifetime";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acceptedPolicy) {
      toast.error("Please accept the Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register/init", form);

      const finishRegistration = async (paymentResult) => {
        const verifyRes = await api.post("/auth/register/verify", {
          pending_user_id: data.pending_user_id,
          razorpay_order_id: paymentResult.razorpay_order_id,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_signature: paymentResult.razorpay_signature,
        });
        setSession(verifyRes.data.token, verifyRes.data.user);
        toast.success("Welcome! Deposit received.");
        navigate("/dashboard");
      };

      // Native Android app: use Razorpay's native SDK (required — the web Standard Checkout
      // has known issues with UPI/netbanking/popups inside a WebView).
      if (isNativePlatform()) {
        try {
          const result = await openNativeCheckout({
            key: data.key_id,
            amount: data.amount,
            currency: data.currency,
            order_id: data.order_id,
            name: "Colony Badminton Court",
            description: `${selected.label} security deposit`,
            prefill: { name: data.name, contact: data.mobile },
          });
          await finishRegistration(result);
        } catch (err) {
          toast.error(err?.message || "Payment was not completed");
        } finally {
          setLoading(false);
        }
        return;
      }

      // Web: Razorpay's browser Standard Checkout (unchanged)
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load payment gateway");

      const primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim() || "#FF3B30";

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: "Colony Badminton Court",
        description: `${selected.label} security deposit`,
        prefill: { name: data.name, contact: data.mobile },
        theme: { color: primaryColor },
        handler: async (response) => {
          try {
            await finishRegistration(response);
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
                  ₹{selected.amount.toLocaleString("en-IN")} security deposit ({cycleLabel}) to verify you as a{" "}
                  {selected.label.toLowerCase()}. This deposit is non-refundable.
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-px bg-[var(--surface-hover)] border border-[var(--border)]">
              <div className="bg-[var(--surface)] p-4">
                <div className="label-eyebrow">Deposit</div>
                <div className="font-display text-3xl font-black mt-1">₹{selected.amount.toLocaleString("en-IN")}</div>
              </div>
              <div className="bg-[var(--surface)] p-4">
                <div className="label-eyebrow">Billing</div>
                <div className="font-display text-lg font-black text-[var(--primary)] mt-1 capitalize">{selected.cycle}</div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="md:col-span-7 md:col-start-7 border border-[var(--border)] bg-[var(--surface)] p-8 rounded-md" data-testid="register-form">
          <div className="label-eyebrow mb-4">Membership type</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {Object.entries(deposits).map(([key, cfg]) => {
              const Icon = TYPE_ICONS[key] || UserRound;
              const isActive = form.user_type === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, user_type: key })}
                  data-testid={`register-user-type-${key}`}
                  className={`text-left border rounded-md p-4 transition-colors ${
                    isActive
                      ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
                      : "border-[var(--border)] hover:border-[var(--primary)]"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-3 ${isActive ? "text-[var(--primary)]" : "text-[var(--muted)]"}`} />
                  <div className="font-display font-bold uppercase text-sm tracking-tight">{cfg.label}</div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    ₹{cfg.amount.toLocaleString("en-IN")} · {cfg.cycle === "yearly" ? "per year" : "lifetime"}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="label-eyebrow mb-6">Your details</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name" value={form.name} onChange={set("name")} required testid="name" />
            <Field label="Mobile (10 digits)" value={form.mobile} onChange={set("mobile")} required testid="mobile" maxLength={10} />
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
              On submit you'll be taken to Razorpay to pay ₹{selected.amount.toLocaleString("en-IN")} ({cycleLabel}, non-refundable).
              Your account activates after successful payment.
            </p>
            <button
              type="submit"
              disabled={loading || !acceptedPolicy}
              className="btn-primary"
              data-testid="register-submit"
              title={!acceptedPolicy ? "Accept the Privacy Policy to continue" : undefined}
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
