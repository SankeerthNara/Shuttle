import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import Header from "../components/Header";
import { Search, RefreshCw, Loader2, ScanFace } from "lucide-react";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Gatekeeper() {
  const [month, setMonth] = useState(currentMonth());
  const [slotFilter, setSlotFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/gatekeeper/roster", { params: { month } });
      setSlots(data.slots || []);
      setBookings(data.bookings || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const slotLabel = (id) => slots.find((s) => s.id === id)?.label || id;

  const filtered = useMemo(() => {
    return bookings
      .filter((b) => slotFilter === "all" || b.slot_id === slotFilter)
      .filter((b) => b.user_name?.toLowerCase().includes(search.trim().toLowerCase()));
  }, [bookings, slotFilter, search]);

  return (
    <div className="min-h-screen" data-testid="gatekeeper-page">
      <Header />
      <div className="max-w-5xl mx-auto px-6 md:px-10 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="label-eyebrow mb-2 flex items-center gap-2">
              <ScanFace className="w-3.5 h-3.5" /> Gate check-in
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none">
              Who's <span className="text-[var(--primary)]">coming</span>.
            </h1>
          </div>
          <button onClick={load} className="btn-secondary text-xs" data-testid="reload-btn">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-md px-4 py-2.5 text-sm"
            data-testid="gatekeeper-month-input"
          />
          <select
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-md px-4 py-2.5 text-sm"
            data-testid="gatekeeper-slot-filter"
          >
            <option value="all">All slots</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-md pl-9 pr-4 py-2.5 text-sm"
              data-testid="gatekeeper-search-input"
            />
          </div>
        </div>

        <div className="text-xs text-[var(--muted)] mb-3">
          {loading ? "Loading…" : `${filtered.length} member${filtered.length === 1 ? "" : "s"} booked for ${month}`}
        </div>

        <div className="border border-[var(--border)] rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface)] text-left">
              <tr className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                <th className="p-4">Name</th>
                <th className="p-4">Mobile</th>
                <th className="p-4">Flat</th>
                <th className="p-4">Type</th>
                <th className="p-4">Slot</th>
              </tr>
            </thead>
            <tbody className="bg-[color-mix(in_srgb,var(--bg)_30%,transparent)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--muted)]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--muted)] text-sm">
                    No bookings found.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id} className="border-t border-[var(--border)]" data-testid={`gatekeeper-row-${b.id}`}>
                    <td className="p-4 font-bold">{b.user_name}</td>
                    <td className="p-4 font-mono text-xs">{b.user_mobile}</td>
                    <td className="p-4 text-sm text-[var(--muted)]">{b.flat_number || "—"}</td>
                    <td className="p-4 text-xs capitalize">{b.user_type || "—"}</td>
                    <td className="p-4">{slotLabel(b.slot_id)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
