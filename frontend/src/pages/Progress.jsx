import { useEffect, useMemo, useState } from "react";
import api, { getUser } from "../lib/api";
import { toast } from "sonner";
import Header from "../components/Header";
import { Flame, Trophy, CalendarCheck, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function monthKey(offset = 0, base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(m) {
  const [y, mm] = m.split("-");
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function Progress() {
  const user = getUser();
  const [month, setMonth] = useState(monthKey(0));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async (m = month) => {
    setLoading(true);
    try {
      const { data } = await api.get("/me/attendance", { params: { month: m } });
      setData(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const firstWeekday = new Date(year, mon - 1, 1).getDay();
  const attendedSet = useMemo(() => new Set(data?.days_attended || []), [data]);

  const cells = useMemo(() => {
    const arr = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) arr.push(day);
    return arr;
  }, [firstWeekday, daysInMonth]);

  const isCurrentMonth = month === monthKey(0);
  const todayDate = new Date().getDate();

  return (
    <div className="min-h-screen" data-testid="progress-page">
      <Header />
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-10">
        <div className="label-eyebrow mb-2">Court progress</div>
        <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none mb-8">
          Hey {user?.name?.split(" ")[0]}, keep the <span className="text-[var(--primary)]">streak</span> alive.
        </h1>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard icon={Flame} label="Current streak" value={data?.current_streak ?? "—"} suffix="days" highlight />
          <StatCard icon={Trophy} label="Longest streak" value={data?.longest_streak ?? "—"} suffix="days" />
          <StatCard icon={CalendarCheck} label={`Days this month`} value={data?.total_days_this_month ?? "—"} suffix={`/ ${daysInMonth}`} />
        </div>

        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-md p-6">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setMonth(monthKey(-1, new Date(year, mon - 1, 1)))}
              className="p-2 text-[var(--muted)] hover:text-[var(--text)]"
              data-testid="progress-prev-month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-display text-lg font-bold uppercase tracking-tight">{formatMonth(month)}</div>
            <button
              onClick={() => setMonth(monthKey(1, new Date(year, mon - 1, 1)))}
              disabled={isCurrentMonth}
              className="p-2 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="progress-next-month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--muted)]" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAYS.map((w, i) => (
                  <div key={i} className="text-center text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {cells.map((day, i) =>
                  day === null ? (
                    <div key={i} />
                  ) : (
                    <div
                      key={i}
                      title={attendedSet.has(day) ? `Checked in on ${day} ${formatMonth(month)}` : ""}
                      data-testid={`progress-cell-${day}`}
                      className={`aspect-square rounded-sm flex items-center justify-center text-[10px] font-bold ${
                        attendedSet.has(day)
                          ? "bg-[var(--primary)] text-[var(--selection-text)]"
                          : "bg-[var(--surface-hover)] text-[var(--muted)]"
                      } ${isCurrentMonth && day === todayDate ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]" : ""}`}
                    >
                      {day}
                    </div>
                  )
                )}
              </div>
              <div className="flex items-center gap-2 mt-5 text-[10px] text-[var(--muted)] uppercase tracking-wider">
                <div className="w-3 h-3 rounded-sm bg-[var(--surface-hover)]" /> No visit
                <div className="w-3 h-3 rounded-sm bg-[var(--primary)] ml-3" /> Checked in
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, suffix, highlight }) {
  return (
    <div className={`border rounded-md p-5 ${highlight ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
      <Icon className={`w-4 h-4 mb-3 ${highlight ? "text-[var(--primary)]" : "text-[var(--muted)]"}`} />
      <div className="font-display text-3xl font-black">
        {value} <span className="text-sm font-normal text-[var(--muted)]">{suffix}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mt-1">{label}</div>
    </div>
  );
}
