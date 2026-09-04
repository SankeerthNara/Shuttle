package xyz.sdstpscourt.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.PluginHandle;
import com.razorpay.Checkout;
import com.razorpay.PaymentData;
import com.razorpay.PaymentResultWithDataListener;

public class MainActivity extends BridgeActivity implements PaymentResultWithDataListener {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom Capacitor plugins must be registered BEFORE super.onCreate() runs.
        registerPlugin(RazorpayCheckoutPlugin.class);
        super.onCreate(savedInstanceState);

        // Recommended by Razorpay: preload the SDK for a faster first checkout.
        Checkout.preload(getApplicationContext());

        // Allow bank popups and OTP windows to open
        this.bridge.getWebView().getSettings().setSupportMultipleWindows(true);
        this.bridge.getWebView().getSettings().setJavaScriptCanOpenWindowsAutomatically(true);

        // Extend Capacitor's own BridgeWebViewClient (instead of replacing it with a plain
        // WebViewClient) so the app's local assets and plugin bridge keep working — we only
        // add UPI/bank-app redirect handling on top of Capacitor's existing behavior.
        this.bridge.getWebView().setWebViewClient(new BridgeWebViewClient(this.bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("upi:") || url.startsWith("intent:") || url.startsWith("paytmmp:")) {
                    try {
                        Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                        if (intent != null) {
                            view.getContext().startActivity(intent);
                            return true;
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }

    private RazorpayCheckoutPlugin getRazorpayPlugin() {
        PluginHandle handle = this.bridge.getPlugin("RazorpayCheckout");
        return handle != null ? (RazorpayCheckoutPlugin) handle.getInstance() : null;
    }

    @Override
    public void onPaymentSuccess(String razorpayPaymentId, PaymentData paymentData) {
        RazorpayCheckoutPlugin plugin = getRazorpayPlugin();
        if (plugin != null) plugin.handlePaymentSuccess(razorpayPaymentId, paymentData);
    }

    @Override
    public void onPaymentError(int code, String description, PaymentData paymentData) {
        RazorpayCheckoutPlugin plugin = getRazorpayPlugin();
        if (plugin != null) plugin.handlePaymentError(code, description);
    }
}
