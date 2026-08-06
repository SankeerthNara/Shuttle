import { Link, useNavigate, useLocation } from "react-router-dom";
import { getUser, clearSession } from "../lib/api";
import { LogOut, LayoutDashboard, Shield, Trophy, ScanFace } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  const logout = () => {
    clearSession();
    navigate("/");
  };

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-[var(--border)] backdrop-blur-xl"
      style={{ background: "color-mix(in srgb, var(--bg) 70%, transparent)" }}
      data-testid="site-header"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
          <div className="w-9 h-9 rounded-md bg-[var(--primary)] flex items-center justify-center">
            <Trophy className="w-5 h-5 text-[var(--selection-text)]" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl font-black tracking-tight uppercase">The Court</span>
            <span className="text-[10px] tracking-[0.25em] text-[var(--muted)] uppercase">Colony Badminton</span>
          </div>
        </Link>
        <nav className="flex items-center gap-2 md:gap-4">
          <ThemeToggle />
          {!user && (
            <>
              <Link
                to="/login"
                className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--text)] px-3 py-2"
                data-testid="nav-login"
              >
                Sign in
              </Link>
              <Link to="/register" className="btn-primary text-sm" data-testid="nav-register">
                Register
              </Link>
            </>
          )}
          {user && (
            <>
              {user.role === "user" && (
                user.deposit_paid ? (
                  <Link
                    to="/dashboard"
                    className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider px-3 py-2 ${
                      location.pathname.startsWith("/dashboard") ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                    data-testid="nav-dashboard"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                ) : (
                  <Link
                    to="/pay-deposit"
                    className="btn-primary text-sm"
                    data-testid="nav-renew-deposit"
                  >
                    Renew Safety Deposit
                  </Link>
                )
              )}
              {user.role === "gatekeeper" && (
                <Link
                  to="/gatekeeper"
                  className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider px-3 py-2 ${
                    location.pathname.startsWith("/gatekeeper") ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                  data-testid="nav-gatekeeper"
                >
                  <ScanFace className="w-4 h-4" />
                  <span className="hidden sm:inline">Gate check-in</span>
                </Link>
              )}
              {user.role === "admin" && (
                <>
                  {!user.deposit_paid && (
                    <Link
                      to="/pay-deposit"
                      className="btn-primary text-sm"
                      data-testid="nav-pay-deposit"
                    >
                      Pay Safety Deposit
                    </Link>
                  )}
                  {user.deposit_paid && (
                    <Link
                      to="/dashboard"
                      className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider px-3 py-2 ${
                        location.pathname.startsWith("/dashboard") ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                      data-testid="nav-dashboard"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span className="hidden sm:inline">Dashboard</span>
                    </Link>
                  )}
                  <Link
                    to="/admin"
                    className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider px-3 py-2 ${
                      location.pathname.startsWith("/admin") ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                    data-testid="nav-admin"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </>
              )}
              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[var(--border)]">
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wide">{user.name}</div>
                  <div className="text-[10px] text-[var(--muted)] font-mono">{user.mobile}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="ml-1 p-2 text-[var(--muted)] hover:text-[var(--primary)]"
                title="Sign out"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
