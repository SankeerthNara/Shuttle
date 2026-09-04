package xyz.sdstpscourt.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.razorpay.Checkout;
import com.razorpay.PaymentData;
import org.json.JSONObject;

/**
 * Bridges JS <-> Razorpay's native Android Checkout SDK.
 *
 * Razorpay's SDK requires the calling Activity itself to implement
 * PaymentResultWithDataListener (it looks the listener up on the Activity, not on an
 * arbitrary object) — so the actual onPaymentSuccess/onPaymentError callbacks live in
 * MainActivity, which then calls back into this plugin's handlePaymentSuccess/Error
 * to resolve/reject whichever JS call is currently pending.
 */
@CapacitorPlugin(name = "RazorpayCheckout")
public class RazorpayCheckoutPlugin extends Plugin {

    private PluginCall pendingCall;

    @PluginMethod
    public void open(PluginCall call) {
        this.pendingCall = call;
        try {
            Checkout checkout = new Checkout();
            checkout.setKeyID(call.getString("key"));

            JSONObject options = new JSONObject();
            options.put("name", call.getString("name", "The Court"));
            options.put("description", call.getString("description", ""));
            options.put("order_id", call.getString("order_id"));
            options.put("currency", call.getString("currency", "INR"));
            options.put("amount", call.getInt("amount"));

            JSObject prefill = call.getObject("prefill");
            if (prefill != null) {
                JSONObject prefillJson = new JSONObject();
                prefillJson.put("email", prefill.getString("email", ""));
                prefillJson.put("contact", prefill.getString("contact", ""));
                options.put("prefill", prefillJson);
            }

            JSONObject theme = new JSONObject();
            theme.put("color", call.getString("theme_color", "#FF3B30"));
            options.put("theme", theme);

            checkout.open(getActivity(), options);
        } catch (Exception e) {
            call.reject("Could not start checkout: " + e.getMessage());
            this.pendingCall = null;
        }
    }

    /** Called by MainActivity.onPaymentSuccess() */
    public void handlePaymentSuccess(String razorpayPaymentId, PaymentData paymentData) {
        if (pendingCall == null) return;
        JSObject result = new JSObject();
        result.put("razorpay_payment_id", razorpayPaymentId);
        result.put("razorpay_order_id", paymentData.getOrderId());
        result.put("razorpay_signature", paymentData.getSignature());
        pendingCall.resolve(result);
        pendingCall = null;
    }

    /** Called by MainActivity.onPaymentError() */
    public void handlePaymentError(int code, String description) {
        if (pendingCall == null) return;
        pendingCall.reject(description != null ? description : "Payment failed", String.valueOf(code));
        pendingCall = null;
    }
}
