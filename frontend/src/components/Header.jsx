import { Link, useNavigate, useLocation } from "react-router-dom";
import { getUser, clearSession } from "../lib/api";
import { LogOut, LayoutDashboard, Shield, Trophy } from "lucide-react";

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
      className="sticky top-0 z-50 w-full border-b border-white/10 backdrop-blur-xl"
      style={{ background: "rgba(10,10,10,0.7)" }}
      data-testid="site-header"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
          <div className="w-9 h-9 rounded-md bg-[#FF3B30] flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl font-black tracking-tight uppercase">The Court</span>
            <span className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">Colony Badminton</span>
          </div>
        </Link>
        <nav className="flex items-center gap-2 md:gap-4">
          {!user && (
            <>
              <Link
                to="/login"
                className="text-sm font-bold uppercase tracking-wider text-neutral-300 hover:text-white px-3 py-2"
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
              {user.role !== "admin" && (
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider px-3 py-2 ${
                    location.pathname.startsWith("/dashboard") ? "text-white" : "text-neutral-400 hover:text-white"
                  }`}
                  data-testid="nav-dashboard"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
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
                        location.pathname.startsWith("/dashboard") ? "text-white" : "text-neutral-400 hover:text-white"
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
                      location.pathname.startsWith("/admin") ? "text-white" : "text-neutral-400 hover:text-white"
                    }`}
                    data-testid="nav-admin"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </>
              )}
              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/10">
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wide">{user.name}</div>
                  <div className="text-[10px] text-neutral-500 font-mono">{user.mobile}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="ml-1 p-2 text-neutral-400 hover:text-[#FF3B30]"
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
