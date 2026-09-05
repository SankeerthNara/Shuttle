import { useEffect, useMemo, useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import api from "../lib/api";
import { toast } from "sonner";
import Header from "../components/Header";
import { Search, RefreshCw, Loader2, ScanFace, Camera, Users, CheckCircle2, XCircle, KeyRound, AlertTriangle } from "lucide-react";

export default function Gatekeeper() {
  const [view, setView] = useState("scan"); // scan | members

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
          <div className="flex gap-2">
            <button
              onClick={() => setView("scan")}
              className={`text-xs px-4 py-2 border rounded-sm flex items-center gap-2 ${view === "scan" ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--muted)]"}`}
              data-testid="view-scan-btn"
            >
              <Camera className="w-3.5 h-3.5" /> Scan
            </button>
            <button
              onClick={() => setView("members")}
              className={`text-xs px-4 py-2 border rounded-sm flex items-center gap-2 ${view === "members" ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--muted)]"}`}
              data-testid="view-members-btn"
            >
              <Users className="w-3.5 h-3.5" /> Members
            </button>
          </div>
        </div>

        {view === "scan" ? <ScanView /> : <MembersView />}
      </div>
    </div>
  );
}

function ScanView() {
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null);
  const [manualToken, setManualToken] = useState("");
  const [looking, setLooking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const loadRecent = async () => {
    setLoadingRecent(true);
    try {
      const { data } = await api.get("/gatekeeper/checkins");
      setRecent(data);
    } catch (e) {
      // silent — non-critical
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  const doLookup = async (qr_token) => {
    setScanning(false);
    setLooking(true);
    try {
      const { data } = await api.post("/gatekeeper/scan", { qr_token });
      setResult({ ok: true, ...data });
    } catch (e) {
      setResult({ ok: false, error: e?.response?.data?.detail || "QR code not recognized" });
    } finally {
      setLooking(false);
    }
  };

  const decide = async (decision) => {
    if (!result?.user_id) return;
    setConfirming(true);
    try {
      await api.post("/gatekeeper/confirm", { user_id: result.user_id, decision });
      toast.success(decision === "approve" ? "Entry approved" : "Entry declined");
      loadRecent();
      reset();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not record decision");
    } finally {
      setConfirming(false);
    }
  };

  const handleScan = (detectedCodes) => {
    const value = detectedCodes?.[0]?.rawValue;
    if (value && !looking && scanning) doLookup(value);
  };

  const reset = () => {
    setResult(null);
    setManualToken("");
    setScanning(true);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      <div className="md:col-span-7">
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-md overflow-hidden">
          {scanning && !looking ? (
            <div data-testid="qr-scanner-view" className="w-full overflow-hidden">
              <Scanner
                onScan={handleScan}
                onError={() => toast.error("Camera access failed. Use manual entry below.")}
                constraints={{ facingMode: "environment" }}
                styles={{ container: { width: "100%", maxWidth: "100%" }, video: { width: "100%", maxWidth: "100%", objectFit: "cover" } }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              {looking ? (
                <Loader2 className="w-8 h-8 animate-spin text-[var(--muted)]" />
              ) : result ? (
                <ResultCard result={result} onReset={reset} onDecide={decide} confirming={confirming} />
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-4 border border-[var(--border)] rounded-md p-4">
          <div className="label-eyebrow mb-2 flex items-center gap-2"><KeyRound className="w-3 h-3" /> Manual entry</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste QR code value"
              className="flex-1 bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-md px-3 py-2 text-sm"
              data-testid="manual-token-input"
            />
            <button
              onClick={() => manualToken.trim() && doLookup(manualToken.trim())}
              disabled={!manualToken.trim() || looking}
              className="btn-primary text-xs"
              data-testid="manual-token-submit"
            >
              Look up
            </button>
          </div>
        </div>
      </div>

      <div className="md:col-span-5">
        <div className="label-eyebrow mb-3 flex items-center justify-between">
          <span>Recent scans</span>
          <button onClick={loadRecent} data-testid="reload-recent-btn">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRecent ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="border border-[var(--border)] rounded-md divide-y divide-[var(--border)] max-h-[28rem] overflow-y-auto">
          {recent.length === 0 ? (
            <div className="p-6 text-center text-[var(--muted)] text-sm">No scans yet.</div>
          ) : (
            recent.map((c) => (
              <div key={c.id} className="p-3 flex items-center justify-between text-sm" data-testid={`recent-checkin-${c.id}`}>
                <div>
                  <div className="font-bold">{c.user_name}</div>
                  <div className="text-[10px] text-[var(--muted)]">
                    {c.has_booking ? (c.slot_label || "Booked") : "No booking this month"} · {new Date(c.created_at).toLocaleTimeString("en-IN")}
                  </div>
                </div>
                {c.decision === "decline" ? (
                  <span className="text-[10px] font-bold uppercase text-[var(--primary)]">Declined</span>
                ) : c.flag === "green" ? (
                  <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
                ) : c.flag === "red" ? (
                  <XCircle className="w-4 h-4 text-[var(--primary)]" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-orange-500 inline-block" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MembersView() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState(null);
  const [looking, setLooking] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/gatekeeper/members");
      setMembers(data);
    } catch (e) {
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const filtered = useMemo(
    () => members.filter((m) => m.name?.toLowerCase().includes(search.trim().toLowerCase())),
    [members, search]
  );

  const openMember = async (member) => {
    setLooking(true);
    setActiveResult({}); // truthy placeholder so the modal shows immediately with a spinner
    try {
      const { data } = await api.post("/gatekeeper/lookup-member", { user_id: member.id });
      setActiveResult({ ok: true, ...data });
    } catch (e) {
      setActiveResult({ ok: false, error: e?.response?.data?.detail || "Could not look up member" });
    } finally {
      setLooking(false);
    }
  };

  const decide = async (decision) => {
    if (!activeResult?.user_id) return;
    setConfirming(true);
    try {
      await api.post("/gatekeeper/confirm", { user_id: activeResult.user_id, decision });
      toast.success(decision === "approve" ? "Entry approved" : "Entry declined");
      setActiveResult(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not record decision");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--primary)] outline-none rounded-md pl-9 pr-4 py-2.5 text-sm"
            data-testid="member-search-input"
          />
        </div>
        <button onClick={loadMembers} className="btn-secondary text-xs" data-testid="reload-members-btn">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="text-xs text-[var(--muted)] mb-3">
        {loading ? "Loading…" : `${filtered.length} paid member${filtered.length === 1 ? "" : "s"}`}
      </div>

      <div className="border border-[var(--border)] rounded-md divide-y divide-[var(--border)] max-h-[32rem] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)] text-sm">No members found.</div>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => openMember(m)}
              className="w-full text-left p-4 flex items-center justify-between hover:bg-[var(--surface-hover)]"
              data-testid={`member-row-${m.id}`}
            >
              <div>
                <div className="font-bold text-sm">{m.name}</div>
                <div className="text-xs text-[var(--muted)] font-mono">{m.mobile} · Flat {m.flat_number || "—"}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted)] capitalize">{m.user_type || "—"}</span>
            </button>
          ))
        )}
      </div>

      {activeResult && (
        <div
          className="fixed inset-0 bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !confirming && !looking && setActiveResult(null)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-8 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
            data-testid="member-lookup-modal"
          >
            {looking ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--muted)]" />
              </div>
            ) : (
              <ResultCard
                result={activeResult}
                onReset={() => setActiveResult(null)}
                onDecide={decide}
                confirming={confirming}
                resetLabel="Close"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({ result, onReset, onDecide, confirming, resetLabel = "Cancel / scan next" }) {
  if (!result.ok) {
    return (
      <div className="text-center" data-testid="checkin-result-error">
        <XCircle className="w-12 h-12 text-[var(--primary)] mx-auto mb-3" />
        <div className="font-display text-lg font-bold uppercase">{result.error}</div>
        <button onClick={onReset} className="btn-secondary text-xs mt-4">{resetLabel}</button>
      </div>
    );
  }

  const flagStyles = {
    green: { icon: CheckCircle2, color: "text-[#34C759]", label: "Looks good" },
    orange: { icon: AlertTriangle, color: "text-orange-500", label: "Wrong slot" },
    red: { icon: XCircle, color: "text-[var(--primary)]", label: "Already scanned in today" },
  };
  const { icon: FlagIcon, color, label } = flagStyles[result.flag] || flagStyles.orange;

  return (
    <div className="text-center w-full" data-testid="checkin-result-success">
      <FlagIcon className={`w-12 h-12 mx-auto mb-3 ${color}`} />
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${color}`}>{label}</div>
      <div className="font-display text-2xl font-black uppercase tracking-tight">{result.name}</div>
      <div className="text-xs text-[var(--muted)] font-mono mt-1">{result.mobile}</div>
      <div className="flex justify-center gap-4 mt-4 text-sm">
        <div><span className="text-[var(--muted)]">Flat:</span> {result.flat_number || "—"}</div>
        <div className="capitalize"><span className="text-[var(--muted)]">Type:</span> {result.user_type || "—"}</div>
      </div>
      <div className="mt-3 text-sm">
        {result.has_booking ? (
          <span className={result.on_time ? "text-[#34C759]" : "text-orange-500"}>
            Booked: {result.slot_label} {result.on_time ? "(on time)" : "(outside slot window)"}
          </span>
        ) : (
          <span className="text-orange-500">No confirmed booking this month</span>
        )}
      </div>
      {result.already_scanned_today && (
        <div className="mt-1 text-sm text-[var(--primary)]">Already scanned in earlier today</div>
      )}
      <div className="flex gap-3 justify-center mt-6">
        <button
          onClick={() => onDecide("decline")}
          disabled={confirming}
          className="flex-1 max-w-[9rem] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md border border-[var(--border)] text-[var(--text)] text-xs font-bold uppercase tracking-wider hover:border-[var(--primary)] disabled:opacity-50"
          data-testid="decline-entry-btn"
        >
          <XCircle className="w-3.5 h-3.5" /> Decline
        </button>
        <button
          onClick={() => onDecide("approve")}
          disabled={confirming}
          className="flex-1 max-w-[9rem] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-[#34C759] text-[#0a0a0a] text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          data-testid="approve-entry-btn"
        >
          {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
        </button>
      </div>
      <button onClick={onReset} className="btn-secondary text-xs mt-4">{resetLabel}</button>
    </div>
  );
}
