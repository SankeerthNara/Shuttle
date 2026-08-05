import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import Header from "../components/Header";
import { ArrowRight, Loader2, KeyRound } from "lucide-react";
import { useMobileOtp } from "../hooks/useMobileOtp";
import MobileOtpField, { RECAPTCHA_CONTAINER_ID } from "../components/MobileOtpField";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const otp = useMobileOtp(RECAPTCHA_CONTAINER_ID);

  const onMobileChange = (e) => {
    setMobile(e.target.value);
    otp.onMobileChanged(e.target.value);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (otp.otpStatus !== "verified" || !otp.firebaseIdToken) {
      toast.error("Please verify your mobile number with the OTP first.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", {
        mobile,
        new_password: newPassword,
        firebase_id_token: otp.firebaseIdToken,
      });
      toast.success("Password reset. Please sign in with your new password.");
      navigate("/login");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" data-testid="forgot-password-page">
      <Header />
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="label-eyebrow mb-3">Account recovery</div>
          <h1 className="font-display text-5xl sm:text-6xl font-black uppercase leading-[0.9] tracking-tighter">
            Reset your<br />password.
          </h1>
          <p className="mt-8 text-[var(--muted)] max-w-sm">
            Verify your registered mobile number with an OTP, then set a new password.
          </p>
        </div>
        <form onSubmit={submit} className="md:col-span-6 md:col-start-7 border border-[var(--border)] bg-[var(--surface)] p-8 rounded-md" data-testid="forgot-password-form">
          <div className="label-eyebrow mb-6">Verify & reset</div>
          <div className="space-y-4">
            <MobileOtpField mobile={mobile} onMobileChange={onMobileChange} otp={otp} testidPrefix="forgot" />
            <label className="block">
              <span className="label-eyebrow block mb-2">New password (min 6 chars)</span>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                required
                disabled={otp.otpStatus !== "verified"}
                data-testid="forgot-new-password-input"
                className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none text-[var(--text)] rounded-md px-4 py-3 text-sm disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="label-eyebrow block mb-2">Confirm new password</span>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                required
                disabled={otp.otpStatus !== "verified"}
                data-testid="forgot-confirm-password-input"
                className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none text-[var(--text)] rounded-md px-4 py-3 text-sm disabled:opacity-60"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={loading || otp.otpStatus !== "verified"}
            className="btn-primary mt-8 w-full justify-center"
            data-testid="forgot-password-submit"
            title={otp.otpStatus !== "verified" ? "Verify your mobile number to continue" : undefined}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Reset password <KeyRound className="w-4 h-4" /></>}
          </button>
          <p className="mt-6 text-sm text-[var(--muted)]">
            Remembered it?{" "}
            <Link to="/login" className="text-[var(--primary)] hover:text-[var(--primary-hover)] font-bold" data-testid="link-back-to-login">
              Back to sign in <ArrowRight className="inline w-3.5 h-3.5" />
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
