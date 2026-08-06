import { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import Header from "../components/Header";
import { Users, ClipboardList, Wallet, KeyRound, RefreshCw, Loader2, Search, UserPlus, ScanFace } from "lucide-react";

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
  const [userSearch, setUserSearch] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");

  // Add gatekeeper modal
  const [showAddGatekeeper, setShowAddGatekeeper] = useState(false);
  const [gkForm, setGkForm] = useState({ name: "", mobile: "", password: "" });
  const [gkLoading, setGkLoading] = useState(false);

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

  const filteredUsers = users
    .filter((u) => showAllUsers || u.status === "active")
    .filter((u) => u.name?.toLowerCase().includes(userSearch.trim().toLowerCase()));

  const filteredBookings = bookings
    .filter((b) => showAllBookings || b.status === "confirmed")
    .filter((b) => b.user_name?.toLowerCase().includes(bookingSearch.trim().toLowerCase()));

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

  const doAddGatekeeper = async () => {
    if (!gkForm.name.trim()) return toast.error("Name is required");
    if (!/^\d{10}$/.test(gkForm.mobile)) return toast.error("Mobile must be 10 digits");
    if (gkForm.password.length < 6) return toast.error("Password must be at least 6 characters");
    setGkLoading(true);
    try {
      await api.post("/admin/create-gatekeeper", gkForm);
      toast.success(`Gatekeeper account created for ${gkForm.name}`);
      setShowAddGatekeeper(false);
      setGkForm({ name: "", mobile: "", password: "" });
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create gatekeeper");
    } finally {
      setGkLoading(false);
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
              Admin <span className="text-[var(--primary)]">command</span>.
            </h1>
          </div>
          <button onClick={reload} className="btn-secondary text-xs" data-testid="reload-btn">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--surface-hover)] border border-[var(--border)] mb-8">
          <StatCell label="Members" value={users.filter((u) => u.deposit_active).length} />
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
        <div className="flex gap-1 border-b border-[var(--border)] mb-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-5 py-3 text-xs uppercase tracking-wider font-bold flex items-center gap-2 border-b-2 ${
                active === t.id ? "border-[var(--primary)] text-[var(--text)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="text-xs text-[var(--muted)]">
                {showAllUsers
                  ? `Showing all ${filteredUsers.length} users`
                  : `Showing ${filteredUsers.length} active users`}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name…"
                    className="bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-sm pl-8 pr-3 py-1.5 text-xs w-48"
                    data-testid="user-search-input"
                  />
                </div>
                <button
                  onClick={() => setShowAllUsers((v) => !v)}
                  className="text-xs px-3 py-1.5 border border-[var(--border)] hover:border-[var(--border)] rounded-sm whitespace-nowrap"
                  data-testid="toggle-show-all-users"
                >
                  {showAllUsers ? "Show active only" : "Show all"}
                </button>
                <button
                  onClick={() => setShowAddGatekeeper(true)}
                  className="btn-secondary text-xs whitespace-nowrap"
                  data-testid="open-add-gatekeeper"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Gatekeeper
                </button>
              </div>
            </div>
            <Table headers={["Name", "Mobile", "Flat", "Type", "Status", "Deposit", "Joined", ""]}>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]" data-testid={`user-row-${u.id}`}>
                  <td className="p-4 font-bold">
                    {u.name}
                    {u.role === "admin" && <span className="text-[10px] text-[var(--primary)] ml-2">ADMIN</span>}
                    {u.role === "gatekeeper" && <span className="text-[10px] text-[var(--muted)] ml-2 inline-flex items-center gap-1"><ScanFace className="w-3 h-3" />GATEKEEPER</span>}
                  </td>
                  <td className="p-4 font-mono text-xs">{u.mobile}</td>
                  <td className="p-4 text-sm text-[var(--muted)]">{u.flat_number || "—"}</td>
                  <td className="p-4">
                    <span className="text-xs capitalize">{u.role === "gatekeeper" ? "—" : u.user_type || "—"}</span>
                    {u.user_type === "visitor" && u.deposit_valid_until && (
                      <div className="text-[10px] text-[var(--muted)] mt-0.5">
                        until {u.deposit_valid_until.slice(0, 10)}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <Pill text={u.status} color={u.status === "active" ? "green" : "yellow"} />
                  </td>
                  <td className="p-4">
                    {u.role === "gatekeeper" || u.role === "admin" ? (
                      <Pill text="N/A" color="yellow" />
                    ) : u.deposit_refunded ? (
                      <Pill text="Refunded" color="red" />
                    ) : u.deposit_active ? (
                      <Pill text="Paid" color="green" />
                    ) : u.deposit_paid ? (
                      <Pill text="Expired" color="orange" />
                    ) : (
                      <Pill text="Pending" color="yellow" />
                    )}
                  </td>
                  <td className="p-4 text-xs text-[var(--muted)]">{u.created_at?.slice(0, 10)}</td>
                  <td className="p-4 flex gap-2 justify-end">
                    {u.role !== "admin" && (
                      <button
                        onClick={() => setPwUser(u)}
                        className="text-xs px-2 py-1 border border-[var(--border)] hover:border-[var(--border)] rounded-sm flex items-center gap-1"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="text-xs text-[var(--muted)]">
                {showAllBookings
                  ? `Showing all ${filteredBookings.length} bookings`
                  : `Showing ${filteredBookings.length} confirmed bookings`}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search by name…"
                    className="bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-sm pl-8 pr-3 py-1.5 text-xs w-48"
                    data-testid="booking-search-input"
                  />
                </div>
                <button
                  onClick={() => setShowAllBookings((v) => !v)}
                  className="text-xs px-3 py-1.5 border border-[var(--border)] hover:border-[var(--border)] rounded-sm whitespace-nowrap"
                  data-testid="toggle-show-all-bookings"
                >
                  {showAllBookings ? "Show confirmed only" : "Show all"}
                </button>
              </div>
            </div>
            <Table headers={["Member", "Mobile", "Month", "Slot", "Status", "Amount", "Created"]}>
              {filteredBookings.map((b) => (
                <tr key={b.id} className="border-t border-[var(--border)]">
                  <td className="p-4 font-bold">{b.user_name}</td>
                  <td className="p-4 font-mono text-xs">{b.user_mobile}</td>
                  <td className="p-4">{b.month}</td>
                  <td className="p-4">{b.slot_label}</td>
                  <td className="p-4">
                    <Pill text={b.status} color={b.status === "confirmed" ? "green" : "yellow"} />
                  </td>
                  <td className="p-4 font-mono">₹{(b.amount / 100).toLocaleString("en-IN")}</td>
                  <td className="p-4 text-xs text-[var(--muted)]">{new Date(b.created_at).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </Table>
          </>
        )}

        {active === "payments" && (
          <Table headers={["Type", "User", "Amount", "Payment ID", "Status", "Date"]}>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)]">
                <td className="p-4"><Pill text={p.type.replace("_", " ")} color={p.amount < 0 ? "red" : "green"} /></td>
                <td className="p-4 font-mono text-xs">{p.user_id.slice(0, 8)}…</td>
                <td className={`p-4 font-mono font-bold ${p.amount < 0 ? "text-[var(--primary)]" : ""}`}>
                  {p.amount < 0 ? "-" : ""}₹{Math.abs(p.amount / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-4 font-mono text-xs text-[var(--muted)]">{p.payment_id?.slice(0, 16) || "—"}</td>
                <td className="p-4"><Pill text={p.status} color={p.status === "captured" ? "green" : "red"} /></td>
                <td className="p-4 text-xs text-[var(--muted)]">{new Date(p.created_at).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {/* Reset PW modal */}
      {pwUser && (
        <div className="fixed inset-0 bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPwUser(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="label-eyebrow mb-2">Reset password</div>
            <h3 className="font-display text-2xl font-bold uppercase tracking-tight">{pwUser.name}</h3>
            <p className="text-xs text-[var(--muted)] mt-1">Mobile: {pwUser.mobile}</p>
            <input
              type="text"
              placeholder="New password (min 6 chars)"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full mt-5 bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-md px-4 py-3 text-sm"
              data-testid="reset-pw-input"
            />
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setPwUser(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={doResetPw} className="btn-primary text-xs" data-testid="reset-pw-confirm">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Gatekeeper modal */}
      {showAddGatekeeper && (
        <div className="fixed inset-0 bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddGatekeeper(false)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="label-eyebrow mb-2 flex items-center gap-2"><ScanFace className="w-3.5 h-3.5" /> Add gatekeeper</div>
            <h3 className="font-display text-2xl font-bold uppercase tracking-tight">Staff account</h3>
            <p className="text-xs text-[var(--muted)] mt-1">No deposit required. No dashboard access — gate check-in screen only.</p>
            <div className="space-y-3 mt-5">
              <input
                type="text"
                placeholder="Full name"
                value={gkForm.name}
                onChange={(e) => setGkForm({ ...gkForm, name: e.target.value })}
                className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-md px-4 py-3 text-sm"
                data-testid="add-gatekeeper-name-input"
              />
              <input
                type="text"
                placeholder="Mobile (10 digits)"
                value={gkForm.mobile}
                maxLength={10}
                onChange={(e) => setGkForm({ ...gkForm, mobile: e.target.value })}
                className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-md px-4 py-3 text-sm"
                data-testid="add-gatekeeper-mobile-input"
              />
              <input
                type="text"
                placeholder="Password (min 6 chars)"
                value={gkForm.password}
                onChange={(e) => setGkForm({ ...gkForm, password: e.target.value })}
                className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-md px-4 py-3 text-sm"
                data-testid="add-gatekeeper-password-input"
              />
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowAddGatekeeper(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={doAddGatekeeper} disabled={gkLoading} className="btn-primary text-xs" data-testid="add-gatekeeper-confirm">
                {gkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="bg-[var(--bg)] p-6">
      <div className="label-eyebrow">{label}</div>
      <div className="font-display text-4xl font-black mt-2">{value}</div>
    </div>
  );
}

function Pill({ text, color }) {
  const palette = {
    green: "bg-[#34C759]/15 text-[#34C759]",
    red: "bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]",
    yellow: "bg-yellow-500/15 text-yellow-500",
    orange: "bg-orange-500/15 text-orange-500",
  };
  return <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-sm ${palette[color]}`}>{text}</span>;
}

function Table({ headers, children }) {
  return (
    <div className="border border-[var(--border)] rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface)] text-left">
          <tr className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            {headers.map((h) => (
              <th key={h} className="p-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-[color-mix(in_srgb,var(--bg)_30%,transparent)]">{children}</tbody>
      </table>
    </div>
  );
}
