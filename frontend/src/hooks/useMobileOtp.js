import { useRef, useState } from "react";
import { toast } from "sonner";
import { sendMobileOtp, resetRecaptcha, isFirebaseConfigured } from "../lib/firebase";

/**
 * Shared Firebase Phone-Auth OTP flow: send code -> enter code -> verify -> get ID token.
 * Used anywhere we need to prove ownership of a mobile number (registration, forgot password).
 */
export function useMobileOtp(recaptchaContainerId) {
  const [otpStatus, setOtpStatus] = useState("idle"); // idle | sending | sent | verifying | verified
  const [otpCode, setOtpCode] = useState("");
  const [firebaseIdToken, setFirebaseIdToken] = useState("");
  const confirmationRef = useRef(null);
  const verifiedMobileRef = useRef("");

  const resetOtp = () => {
    setOtpStatus("idle");
    setFirebaseIdToken("");
    setOtpCode("");
    confirmationRef.current = null;
  };

  const onMobileChanged = (mobile) => {
    if (mobile !== verifiedMobileRef.current && otpStatus === "verified") {
      resetOtp();
    }
  };

  const sendOtp = async (mobile) => {
    if (!/^\d{10}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number first.");
      return;
    }
    setOtpStatus("sending");
    try {
      confirmationRef.current = await sendMobileOtp(mobile, recaptchaContainerId);
      setOtpStatus("sent");
      toast.success(`OTP sent to +91 ${mobile}`);
    } catch (err) {
      resetRecaptcha();
      setOtpStatus("idle");
      toast.error(
        err?.message?.includes("too-many-requests")
          ? "Too many attempts. Please try again later."
          : "Could not send OTP. Check the number and try again."
      );
    }
  };

  const verifyOtp = async (mobile) => {
    if (!confirmationRef.current || otpCode.length < 6) return;
    setOtpStatus("verifying");
    try {
      const result = await confirmationRef.current.confirm(otpCode);
      const idToken = await result.user.getIdToken();
      setFirebaseIdToken(idToken);
      verifiedMobileRef.current = mobile;
      setOtpStatus("verified");
      toast.success("Mobile number verified.");
    } catch (err) {
      setOtpStatus("sent");
      toast.error("Incorrect or expired OTP. Please try again.");
    }
  };

  return {
    otpStatus,
    otpCode,
    setOtpCode,
    firebaseIdToken,
    isFirebaseConfigured,
    onMobileChanged,
    sendOtp,
    verifyOtp,
    resetOtp,
  };
}
