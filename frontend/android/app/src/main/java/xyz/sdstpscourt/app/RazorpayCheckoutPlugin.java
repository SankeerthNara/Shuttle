package xyz.sdstpscourt.app;

import android.util.Log;
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

    private static final String TAG = "RazorpayCheckoutPlugin";
    private PluginCall pendingCall;

    @PluginMethod
    public void open(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (this.pendingCall != null) {
                Log.w(TAG, "A payment is already in progress. Rejecting new request.");
                call.reject("A payment is already in progress.");
                return;
            }
            this.pendingCall = call;
            try {
                Log.d(TAG, "Opening Razorpay checkout with data: " + call.getData().toString());
                Checkout checkout = new Checkout();

                // Create options from all provided data
                JSONObject options = new JSONObject();
                JSObject data = call.getData();
                java.util.Iterator<String> keys = data.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    Object value = data.get(k);
                    if (value instanceof JSObject) {
                        options.put(k, new JSONObject(value.toString()));
                    } else {
                        options.put(k, value);
                    }
                }
                
                // Razorpay Key ID
                String key = call.getString("key");
                if (key == null && !options.has("key")) {
                    Log.e(TAG, "Razorpay Key ID is missing");
                    call.reject("Razorpay Key ID is missing");
                    this.pendingCall = null;
                    return;
                }
                if (key != null) checkout.setKeyID(key);

                // Ensure amount is an integer (Razorpay requirement: amount in paise)
                if (options.has("amount")) {
                    Object amountObj = options.get("amount");
                    if (amountObj instanceof String) {
                        try {
                            options.put("amount", (int) (Double.parseDouble((String) amountObj)));
                        } catch (Exception e) {
                            Log.e(TAG, "Failed to parse amount string: " + amountObj);
                        }
                    } else if (amountObj instanceof Double) {
                        options.put("amount", ((Double) amountObj).intValue());
                    } else if (amountObj instanceof Long) {
                        options.put("amount", ((Long) amountObj).intValue());
                    } else if (amountObj instanceof Float) {
                        options.put("amount", ((Float) amountObj).intValue());
                    }
                } else {
                    Log.e(TAG, "Amount is required");
                    call.reject("Amount is required");
                    this.pendingCall = null;
                    return;
                }

                // Fallback defaults if not provided
                if (!options.has("name")) options.put("name", "The Court");
                if (!options.has("currency")) options.put("currency", "INR");

                Log.d(TAG, "Final options sent to Razorpay: " + options.toString());
                checkout.open(getActivity(), options);
            } catch (Exception e) {
                Log.e(TAG, "Error starting checkout", e);
                call.reject("Could not start checkout: " + e.getMessage());
                this.pendingCall = null;
            }
        });
    }

    /** Called by MainActivity.onPaymentSuccess() */
    public void handlePaymentSuccess(String razorpayPaymentId, PaymentData paymentData) {
        Log.d(TAG, "Payment Success: " + razorpayPaymentId);
        if (pendingCall == null) {
            Log.e(TAG, "No pending call found for success");
            return;
        }
        JSObject result = new JSObject();
        result.put("razorpay_payment_id", razorpayPaymentId);
        result.put("razorpay_order_id", paymentData.getOrderId());
        result.put("razorpay_signature", paymentData.getSignature());
        pendingCall.resolve(result);
        pendingCall = null;
    }

    /** Called by MainActivity.onPaymentError() */
    public void handlePaymentError(int code, String description, PaymentData paymentData) {
        Log.d(TAG, "Payment Error: " + code + " - " + description);
        if (pendingCall == null) {
            Log.e(TAG, "No pending call found for error");
            return;
        }
        
        JSObject errorData = new JSObject();
        errorData.put("code", code);
        errorData.put("description", description);
        if (paymentData != null) {
            errorData.put("order_id", paymentData.getOrderId());
            errorData.put("payment_id", paymentData.getPaymentId());
        }
        
        pendingCall.reject(description != null ? description : "Payment failed", String.valueOf(code), errorData);
        pendingCall = null;
    }
}
