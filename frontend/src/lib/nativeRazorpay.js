import { registerPlugin, Capacitor } from "@capacitor/core";

const RazorpayCheckoutNative = registerPlugin("RazorpayCheckout");

/** True only when running inside the compiled Android app (not the web site). */
export const isNativePlatform = () => Capacitor.isNativePlatform();

/**
 * Opens Razorpay's native Android Checkout SDK and resolves with the same shape the
 * backend's /verify endpoints already expect: { razorpay_payment_id, razorpay_order_id,
 * razorpay_signature }. Rejects if the user cancels or the payment fails.
 *
 * @param {{key, amount, currency, order_id, name, description, prefill: {name, contact, email}}} options
 */
export async function openNativeCheckout(options) {
  return RazorpayCheckoutNative.open({
    key: options.key,
    amount: options.amount,
    currency: options.currency,
    order_id: options.order_id,
    name: options.name,
    description: options.description,
    prefill: options.prefill,
    theme_color:
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#FF3B30",
  });
}
