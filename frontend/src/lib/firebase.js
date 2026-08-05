import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

// All values come from your Firebase project settings (Project settings > General > Your apps > Web app).
// They are safe to expose in frontend code — Firebase enforces access via security rules, not by
// keeping these values secret. Set them in frontend/.env (see .env.example).
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

const app = isFirebaseConfigured
  ? getApps()[0] || initializeApp(firebaseConfig)
  : null;

export const auth = app ? getAuth(app) : null;

/**
 * Lazily creates (or reuses) an invisible reCAPTCHA verifier bound to the given DOM node id.
 * Firebase phone auth requires this to prove the request isn't coming from a bot.
 */
export function getRecaptchaVerifier(containerId) {
  if (!auth) throw new Error("Firebase is not configured.");
  if (!window._recaptchaVerifier) {
    window._recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
    });
  }
  return window._recaptchaVerifier;
}

/**
 * Sends an OTP SMS to the given 10-digit Indian mobile number.
 * Returns a Firebase ConfirmationResult — call .confirm(code) on it to verify the OTP.
 */
export async function sendMobileOtp(mobile, containerId) {
  const verifier = getRecaptchaVerifier(containerId);
  return signInWithPhoneNumber(auth, `+91${mobile}`, verifier);
}

export function resetRecaptcha() {
  if (window._recaptchaVerifier) {
    try {
      window._recaptchaVerifier.clear();
    } catch (e) {
      // ignore
    }
    window._recaptchaVerifier = null;
  }
}
