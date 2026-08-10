package com.almothanna.saudimarkettv;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.view.Gravity;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private static final String ALL_STOCKS_URL =
            "https://www.saudiexchange.sa/wps/portal/saudiexchange/ourmarkets/main-market-watch?locale=ar";
    private static final long AUTO_REFRESH_MS = 5 * 60 * 1000L;

    private WebView webView;
    private ProgressBar progressBar;
    private String dashboardScript = "";
    private final Handler handler = new Handler(Looper.getMainLooper());

    private final Runnable refreshRunnable = new Runnable() {
        @Override
        public void run() {
            refreshMarket();
            handler.postDelayed(this, AUTO_REFRESH_MS);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        enterImmersiveMode();

        dashboardScript = readAsset("dashboard_v21.js") + "\n" + readAsset("ticker_fix_v22.js");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(7, 19, 29));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 19, 29));
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        progressBar = new ProgressBar(this);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(72, 72);
        progressParams.gravity = Gravity.CENTER;
        root.addView(progressBar, progressParams);

        setContentView(root);
        configureWebView();
        webView.loadUrl(ALL_STOCKS_URL);
        webView.requestFocus();
        handler.postDelayed(refreshRunnable, AUTO_REFRESH_MS);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
                scheduleDashboard(400);
                scheduleDashboard(1400);
                scheduleDashboard(3200);
                scheduleDashboard(6000);
                scheduleDashboard(10000);
            }
        });
    }

    private void scheduleDashboard(long delayMs) {
        handler.postDelayed(this::injectDashboard, delayMs);
    }

    private void injectDashboard() {
        if (webView == null || dashboardScript == null || dashboardScript.isEmpty()) return;
        webView.evaluateJavascript(dashboardScript, null);
    }

    private void refreshMarket() {
        if (webView == null) return;
        progressBar.setVisibility(View.VISIBLE);
        webView.reload();
    }

    private void scrollStocks(int amount) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "if(window.saudiTvScroll){window.saudiTvScroll(" + amount + ");}", null);
    }

    private String readAsset(String name) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                getAssets().open(name), StandardCharsets.UTF_8))) {
            StringBuilder out = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) out.append(line).append('\n');
            return out.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    @Override
    protected void onResume() {
        super.onResume();
        enterImmersiveMode();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
                || keyCode == KeyEvent.KEYCODE_MEDIA_PLAY
                || keyCode == KeyEvent.KEYCODE_F5) {
            refreshMarket();
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN || keyCode == KeyEvent.KEYCODE_PAGE_DOWN) {
            scrollStocks(280);
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_DPAD_UP || keyCode == KeyEvent.KEYCODE_PAGE_UP) {
            scrollStocks(-280);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
