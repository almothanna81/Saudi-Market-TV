package com.almothanna.saudimarkettv;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
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

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {

    private static final String ALL_STOCKS_URL =
            "https://www.saudiexchange.sa/wps/portal/saudiexchange/ourmarkets/main-market-watch?locale=ar";
    private static final String GOLD_URL = "https://api.gold-api.com/price/XAU";
    private static final String ENERGY_HOME_URL = "https://energypriceapi.com/";
    private static final String ENERGY_BRENT_URL = "https://energypriceapi.com/brent";

    private static final long COMMODITY_REFRESH_MS = 10 * 1000L;
    private static final long MARKET_REFRESH_MS = 15 * 1000L;
    private static final long READY_CHECK_INTERVAL_MS = 250L;
    private static final int MAX_READY_CHECKS = 100;

    private WebView webView;
    private WebView dataWebView;
    private FrameLayout loadingOverlay;
    private String dashboardScript = "";
    private String extractorScript = "";
    private String latestMarketPayloadLiteral = null;
    private int readinessChecks = 0;

    private volatile String goldPrice = null;
    private volatile String brentPrice = null;
    private volatile String goldStatus = "جارٍ التحديث…";
    private volatile String brentStatus = "جارٍ التحديث…";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService commodityExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean commodityFetchInProgress = new AtomicBoolean(false);

    private final Runnable commodityRefreshRunnable = new Runnable() {
        @Override
        public void run() {
            refreshCommodities();
            handler.postDelayed(this, COMMODITY_REFRESH_MS);
        }
    };

    private final Runnable marketRefreshRunnable = this::loadFreshMarketSource;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        enterImmersiveMode();

        dashboardScript = readAsset("dashboard_v21.js")
                + "\n" + readAsset("ticker_fix_v22.js")
                + "\n" + readAsset("commodities_v23.js")
                + "\n" + readAsset("live_market_v26.js");
        extractorScript = readAsset("extractor_v26.js");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(0, 132, 213));

        dataWebView = new WebView(this);
        dataWebView.setBackgroundColor(Color.TRANSPARENT);
        dataWebView.setAlpha(0f);
        dataWebView.setFocusable(false);
        dataWebView.setFocusableInTouchMode(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            dataWebView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        }
        root.addView(dataWebView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 19, 29));
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setAlpha(0f);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        loadingOverlay = new FrameLayout(this);
        loadingOverlay.setBackgroundColor(Color.rgb(0, 132, 213));
        loadingOverlay.setClickable(true);
        loadingOverlay.setFocusable(true);

        ProgressBar progressBar = new ProgressBar(this);
        progressBar.setIndeterminate(true);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(72, 72);
        progressParams.gravity = Gravity.CENTER;
        loadingOverlay.addView(progressBar, progressParams);

        root.addView(loadingOverlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);
        configureMainWebView();
        configureDataWebView();

        showLoadingCover();
        webView.loadUrl(ALL_STOCKS_URL);
        webView.requestFocus();

        handler.postDelayed(commodityRefreshRunnable, 1000L);
        handler.postDelayed(marketRefreshRunnable, 3500L);
    }

    private void configureCommonWebSettings(WebView target) {
        WebSettings settings = target.getSettings();
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
            cookieManager.setAcceptThirdPartyCookies(target, true);
        }
    }

    private void configureMainWebView() {
        configureCommonWebSettings(webView);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                scheduleDashboard(100);
                scheduleDashboard(350);
                scheduleDashboard(800);
                scheduleDashboard(1500);
                scheduleDashboard(2800);
                scheduleDashboard(5000);
                handler.postDelayed(MainActivity.this::checkDashboardReady, 400L);
            }
        });
    }

    private void configureDataWebView() {
        configureCommonWebSettings(dataWebView);
        dataWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (extractorScript != null && !extractorScript.isEmpty()) {
                    dataWebView.evaluateJavascript(extractorScript, ignored -> {
                        scheduleMarketExtraction(700L);
                        scheduleMarketExtraction(1700L);
                        scheduleMarketExtraction(3200L);
                    });
                }
                scheduleNextMarketRefresh();
            }
        });
    }

    private void scheduleDashboard(long delayMs) {
        handler.postDelayed(this::injectDashboard, delayMs);
    }

    private void injectDashboard() {
        if (webView == null || dashboardScript == null || dashboardScript.isEmpty()) return;
        webView.evaluateJavascript(dashboardScript, value -> {
            pushCommodityPricesToDashboard();
            pushLatestMarketDataToDashboard();
            checkDashboardReady();
        });
    }

    private void showLoadingCover() {
        readinessChecks = 0;
        handler.removeCallbacks(readyCheckRunnable);
        if (webView != null) webView.setAlpha(0f);
        if (loadingOverlay != null) loadingOverlay.setVisibility(View.VISIBLE);
    }

    private void revealDashboard() {
        handler.removeCallbacks(readyCheckRunnable);
        if (webView != null) webView.setAlpha(1f);
        if (loadingOverlay != null) loadingOverlay.setVisibility(View.GONE);
        pushLatestMarketDataToDashboard();
        pushCommodityPricesToDashboard();
        if (webView != null) webView.requestFocus();
    }

    private final Runnable readyCheckRunnable = this::checkDashboardReady;

    private void checkDashboardReady() {
        if (webView == null) return;

        String checkScript =
                "(function(){" +
                "var d=document.getElementById('saudi-tv-dashboard');" +
                "var t=document.getElementById('saudi-tv-table');" +
                "var rows=t?t.querySelectorAll('tbody tr').length:0;" +
                "var tasi=document.getElementById('saudi-tv-tasi-value');" +
                "return !!(d&&t&&rows>0&&tasi&&tasi.textContent&&tasi.textContent.trim()!=='—');" +
                "})()";

        webView.evaluateJavascript(checkScript, value -> {
            if ("true".equals(value)) {
                revealDashboard();
                return;
            }

            readinessChecks++;
            if (readinessChecks < MAX_READY_CHECKS) {
                handler.removeCallbacks(readyCheckRunnable);
                handler.postDelayed(readyCheckRunnable, READY_CHECK_INTERVAL_MS);
            }
        });
    }

    private void loadFreshMarketSource() {
        if (dataWebView == null) return;
        handler.removeCallbacks(marketRefreshRunnable);
        String freshUrl = ALL_STOCKS_URL + "&_tv=" + System.currentTimeMillis();
        dataWebView.loadUrl(freshUrl);
    }

    private void scheduleNextMarketRefresh() {
        handler.removeCallbacks(marketRefreshRunnable);
        handler.postDelayed(marketRefreshRunnable, MARKET_REFRESH_MS);
    }

    private void scheduleMarketExtraction(long delayMs) {
        handler.postDelayed(this::extractMarketDataFromSource, delayMs);
    }

    private void extractMarketDataFromSource() {
        if (dataWebView == null) return;
        dataWebView.evaluateJavascript(
                "window.saudiTvExportMarketData?window.saudiTvExportMarketData():'';",
                value -> {
                    if (value == null || "null".equals(value) || "\"\"".equals(value)) return;
                    latestMarketPayloadLiteral = value;
                    pushLatestMarketDataToDashboard();
                }
        );
    }

    private void pushLatestMarketDataToDashboard() {
        if (webView == null || latestMarketPayloadLiteral == null) return;
        String script =
                "if(window.saudiTvApplyMarketData){try{" +
                "window.saudiTvApplyMarketData(JSON.parse(" + latestMarketPayloadLiteral + "));" +
                "}catch(e){}}";
        webView.evaluateJavascript(script, null);
    }

    private void refreshMarket() {
        loadFreshMarketSource();
    }

    private void refreshCommodities() {
        if (!commodityFetchInProgress.compareAndSet(false, true)) return;

        commodityExecutor.submit(() -> {
            try {
                boolean goldOk = false;
                boolean brentOk = false;

                try {
                    String goldJson = fetchUrl(GOLD_URL);
                    Double parsedGold = parseGoldPrice(goldJson);
                    if (parsedGold != null && parsedGold >= 500 && parsedGold <= 10000) {
                        goldPrice = String.format(Locale.US, "%.2f", parsedGold);
                        goldStatus = "تحديث كل 10 ثوانٍ";
                        goldOk = true;
                    }
                } catch (Exception ignored) {
                }

                try {
                    String energyHtml = fetchUrl(ENERGY_HOME_URL);
                    Double parsedBrent = parseBrentPrice(energyHtml);
                    if (parsedBrent == null) {
                        energyHtml = fetchUrl(ENERGY_BRENT_URL);
                        parsedBrent = parseBrentPrice(energyHtml);
                    }
                    if (parsedBrent != null && parsedBrent >= 20 && parsedBrent <= 300) {
                        brentPrice = String.format(Locale.US, "%.2f", parsedBrent);
                        brentStatus = "تحديث كل 10 ثوانٍ";
                        brentOk = true;
                    }
                } catch (Exception ignored) {
                }

                if (!goldOk) {
                    goldStatus = goldPrice == null ? "تعذر جلب السعر" : "آخر قراءة محفوظة";
                }
                if (!brentOk) {
                    brentStatus = brentPrice == null ? "تعذر جلب السعر" : "آخر قراءة محفوظة";
                }

                handler.post(this::pushCommodityPricesToDashboard);
            } finally {
                commodityFetchInProgress.set(false);
            }
        });
    }

    private String fetchUrl(String urlString) throws Exception {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(urlString);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(9000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("User-Agent",
                    "Mozilla/5.0 (Linux; Android 14; Google TV) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
            connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
            connection.setRequestProperty("Accept", "application/json,text/html,*/*");

            int code = connection.getResponseCode();
            if (code < 200 || code >= 400) throw new Exception("HTTP " + code);

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    connection.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder out = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    out.append(line).append('\n');
                    if (out.length() > 2_000_000) break;
                }
                return out.toString();
            }
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private Double parseGoldPrice(String json) {
        if (json == null) return null;
        Matcher matcher = Pattern.compile("\\\"price\\\"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)")
                .matcher(json);
        if (!matcher.find()) return null;
        try {
            return Double.parseDouble(matcher.group(1));
        } catch (Exception e) {
            return null;
        }
    }

    private Double parseBrentPrice(String source) {
        if (source == null || source.isEmpty()) return null;

        Matcher jsonRate = Pattern.compile(
                "(?i)\\\"(?:BRENT|BRT)\\\"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)")
                .matcher(source);
        if (jsonRate.find()) {
            try {
                double v = Double.parseDouble(jsonRate.group(1));
                if (v >= 20 && v <= 300) return v;
            } catch (Exception ignored) {
            }
        }

        String plain = source
                .replaceAll("(?is)<script[^>]*>.*?</script>", " ")
                .replaceAll("(?is)<style[^>]*>.*?</style>", " ")
                .replaceAll("(?is)<[^>]+>", " ")
                .replace("&nbsp;", " ")
                .replace("&dollar;", "$")
                .replace("&#36;", "$")
                .replaceAll("\\s+", " ");

        String lower = plain.toLowerCase(Locale.US);
        int index = lower.indexOf("brent crude oil");
        if (index < 0) index = lower.indexOf("brent crude");
        if (index < 0) index = lower.indexOf("brent");
        if (index < 0) return null;

        String chunk = plain.substring(index, Math.min(plain.length(), index + 900));
        Matcher money = Pattern.compile("\\$\\s*([0-9]{1,3}(?:\\.[0-9]{1,6})?)")
                .matcher(chunk);
        while (money.find()) {
            try {
                double v = Double.parseDouble(money.group(1));
                if (v >= 20 && v <= 300) return v;
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private void pushCommodityPricesToDashboard() {
        if (webView == null) return;
        String script = "if(window.saudiTvSetCommodities){window.saudiTvSetCommodities("
                + jsValue(goldPrice) + ","
                + jsValue(brentPrice) + ","
                + jsValue(goldStatus) + ","
                + jsValue(brentStatus) + ");}";
        webView.evaluateJavascript(script, null);
    }

    private String jsValue(String value) {
        if (value == null) return "null";
        return "'" + value
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\r", " ")
                .replace("\n", " ") + "'";
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
        pushCommodityPricesToDashboard();
        pushLatestMarketDataToDashboard();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
                || keyCode == KeyEvent.KEYCODE_MEDIA_PLAY
                || keyCode == KeyEvent.KEYCODE_F5) {
            refreshMarket();
            refreshCommodities();
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
        commodityExecutor.shutdownNow();
        if (dataWebView != null) {
            dataWebView.stopLoading();
            dataWebView.destroy();
            dataWebView = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
