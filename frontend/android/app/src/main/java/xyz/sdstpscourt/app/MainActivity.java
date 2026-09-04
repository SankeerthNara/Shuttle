package xyz.sdstpscourt.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.util.Log;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.PluginHandle;
import com.razorpay.Checkout;
import com.razorpay.PaymentData;
import com.razorpay.PaymentResultWithDataListener;

public class MainActivity extends BridgeActivity implements PaymentResultWithDataListener {

    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom Capacitor plugins must be registered BEFORE super.onCreate() runs.
        registerPlugin(RazorpayCheckoutPlugin.class);
        super.onCreate(savedInstanceState);

        // Recommended by Razorpay: preload the SDK for a faster first checkout.
        Checkout.preload(getApplicationContext());

        WebView webView = this.bridge.getWebView();
        
        // Allow bank popups and OTP windows to open
        WebSettings settings = webView.getSettings();
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Handle popup windows (required for some banks and Razorpay features)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                Log.d(TAG, "onCreateWindow called. isDialog: " + isDialog);
                
                WebView newWebView = new WebView(MainActivity.this);
                newWebView.getSettings().setJavaScriptEnabled(true);
                newWebView.getSettings().setSupportMultipleWindows(true);
                newWebView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
                newWebView.getSettings().setDomStorageEnabled(true);
                
                // Set a layout for the new WebView so it's visible if it's a dialog
                newWebView.setLayoutParams(new android.widget.FrameLayout.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT
                ));

                // Add it to the activity's content view (or a dialog)
                // For simplicity, we'll use a Dialog here
                android.app.Dialog dialog = new android.app.Dialog(MainActivity.this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
                dialog.setContentView(newWebView);
                dialog.show();

                newWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        Log.d(TAG, "onCloseWindow called");
                        dialog.dismiss();
                    }
                });

                newWebView.setWebViewClient(new BridgeWebViewClient(MainActivity.this.bridge) {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        if (handlePaymentUrl(view, url)) {
                            dialog.dismiss(); // Close popup if we're launching an app
                            return true;
                        }
                        return super.shouldOverrideUrlLoading(view, request);
                    }
                });

                ((WebView.WebViewTransport) resultMsg.obj).setWebView(newWebView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        // Extend Capacitor's own BridgeWebViewClient
        webView.setWebViewClient(new BridgeWebViewClient(this.bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                Log.d(TAG, "shouldOverrideUrlLoading: " + url);
                
                if (handlePaymentUrl(view, url)) {
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }

    /**
     * Centralized handling for UPI and banking app redirects.
     */
    private boolean handlePaymentUrl(WebView view, String url) {
        if (url == null) return false;
        
        if (url.startsWith("upi:") || url.startsWith("intent:") || url.startsWith("paytmmp:") || 
            url.startsWith("tez:") || url.startsWith("phonepe:") || url.startsWith("paytm:") ||
            url.contains("market://") || url.contains("play.google.com")) {
            
            Log.i(TAG, "Handling payment or store redirect: " + url);
            try {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                if (intent != null) {
                    intent.addCategory(Intent.CATEGORY_BROWSABLE);
                    intent.setComponent(null);
                    intent.setSelector(null);
                    
                    // If it's an intent URL and the app is not installed, the browser should handle the fallback
                    if (view.getContext().getPackageManager().resolveActivity(intent, 0) == null) {
                        String packagename = intent.getPackage();
                        if (packagename != null) {
                            intent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packagename));
                            view.getContext().startActivity(intent);
                            return true;
                        }
                        return false;
                    }

                    view.getContext().startActivity(intent);
                    return true;
                }
            } catch (Exception e) {
                Log.e(TAG, "Error handling payment redirect", e);
            }
        }
        return false;
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
        if (plugin != null) plugin.handlePaymentError(code, description, paymentData);
    }
}
