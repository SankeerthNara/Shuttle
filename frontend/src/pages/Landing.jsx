import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Users, ShieldCheck, Zap, MapPin, CalendarDays } from "lucide-react";
import Header from "../components/Header";
import api from "../lib/api";

const monthKey = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
};

const formatMonth = (m) => {
  const [y, mm] = m.split("-");
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};

const SLOTS = [
  ["05", "5 — 6 AM"],
  ["06", "6 — 7 AM"],
  ["07", "7 — 8 AM"],
  ["08", "8 — 9 AM"],
  ["16", "5 — 6 PM"],
  ["17", "6 — 7 PM"],
  ["18", "7 — 8 PM"],
  ["19", "8 — 9 PM"],
];

export default function Landing() {
  const [month, setMonth] = useState(monthKey(1));
  const [availability, setAvailability] = useState({});

  useEffect(() => {
    api
      .get("/slots/public-availability", { params: { month } })
      .then((res) => {
        const map = {};
        (res.data.slots || []).forEach((s) => {
          map[s.id] = s;
        });
        setAvailability(map);
      })
      .catch(() => {});
  }, [month]);

  return (
    <div className="min-h-screen" data-testid="landing-page">
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "url(https://images.pexels.com/photos/8933585/pexels-photo-8933585.jpeg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_80%,transparent)] to-[color-mix(in_srgb,var(--bg)_40%,transparent)]" />
        <div className="absolute inset-0 court-lines opacity-50" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-10 pt-20 pb-32">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse" />
                <span className="label-eyebrow">Open · 5 AM — 9 AM · 4 PM — 9 PM</span>
              </div>
              <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-black uppercase leading-[0.85] tracking-tighter">
                Lock your<br />
                <span className="text-[var(--primary)]">monthly</span> slot.<br />
                Play every day.
              </h1>
              <p className="mt-8 text-base sm:text-lg text-[var(--muted)] max-w-xl leading-relaxed">
                The colony's premier badminton court. Reserve one hourly slot for the entire month —
                same time, every day, your spot. No daily juggling, no waiting list.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link to="/register" className="btn-primary" data-testid="hero-cta-register">
                  Reserve Your Slot
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/login" className="btn-secondary" data-testid="hero-cta-login">
                  Member sign in
                </Link>
              </div>
            </div>
            <div className="md:col-span-4">
              <div className="border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_40%,transparent)] backdrop-blur-md p-6 rounded-md">
                <div className="label-eyebrow mb-4">Court Stats</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-display text-5xl font-black text-[var(--primary)]">8</div>
                    <div className="text-xs text-[var(--muted)] uppercase tracking-wider mt-1">
                      Hourly slots
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-5xl font-black">8</div>
                    <div className="text-xs text-[var(--muted)] uppercase tracking-wider mt-1">
                      Max / slot
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-5xl font-black">8h</div>
                    <div className="text-xs text-[var(--muted)] uppercase tracking-wider mt-1">
                      Daily hours
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-5xl font-black">30d</div>
                    <div className="text-xs text-[var(--muted)] uppercase tracking-wider mt-1">
                      Per booking
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SLOT BOARD */}
      <section className="relative border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
            <div className="md:col-span-4">
              <div className="label-eyebrow mb-3">02 · Available Slots</div>
              <h2 className="font-display text-4xl sm:text-5xl font-black uppercase leading-none tracking-tighter">
                Pick your<br />hour.
              </h2>
            </div>
            <div className="md:col-span-7 md:col-start-6">
              <p className="text-[var(--muted)] text-base leading-relaxed">
                Nine hourly windows split between mornings and evenings. Each slot fits up to 8
                players. Lock yours for the whole month — same time, every day.
              </p>
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--surface)] rounded-md p-5 mb-8 max-w-md">
            <div className="label-eyebrow flex items-center gap-2">
              <CalendarDays className="w-3 h-3" /> Booking month
            </div>
            <div className="flex gap-2 mt-3">
              {[0, 1, 2].map((o) => {
                const m = monthKey(o);
                const isActive = m === month;
                return (
                  <button
                    key={m}
                    onClick={() => setMonth(m)}
                    className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-sm border ${
                      isActive
                        ? "bg-[var(--primary)] border-[var(--primary)] text-[var(--text)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border)]"
                    }`}
                    data-testid={`landing-month-tab-${o}`}
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

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-[var(--surface-hover)] border border-[var(--border)]">
            {SLOTS.map(([num, label], i) => {
              const slotId = `${num}00`;
              const slotData = availability[slotId];
              const booked = slotData?.booked ?? null;
              const full = slotData && slotData.available <= 0;
              return (
                <div
                  key={num}
                  className="bg-[var(--bg)] hover:bg-[var(--primary)] group p-6 transition-colors duration-200 aspect-square flex flex-col justify-between"
                  data-testid={`slot-card-${num}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs text-[var(--muted)] group-hover:text-[color-mix(in_srgb,var(--text)_70%,transparent)]">
                      /{String(i + 1).padStart(2, "0")}
                    </div>
                    {booked !== null && (
                      <div
                        className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${
                          full
                            ? "border-[color-mix(in_srgb,var(--primary)_40%,transparent)] text-[var(--primary)] group-hover:border-[var(--border)] group-hover:text-[var(--text)]"
                            : "border-[var(--border)] text-[var(--muted)] group-hover:border-[var(--border)] group-hover:text-[var(--text)]"
                        }`}
                      >
                        {full ? "Full" : `${booked}/8 booked`}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-display text-3xl font-black uppercase tracking-tight leading-none">
                      {label.split(" ")[0]}
                    </div>
                    <div className="font-display text-xl font-bold uppercase text-[var(--muted)] group-hover:text-[var(--text)] mt-1">
                      {label.split(" ").slice(1).join(" ")}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="bg-[var(--surface)] p-6 aspect-square flex flex-col justify-end border-l border-[var(--border)]">
              <div className="label-eyebrow text-[var(--primary)] mb-2">Limit</div>
              <div className="font-display text-2xl font-bold uppercase leading-tight">
                8 players<br />per slot.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-[var(--border)] bg-[var(--bg)]">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5">
            <div className="label-eyebrow mb-3">03 · How it works</div>
            <h2 className="font-display text-4xl sm:text-5xl font-black uppercase leading-none tracking-tighter">
              Three steps.<br />Zero hassle.
            </h2>
            <p className="mt-6 text-[var(--muted)]">
              Pay a one-time ₹2,000 non-refundable security deposit on registration. Then book your
              monthly slot when you're ready to play.
            </p>
          </div>
          <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--surface-hover)] border border-[var(--border)]">
            {[
              { icon: ShieldCheck, t: "Register", d: "Sign up with mobile + password. Pay ₹1,000 non-refundable deposit." },
              { icon: Clock, t: "Pick a slot", d: "Choose any of 9 hourly windows for the month ahead." },
              { icon: Users, t: "Play daily", d: "Show up every day for the booked month. Up to 8 players share." },
            ].map((s, i) => (
              <div key={i} className="bg-[var(--bg)] p-8">
                <s.icon className="w-7 h-7 text-[var(--primary)]" strokeWidth={2} />
                <div className="font-display text-2xl font-black uppercase mt-6 tracking-tight">{s.t}</div>
                <p className="text-[var(--muted)] text-sm mt-3 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-24 text-center">
          <Zap className="w-10 h-10 text-[var(--primary)] mx-auto mb-6" />
          <h2 className="font-display text-5xl sm:text-7xl font-black uppercase leading-none tracking-tighter">
            Court time<br />is <span className="text-[var(--primary)]">limited</span>.
          </h2>
          <p className="text-[var(--muted)] mt-8 max-w-xl mx-auto">
            Only 72 monthly seats in total. Reserve before someone in your tower beats you to it.
          </p>
          <Link to="/register" className="btn-primary mt-10" data-testid="footer-cta-register">
            Get my slot
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-10 text-center text-xs text-[var(--muted)] tracking-wider uppercase">
        <div className="flex items-center justify-center gap-2">
          <MapPin className="w-3.5 h-3.5" />
          Colony Badminton Court · Members Only
        </div>
      </footer>
    </div>
  );
}
