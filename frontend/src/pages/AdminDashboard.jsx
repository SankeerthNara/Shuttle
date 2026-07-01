import { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import Header from "../components/Header";
import { Users, ClipboardList, Wallet, KeyRound, RefreshCw, Loader2 } from "lucide-react";

const tabs = [
  { id: "users", label: "Users", icon: Users },
  { id: "bookings", label: "Bookings", icon: ClipboardList },
  { id: "payments", label: "Payments", icon: Wallet },
];

export default function AdminDashboard() {
  const [active, setActive] = useState("users");
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Reset password modal
  const [pwUser, setPwUser] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showAllBookings, setShowAllBookings] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [u, b, p] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/bookings"),
        api.get("/admin/payments"),
      ]);
      setUsers(u.data);
      setBookings(b.data);
      setPayments(p.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const doResetPw = async () => {
    if (!newPw || newPw.length < 6) return toast.error("Min 6 chars");
    try {
      await api.post(`/admin/reset-password/${pwUser.id}`, { new_password: newPw });
      toast.success(`Password reset for ${pwUser.name}`);
      setPwUser(null);
      setNewPw("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Reset failed");
    }
  };

  return (
    <div className="min-h-screen" data-testid="admin-page">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="label-eyebrow mb-2">Control room</div>
            <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none">
              Admin <span className="text-[#FF3B30]">command</span>.
            </h1>
          </div>
          <button onClick={reload} className="btn-secondary text-xs" data-testid="reload-btn">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/10 mb-8">
          <StatCell label="Members" value={users.filter((u) => u.deposit_paid).length} />
          <StatCell label="Active bookings" value={bookings.filter((b) => b.status === "confirmed").length} />
          <StatCell label="Payments" value={payments.length} />
          <StatCell
            label="Revenue (₹)"
            value={(
              payments.filter((p) => p.amount > 0).reduce((a, p) => a + p.amount, 0) / 100
            ).toLocaleString("en-IN")}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 mb-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-5 py-3 text-xs uppercase tracking-wider font-bold flex items-center gap-2 border-b-2 ${
                active === t.id ? "border-[#FF3B30] text-white" : "border-transparent text-neutral-500 hover:text-white"
              }`}
              data-testid={`tab-${t.id}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {active === "users" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-neutral-500">
                {showAllUsers
                  ? `Showing all ${users.length} users`
                  : `Showing ${users.filter((u) => u.status === "active").length} active users`}
              </div>
              <button
                onClick={() => setShowAllUsers((v) => !v)}
                className="text-xs px-3 py-1.5 border border-white/10 hover:border-white/30 rounded-sm"
                data-testid="toggle-show-all-users"
              >
                {showAllUsers ? "Show active only" : "Show all"}
              </button>
            </div>
            <Table headers={["Name", "Mobile", "Flat", "Status", "Deposit", "Joined", ""]}>
              {users
                .filter((u) => showAllUsers || u.status === "active")
                .map((u) => (
                <tr key={u.id} className="border-t border-white/5" data-testid={`user-row-${u.id}`}>
                  <td className="p-4 font-bold">{u.name} {u.role === "admin" && <span className="text-[10px] text-[#FF3B30] ml-2">ADMIN</span>}</td>
                  <td className="p-4 font-mono text-xs">{u.mobile}</td>
                  <td className="p-4 text-sm text-neutral-400">{u.flat_number || "—"}</td>
                  <td className="p-4">
                    <Pill text={u.status} color={u.status === "active" ? "green" : "yellow"} />
                  </td>
                  <td className="p-4">
                    {u.deposit_refunded ? (
                      <Pill text="Refunded" color="red" />
                    ) : u.deposit_paid ? (
                      <Pill text="Paid" color="green" />
                    ) : (
                      <Pill text="Pending" color="yellow" />
                    )}
                  </td>
                  <td className="p-4 text-xs text-neutral-500">{u.created_at?.slice(0, 10)}</td>
                  <td className="p-4 flex gap-2 justify-end">
                    {u.role !== "admin" && (
                      <button
                        onClick={() => setPwUser(u)}
                        className="text-xs px-2 py-1 border border-white/10 hover:border-white/30 rounded-sm flex items-center gap-1"
                        data-testid={`reset-pw-${u.id}`}
                      >
                        <KeyRound className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </>
        )}

        {active === "bookings" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-neutral-500">
                {showAllBookings
                  ? `Showing all ${bookings.length} bookings`
                  : `Showing ${bookings.filter((b) => b.status === "confirmed").length} confirmed bookings`}
              </div>
              <button
                onClick={() => setShowAllBookings((v) => !v)}
                className="text-xs px-3 py-1.5 border border-white/10 hover:border-white/30 rounded-sm"
                data-testid="toggle-show-all-bookings"
              >
                {showAllBookings ? "Show confirmed only" : "Show all"}
              </button>
            </div>
            <Table headers={["Member", "Mobile", "Month", "Slot", "Status", "Amount", "Created"]}>
              {bookings
                .filter((b) => showAllBookings || b.status === "confirmed")
                .map((b) => (
                <tr key={b.id} className="border-t border-white/5">
                  <td className="p-4 font-bold">{b.user_name}</td>
                  <td className="p-4 font-mono text-xs">{b.user_mobile}</td>
                  <td className="p-4">{b.month}</td>
                  <td className="p-4">{b.slot_label}</td>
                  <td className="p-4">
                    <Pill text={b.status} color={b.status === "confirmed" ? "green" : "yellow"} />
                  </td>
                  <td className="p-4 font-mono">₹{(b.amount / 100).toLocaleString("en-IN")}</td>
                  <td className="p-4 text-xs text-neutral-500">{new Date(b.created_at).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </Table>
          </>
        )}

        {active === "payments" && (
          <Table headers={["Type", "User", "Amount", "Payment ID", "Status", "Date"]}>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="p-4"><Pill text={p.type.replace("_", " ")} color={p.amount < 0 ? "red" : "green"} /></td>
                <td className="p-4 font-mono text-xs">{p.user_id.slice(0, 8)}…</td>
                <td className={`p-4 font-mono font-bold ${p.amount < 0 ? "text-[#FF3B30]" : ""}`}>
                  {p.amount < 0 ? "-" : ""}₹{Math.abs(p.amount / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-4 font-mono text-xs text-neutral-500">{p.payment_id?.slice(0, 16) || "—"}</td>
                <td className="p-4"><Pill text={p.status} color={p.status === "captured" ? "green" : "red"} /></td>
                <td className="p-4 text-xs text-neutral-500">{new Date(p.created_at).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {/* Reset PW modal */}
      {pwUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPwUser(null)}>
          <div className="bg-neutral-900 border border-white/10 rounded-md p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="label-eyebrow mb-2">Reset password</div>
            <h3 className="font-display text-2xl font-bold uppercase tracking-tight">{pwUser.name}</h3>
            <p className="text-xs text-neutral-500 mt-1">Mobile: {pwUser.mobile}</p>
            <input
              type="text"
              placeholder="New password (min 6 chars)"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full mt-5 bg-black border border-neutral-800 focus:border-[#FF3B30] outline-none rounded-md px-4 py-3 text-sm"
              data-testid="reset-pw-input"
            />
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setPwUser(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={doResetPw} className="btn-primary text-xs" data-testid="reset-pw-confirm">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="bg-[#0A0A0A] p-6">
      <div className="label-eyebrow">{label}</div>
      <div className="font-display text-4xl font-black mt-2">{value}</div>
    </div>
  );
}

function Pill({ text, color }) {
  const palette = {
    green: "bg-[#34C759]/15 text-[#34C759]",
    red: "bg-[#FF3B30]/15 text-[#FF3B30]",
    yellow: "bg-yellow-500/15 text-yellow-500",
  };
  return <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-sm ${palette[color]}`}>{text}</span>;
}

function Table({ headers, children }) {
  return (
    <div className="border border-white/10 rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900 text-left">
          <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
            {headers.map((h) => (
              <th key={h} className="p-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-black/30">{children}</tbody>
      </table>
    </div>
  );
}
