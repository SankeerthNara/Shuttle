import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Users, ShieldCheck, Zap, MapPin } from "lucide-react";
import Header from "../components/Header";
import api from "../lib/api";

const monthKey = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
};

const SLOTS = [
  ["05", "5 — 6 AM"],
  ["06", "6 — 7 AM"],
  ["07", "7 — 8 AM"],
  ["08", "8 — 9 AM"],
  ["16", "4 — 5 PM"],
  ["17", "5 — 6 PM"],
  ["18", "6 — 7 PM"],
  ["19", "7 — 8 PM"],
  ["20", "8 — 9 PM"],
];

export default function Landing() {
  const [availability, setAvailability] = useState({});

  useEffect(() => {
    api
      .get("/slots/public-availability", { params: { month: monthKey(1) } })
      .then((res) => {
        const map = {};
        (res.data.slots || []).forEach((s) => {
          map[s.id] = s;
        });
        setAvailability(map);
      })
      .catch(() => {});
  }, []);

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
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-[#0A0A0A]/40" />
        <div className="absolute inset-0 court-lines opacity-50" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-10 pt-20 pb-32">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 bg-[#FF3B30] rounded-full animate-pulse" />
                <span className="label-eyebrow">Open · 5 AM — 9 AM · 4 PM — 9 PM</span>
              </div>
              <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-black uppercase leading-[0.85] tracking-tighter">
                Lock your<br />
                <span className="text-[#FF3B30]">monthly</span> slot.<br />
                Play every day.
              </h1>
              <p className="mt-8 text-base sm:text-lg text-neutral-300 max-w-xl leading-relaxed">
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
              <div className="border border-white/10 bg-black/40 backdrop-blur-md p-6 rounded-md">
                <div className="label-eyebrow mb-4">Court Stats</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-display text-5xl font-black text-[#FF3B30]">9</div>
                    <div className="text-xs text-neutral-400 uppercase tracking-wider mt-1">
                      Hourly slots
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-5xl font-black">8</div>
                    <div className="text-xs text-neutral-400 uppercase tracking-wider mt-1">
                      Max / slot
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-5xl font-black">9h</div>
                    <div className="text-xs text-neutral-400 uppercase tracking-wider mt-1">
                      Daily hours
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-5xl font-black">30d</div>
                    <div className="text-xs text-neutral-400 uppercase tracking-wider mt-1">
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
      <section className="relative border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
            <div className="md:col-span-4">
              <div className="label-eyebrow mb-3">02 · Available Slots</div>
              <h2 className="font-display text-4xl sm:text-5xl font-black uppercase leading-none tracking-tighter">
                Pick your<br />hour.
              </h2>
            </div>
            <div className="md:col-span-7 md:col-start-6">
              <p className="text-neutral-400 text-base leading-relaxed">
                Nine hourly windows split between mornings and evenings. Each slot fits up to 8
                players. Lock yours for the whole month — same time, every day.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-white/5 border border-white/10">
            {SLOTS.map(([num, label], i) => {
              const slotData = availability[num];
              const booked = slotData?.booked ?? null;
              const full = slotData && slotData.available <= 0;
              return (
                <div
                  key={num}
                  className="bg-[#0A0A0A] hover:bg-[#FF3B30] group p-6 transition-colors duration-200 aspect-square flex flex-col justify-between"
                  data-testid={`slot-card-${num}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs text-neutral-500 group-hover:text-white/70">
                      /{String(i + 1).padStart(2, "0")}
                    </div>
                    {booked !== null && (
                      <div
                        className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${
                          full
                            ? "border-[#FF3B30]/40 text-[#FF3B30] group-hover:border-white/40 group-hover:text-white"
                            : "border-white/15 text-neutral-400 group-hover:border-white/40 group-hover:text-white"
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
                    <div className="font-display text-xl font-bold uppercase text-neutral-400 group-hover:text-white mt-1">
                      {label.split(" ").slice(1).join(" ")}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="bg-[#171717] p-6 aspect-square flex flex-col justify-end border-l border-white/5">
              <div className="label-eyebrow text-[#FF3B30] mb-2">Limit</div>
              <div className="font-display text-2xl font-bold uppercase leading-tight">
                8 players<br />per slot.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-white/10 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5">
            <div className="label-eyebrow mb-3">03 · How it works</div>
            <h2 className="font-display text-4xl sm:text-5xl font-black uppercase leading-none tracking-tighter">
              Three steps.<br />Zero hassle.
            </h2>
            <p className="mt-6 text-neutral-400">
              Pay a one-time ₹2,000 refundable security deposit on registration. Then book your
              monthly slot when you're ready to play.
            </p>
          </div>
          <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/5 border border-white/10">
            {[
              { icon: ShieldCheck, t: "Register", d: "Sign up with mobile + password. Pay ₹1,000 refundable deposit." },
              { icon: Clock, t: "Pick a slot", d: "Choose any of 9 hourly windows for the month ahead." },
              { icon: Users, t: "Play daily", d: "Show up every day for the booked month. Up to 8 players share." },
            ].map((s, i) => (
              <div key={i} className="bg-[#0A0A0A] p-8">
                <s.icon className="w-7 h-7 text-[#FF3B30]" strokeWidth={2} />
                <div className="font-display text-2xl font-black uppercase mt-6 tracking-tight">{s.t}</div>
                <p className="text-neutral-400 text-sm mt-3 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-24 text-center">
          <Zap className="w-10 h-10 text-[#FF3B30] mx-auto mb-6" />
          <h2 className="font-display text-5xl sm:text-7xl font-black uppercase leading-none tracking-tighter">
            Court time<br />is <span className="text-[#FF3B30]">limited</span>.
          </h2>
          <p className="text-neutral-400 mt-8 max-w-xl mx-auto">
            Only 72 monthly seats in total. Reserve before someone in your tower beats you to it.
          </p>
          <Link to="/register" className="btn-primary mt-10" data-testid="footer-cta-register">
            Get my slot
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10 text-center text-xs text-neutral-500 tracking-wider uppercase">
        <div className="flex items-center justify-center gap-2">
          <MapPin className="w-3.5 h-3.5" />
          Colony Badminton Court · Members Only
        </div>
      </footer>
    </div>
  );
}
