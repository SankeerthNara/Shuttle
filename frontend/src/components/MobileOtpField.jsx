import { Loader2, PhoneCall, CheckCircle2 } from "lucide-react";

const RECAPTCHA_CONTAINER_ID = "recaptcha-container";

/**
 * Mobile number input + Send/Verify OTP UI, driven by the useMobileOtp hook.
 * Renders the (required) invisible reCAPTCHA container too.
 */
export default function MobileOtpField({
  label = "Mobile (10 digits)",
  mobile,
  onMobileChange,
  otp,
  testidPrefix = "otp",
}) {
  const { otpStatus, otpCode, setOtpCode, isFirebaseConfigured, sendOtp, verifyOtp } = otp;
  const isValidMobile = /^\d{10}$/.test(mobile);

  return (
    <div>
      <span className="label-eyebrow block mb-2">{label}</span>
      <div className="flex gap-2">
        <input
          value={mobile}
          onChange={onMobileChange}
          required
          maxLength={10}
          inputMode="numeric"
          disabled={otpStatus === "verified"}
          data-testid={`${testidPrefix}-mobile-input`}
          className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none text-[var(--text)] rounded-md px-4 py-3 text-sm disabled:opacity-60"
        />
        {otpStatus === "verified" ? (
          <span className="shrink-0 flex items-center gap-1.5 px-3 rounded-md bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)] text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" /> Verified
          </span>
        ) : (
          <button
            type="button"
            onClick={() => sendOtp(mobile)}
            disabled={!isValidMobile || otpStatus === "sending" || !isFirebaseConfigured}
            data-testid={`${testidPrefix}-send-otp-btn`}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 rounded-md border border-[var(--border)] text-[var(--text)] text-xs font-bold uppercase tracking-wider whitespace-nowrap hover:bg-[var(--surface-hover)] hover:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
            title={!isFirebaseConfigured ? "Mobile OTP verification is not configured" : undefined}
          >
            {otpStatus === "sending" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <PhoneCall className="w-3.5 h-3.5" /> {otpStatus === "sent" ? "Resend OTP" : "Send OTP"}
              </>
            )}
          </button>
        )}
      </div>
      {!isFirebaseConfigured && (
        <p className="text-xs text-[var(--muted)] mt-2">Mobile OTP verification isn't configured yet.</p>
      )}
      {(otpStatus === "sent" || otpStatus === "verifying") && (
        <div className="flex gap-2 mt-3">
          <input
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit OTP"
            inputMode="numeric"
            data-testid={`${testidPrefix}-otp-input`}
            className="w-full bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none text-[var(--text)] rounded-md px-4 py-3 text-sm tracking-[0.3em]"
          />
          <button
            type="button"
            onClick={() => verifyOtp(mobile)}
            disabled={otpCode.length < 6 || otpStatus === "verifying"}
            data-testid={`${testidPrefix}-verify-otp-btn`}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 rounded-md bg-[var(--primary)] text-[var(--selection-text)] text-xs font-bold uppercase tracking-wider whitespace-nowrap hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {otpStatus === "verifying" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
          </button>
        </div>
      )}
      {/* Invisible reCAPTCHA required by Firebase Phone Auth */}
      <div id={RECAPTCHA_CONTAINER_ID} />
    </div>
  );
}

export { RECAPTCHA_CONTAINER_ID };
