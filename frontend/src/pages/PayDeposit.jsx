import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Header from "../components/Header";
import api, { getUser, setSession, loadRazorpay } from "../lib/api";

const DEFAULT_DEPOSITS = {
  employee: { amount: 1000, cycle: "lifetime", label: "Employee" },
  family: { amount: 500, cycle: "lifetime", label: "Family member" },
  visitor: { amount: 1000, cycle: "yearly", label: "Visitor" },
};

export default function PayDeposit() {
  const user = getUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState(DEFAULT_DEPOSITS);

  useEffect(() => {
    api.get("/config").then((r) => {
      if (r.data.deposits) setDeposits(r.data.deposits);
    }).catch(() => {});
  }, []);

  const userType = user?.user_type || "employee";
  const info = deposits[userType] || DEFAULT_DEPOSITS[userType];
  const isRenewal = info.cycle === "yearly" && !!user?.deposit_valid_until;

  const handlePay = async () => {
    setLoading(true);
    try {
      const ready = await loadRazorpay();
      if (!ready) {
        toast.error("Payment gateway failed to load. Check your connection.");
        setLoading(false);
        return;
      }
      const { data } = await api.post("/deposit/init");

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "The Court",
        description: isRenewal ? "Annual visitor deposit renewal" : "Safety Deposit",
        order_id: data.order_id,
        handler: async (response) => {
          try {
            const verify = await api.post("/deposit/verify", {
              pending_user_id: user.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setSession(verify.data.token, verify.data.user);
            toast.success("Deposit paid! Dashboard unlocked.");
            navigate("/dashboard");
          } catch (e) {
            toast.error(e?.response?.data?.detail || "Verification failed");
          }
        },
        prefill: { name: user.name, contact: user.mobile },
        theme: { color: "var(--primary)" },
        modal: { ondismiss: () => setLoading(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to initiate payment");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" data-testid="pay-deposit-page">
      <Header />
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <ShieldCheck className="w-12 h-12 text-[var(--primary)] mx-auto mb-6" />
        <h1 className="font-display text-4xl font-black uppercase tracking-tighter mb-4">
          {isRenewal ? "Renew Safety Deposit" : "Pay Safety Deposit"}
        </h1>
        <p className="text-[var(--muted)] mb-10">
          {info.cycle === "yearly"
            ? `Pay your ₹${info.amount.toLocaleString("en-IN")} annual visitor deposit to unlock your Dashboard and start booking slots.`
            : `Pay a one-time ₹${info.amount.toLocaleString("en-IN")} safety deposit to unlock your Dashboard and start booking slots.`}
        </p>
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-md p-6 mb-10 flex justify-between items-center">
          <div>
            <div className="label-eyebrow mb-1">Deposit Amount</div>
            <div className="font-display text-3xl font-black">₹{info.amount.toLocaleString("en-IN")}</div>
          </div>
          <div>
            <div className="label-eyebrow mb-1">Billing</div>
            <div className="font-display text-3xl font-black text-[var(--primary)] capitalize">{info.cycle}</div>
          </div>
        </div>
        <button
          onClick={handlePay}
          disabled={loading}
          className="btn-primary w-full justify-center text-base"
          data-testid="pay-deposit-btn"
        >
          {loading ? "Processing..." : `Pay ₹${info.amount.toLocaleString("en-IN")} & Unlock Dashboard →`}
        </button>
      </div>
    </div>
  );
}
