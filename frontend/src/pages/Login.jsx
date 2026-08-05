import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api, { setSession } from "../lib/api";
import { toast } from "sonner";
import Header from "../components/Header";
import { ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { mobile, password });
      setSession(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}`);
      navigate(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" data-testid="login-page">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="label-eyebrow mb-3">Member access</div>
          <h1 className="font-display text-5xl sm:text-6xl font-black uppercase leading-[0.9] tracking-tighter">
            Welcome<br />back.
          </h1>
          <p className="mt-8 text-neutral-400 max-w-sm">
            Sign in with your registered mobile and password to view your bookings or reserve a new
            monthly slot.
          </p>
        </div>
        <form onSubmit={submit} className="md:col-span-6 md:col-start-7 border border-white/10 bg-neutral-900 p-8 rounded-md" data-testid="login-form">
          <div className="label-eyebrow mb-6">Sign in</div>
          <div className="space-y-4">
            <label className="block">
              <span className="label-eyebrow block mb-2">Mobile</span>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                maxLength={10}
                required
                className="w-full bg-black border border-neutral-800 focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] outline-none text-white rounded-md px-4 py-3 text-sm"
                data-testid="login-mobile-input"
              />
            </label>
            <label className="block">
              <span className="label-eyebrow block mb-2">Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="w-full bg-black border border-neutral-800 focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] outline-none text-white rounded-md px-4 py-3 text-sm"
                data-testid="login-password-input"
              />
            </label>
          </div>
          <button type="submit" disabled={loading} className="btn-primary mt-8 w-full justify-center" data-testid="login-submit">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
          </button>
          <p className="mt-6 text-sm text-neutral-400">
            New here?{" "}
            <Link to="/register" className="text-[#FF3B30] hover:text-[#FF564E] font-bold" data-testid="link-register">
              Register & pay deposit
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
