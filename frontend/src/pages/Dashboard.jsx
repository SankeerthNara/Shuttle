import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getUser, loadRazorpay } from "../lib/api";
import { isNativePlatform, openNativeCheckout } from "../lib/nativeRazorpay";
import { toast } from "sonner";
import Header from "../components/Header";
import QRCode from "react-qr-code";
import { CalendarDays, Plus, Users, Clock, Sun, Moon, Loader2, Check, ScanFace, RefreshCw } from "lucide-react";

const monthKey = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
};
const formatMonth = (m) => {
  const [y, mm] = m.split("-");
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};

export default function Dashboard() {
  const user = getUser();
  const [month, setMonth] = useState(monthKey(0));
  const [slots, setSlots] = useState([]);
  const [hasBooking, setHasBooking] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [config, setConfig] = useState(null);
  const [loadingSlot, setLoadingSlot] = useState(null);
  const [qrToken, setQrToken] = useState(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [pendingSlot, setPendingSlot] = useState(null);

  const loadAll = async (m = month) => {
    try {
      const [a, b, c] = await Promise.all([
        api.get(`/slots/availability?month=${m}`),
        api.get(`/bookings/me`),
        config ? Promise.resolve({ data: config }) : api.get(`/config`),
      ]);
      setSlots(a.data.slots);
      setHasBooking(a.data.user_has_booking);
      setBookings(b.data);
      if (!config) setConfig(c.data);
    } catch (e) {
      toast.error("Failed to load");
    }
  };

  useEffect(() => {
    loadAll();
    api.get("/me/qr-token").then((r) => setQrToken(r.data.qr_token)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (config) loadAll(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const regenerateQr = async () => {
    if (!window.confirm("This invalidates your current entry pass QR. Continue?")) return;
    setRegenLoading(true);
    try {
      const { data } = await api.post("/me/qr-token/regenerate");
      setQrToken(data.qr_token);
      toast.success("New entry pass generated");
    } catch (e) {
      toast.error("Could not regenerate QR code");
    } finally {
      setRegenLoading(false);
    }
  };

  const bookSlot = async (slot) => {
    if (slot.is_yours) return;
    if (slot.available === 0) return toast.error("Slot is full");
    if (hasBooking) return toast.error("You already have a booking for this month");
    setPendingSlot(slot);
  };

  const confirmAndPay = async () => {
    const slot = pendingSlot;
    if (!slot) return;
    setLoadingSlot(slot.id);
    try {
      const { data } = await api.post("/bookings/init", { slot_id: slot.id, month });

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: "Colony Badminton Court",
        description: `Monthly slot · ${slot.label} · ${formatMonth(month)}`,
        prefill: { name: user.name, contact: user.mobile },
        theme: { color: "var(--primary)" },
      };

      if (isNativePlatform()) {
        const response = await openNativeCheckout(options);
        await api.post("/bookings/verify", {
          booking_id: data.booking_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        toast.success("Booking confirmed!");
        loadAll();
        setLoadingSlot(null);
      } else {
        const ok = await loadRazorpay();
        if (!ok) throw new Error("Could not load payment gateway");

        const rzp = new window.Razorpay({
          ...options,
          handler: async (response) => {
            try {
              await api.post("/bookings/verify", {
                booking_id: data.booking_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success("Booking confirmed!");
              loadAll();
            } catch (err) {
              toast.error(err?.response?.data?.detail || "Verification failed");
            } finally {
              setLoadingSlot(null);
            }
          },
          modal: {
            ondismiss: () => setLoadingSlot(null),
          },
        });
        rzp.on("payment.failed", () => {
          toast.error("Payment failed");
          setLoadingSlot(null);
        });
        rzp.open();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || "Could not book");
      setLoadingSlot(null);
    } finally {
      setPendingSlot(null);
    }
  };

  const morningSlots = slots.filter((s) => Number(s.id) < 1200);
  const eveningSlots = slots.filter((s) => Number(s.id) >= 1200);

  return (
    <div className="min-h-screen" data-testid="dashboard-page">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10">
        {/* Hero strip */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-10">
          <div className="md:col-span-8">
            <div className="label-eyebrow mb-2">Hello, {user?.name}</div>
            <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none">
              Your <span className="text-[var(--primary)]">court</span> dashboard.
            </h1>
          </div>
          <div className="md:col-span-4 border border-[var(--border)] bg-[var(--surface)] rounded-md p-5">
            <div className="label-eyebrow flex items-center gap-2">
              <CalendarDays className="w-3 h-3" /> Booking month
            </div>
            <div className="flex gap-2 mt-3">
              {[0, 1, 2].map((o) => {
                const m = monthKey(o);
                const active = m === month;
                return (
                  <button
                    key={m}
                    onClick={() => setMonth(m)}
                    className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-sm border ${
                      active
                        ? "bg-[var(--primary)] border-[var(--primary)] text-[var(--text)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border)]"
                    }`}
                    data-testid={`month-tab-${o}`}
                  >
                    {formatMonth(m).split(" ")[0]}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-[var(--muted)]">
              Showing: <span className="text-[var(--text)] font-bold">{formatMonth(month)}</span>
            </div>
          </div>
        </div>

        {/* Entry pass */}
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-md p-6 mb-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="bg-white p-3 rounded-md shrink-0">
            {qrToken ? (
              <QRCode value={qrToken} size={112} bgColor="#ffffff" fgColor="#000000" data-testid="entry-pass-qr" />
            ) : (
              <div className="w-[112px] h-[112px] flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--bg)]" />
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="label-eyebrow mb-2 flex items-center gap-2 justify-center sm:justify-start">
              <ScanFace className="w-3.5 h-3.5" /> Entry pass
            </div>
            <div className="font-display text-xl font-bold uppercase tracking-tight">Show this at the gate</div>
            <p className="text-sm text-[var(--muted)] mt-1 max-w-md">
              The gatekeeper scans this to confirm your identity and booking. Don't share it — anyone with
              this code can be scanned in as you.
            </p>
          </div>
          <button
            onClick={regenerateQr}
            disabled={regenLoading}
            className="btn-secondary text-xs shrink-0"
            data-testid="regenerate-qr-btn"
          >
            {regenLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Regenerate
          </button>
        </div>

        {/* Slot board */}
        <SlotSection title="Morning" icon={Sun} slots={morningSlots} bookSlot={bookSlot} hasBooking={hasBooking} loadingSlot={loadingSlot} fee={config?.monthly_fee} />
        <div className="h-8" />
        <SlotSection title="Evening" icon={Moon} slots={eveningSlots} bookSlot={bookSlot} hasBooking={hasBooking} loadingSlot={loadingSlot} fee={config?.monthly_fee} />

        {/* My bookings */}
        <div className="mt-14">
          <div className="label-eyebrow mb-3">Your booking history</div>
          <div className="border border-[var(--border)] rounded-md overflow-x-auto">
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted)] text-sm bg-[var(--surface)]">No bookings yet. Pick a slot above.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface)] text-left">
                  <tr className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    <th className="p-4">Month</th>
                    <th className="p-4">Slot</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Booked at</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_30%,transparent)]" data-testid={`booking-row-${b.id}`}>
                      <td className="p-4 font-bold">{formatMonth(b.month)}</td>
                      <td className="p-4">{b.slot_label}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-sm ${b.status === "confirmed" ? "bg-[#34C759]/15 text-[#34C759]" : "bg-yellow-500/15 text-yellow-500"}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono">₹{(b.amount / 100).toLocaleString("en-IN")}</td>
                      <td className="p-4 text-xs text-[var(--muted)]">{new Date(b.created_at).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Confirm & pay modal */}
      {pendingSlot && (
        <div
          className="fixed inset-0 bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !loadingSlot && setPendingSlot(null)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
            data-testid="confirm-booking-modal"
          >
            <div className="label-eyebrow mb-2 flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5" /> Confirm booking
            </div>
            <h3 className="font-display text-2xl font-black uppercase tracking-tight">{pendingSlot.label}</h3>
            <div className="mt-5 border border-[var(--border)] rounded-md divide-y divide-[var(--border)] text-sm">
              <div className="flex justify-between p-3">
                <span className="text-[var(--muted)]">Month</span>
                <span className="font-bold">{formatMonth(month)}</span>
              </div>
              <div className="flex justify-between p-3">
                <span className="text-[var(--muted)]">Slot</span>
                <span className="font-bold">{pendingSlot.label}</span>
              </div>
              <div className="flex justify-between p-3">
                <span className="text-[var(--muted)]">Amount</span>
                <span className="font-bold text-[var(--primary)]">₹{config?.monthly_fee ?? "—"}</span>
              </div>
            </div>
            <p className="text-xs text-[var(--muted)] mt-4">
              This locks {pendingSlot.label} for you every day through {formatMonth(month)}. You'll be taken to Razorpay to complete payment.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setPendingSlot(null)}
                disabled={loadingSlot === pendingSlot.id}
                className="btn-secondary text-xs flex-1 justify-center"
                data-testid="cancel-booking-btn"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndPay}
                disabled={loadingSlot === pendingSlot.id}
                className="btn-primary text-xs flex-1 justify-center"
                data-testid="confirm-and-pay-btn"
              >
                {loadingSlot === pendingSlot.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Confirm & Pay</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SlotSection({ title, icon: Icon, slots, bookSlot, hasBooking, loadingSlot, fee }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4 text-[var(--primary)]" />
          <div className="label-eyebrow">{title} slots</div>
        </div>
        {fee && <div className="text-xs text-[var(--muted)] font-mono">₹{fee}/month per slot</div>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {slots.map((s) => {
          const full = s.available === 0;
          const mine = s.is_yours;
          const disabled = full || mine || (hasBooking && !mine);
          const isLoading = loadingSlot === s.id;
          return (
            <button
              key={s.id}
              onClick={() => bookSlot(s)}
              disabled={disabled || isLoading}
              data-testid={`book-slot-${s.id}`}
              className={`text-left border rounded-md p-5 transition-colors group relative ${
                mine
                  ? "border-[#34C759]/40 bg-[#34C759]/5"
                  : full
                  ? "border-[var(--border)] bg-[var(--surface)] opacity-40 cursor-not-allowed"
                  : hasBooking
                  ? "border-[var(--border)] bg-[var(--surface)] opacity-50 cursor-not-allowed"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between">
                <Clock className="w-3.5 h-3.5 text-[var(--muted)]" />
                {mine && (
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#34C759] flex items-center gap-1">
                    <Check className="w-3 h-3" /> Yours
                  </span>
                )}
                {full && !mine && <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--primary)]">Full</span>}
              </div>
              <div className="font-display text-2xl font-black uppercase tracking-tight mt-3 leading-none">{s.label}</div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-[var(--muted)]">
                  <Users className="w-3 h-3" /> {s.booked}/{s.capacity}
                </span>
                {!disabled && !isLoading && <Plus className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--primary)]" />}
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />}
              </div>
              {/* Capacity bar */}
              <div className="mt-3 h-1 bg-[var(--bg)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${mine ? "bg-[#34C759]" : full ? "bg-[var(--primary)]" : "bg-[color-mix(in_srgb,var(--primary)_60%,transparent)]"}`}
                  style={{ width: `${(s.booked / s.capacity) * 100}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
