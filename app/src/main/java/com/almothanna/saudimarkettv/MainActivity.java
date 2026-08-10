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
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

public class MainActivity extends Activity {

    private static final String MARKET_URL = "https://www.saudiexchange.sa/wps/portal/saudiexchange/ourmarkets/main-market-watch/marketsummary?locale=ar";
    private static final long AUTO_REFRESH_MS = 5 * 60 * 1000L;

    private WebView webView;
    private ProgressBar progressBar;
    private final Handler refreshHandler = new Handler(Looper.getMainLooper());

    private final Runnable refreshRunnable = new Runnable() {
        @Override
        public void run() {
            if (webView != null) {
                webView.reload();
                refreshHandler.postDelayed(this, AUTO_REFRESH_MS);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enterImmersiveMode();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        root.addView(webView, webParams);

        progressBar = new ProgressBar(this);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(72, 72);
        progressParams.gravity = android.view.Gravity.CENTER;
        root.addView(progressBar, progressParams);

        setContentView(root);
        configureWebView();
        webView.loadUrl(MARKET_URL);
        webView.requestFocus();

        refreshHandler.postDelayed(refreshRunnable, AUTO_REFRESH_MS);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(true);
        settings.setTextZoom(115);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
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
                progressBar.setVisibility(View.GONE);
                super.onPageFinished(view, url);

                // The Saudi Exchange ticker is populated dynamically, so try a few times
                // after the page reports that it has finished loading.
                scheduleTickerMove(1200);
                scheduleTickerMove(3500);
                scheduleTickerMove(7000);
            }
        });
    }

    private void scheduleTickerMove(long delayMs) {
        refreshHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                moveMarketTickerToTop();
            }
        }, delayMs);
    }

    private void moveMarketTickerToTop() {
        if (webView == null) {
            return;
        }

        String script =
                "(function(){" +
                "try{" +
                "var marker='saudi-tv-market-ticker';" +
                "var ticker=document.getElementById(marker);" +
                "function findTicker(){" +
                "var els=document.querySelectorAll('body *');" +
                "var best=null,bestScore=-1;" +
                "for(var i=0;i<els.length;i++){" +
                "var el=els[i];" +
                "var r=el.getBoundingClientRect();" +
                "var cs=window.getComputedStyle(el);" +
                "if(r.width<window.innerWidth*0.55||r.height<25||r.height>140)continue;" +
                "if(r.bottom<window.innerHeight-10||r.top>window.innerHeight)continue;" +
                "if(cs.position!=='fixed'&&cs.position!=='sticky'&&cs.bottom==='auto')continue;" +
                "var txt=(el.innerText||'').replace(/\\s+/g,' ').trim();" +
                "if(txt.length<8)continue;" +
                "var score=0;" +
                "if(/%|٪/.test(txt))score+=5;" +
                "var nums=txt.match(/\\d[\\d,.]*/g);" +
                "score+=Math.min(nums?nums.length:0,8);" +
                "if(/تاسي|السوق|أنابيب|الراجحي|أرامكو|سابك|أكوا|أماك/.test(txt))score+=4;" +
                "if(r.bottom>=window.innerHeight-2)score+=2;" +
                "if(r.width>=window.innerWidth*0.90)score+=2;" +
                "if(score>bestScore){best=el;bestScore=score;}" +
                "}" +
                "return bestScore>=5?best:null;" +
                "}" +
                "if(!ticker){ticker=findTicker();if(!ticker)return 'ticker-not-found';ticker.id=marker;}" +
                "ticker.style.setProperty('position','fixed','important');" +
                "ticker.style.setProperty('top','0px','important');" +
                "ticker.style.setProperty('bottom','auto','important');" +
                "ticker.style.setProperty('left','0px','important');" +
                "ticker.style.setProperty('right','0px','important');" +
                "ticker.style.setProperty('width','100%','important');" +
                "ticker.style.setProperty('max-width','none','important');" +
                "ticker.style.setProperty('margin','0','important');" +
                "ticker.style.setProperty('transform','none','important');" +
                "ticker.style.setProperty('z-index','2147483647','important');" +
                "var h=Math.ceil(ticker.getBoundingClientRect().height);" +
                "if(h>0&&h<160){document.body.style.setProperty('padding-top',h+'px','important');}" +
                "return 'ticker-moved:'+h;" +
                "}catch(e){return 'ticker-error:'+e.message;}" +
                "})();";

        webView.evaluateJavascript(script, null);
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
        if (hasFocus) {
            enterImmersiveMode();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        enterImmersiveMode();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        refreshHandler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
