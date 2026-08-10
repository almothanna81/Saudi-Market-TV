package com.almothanna.saudimarkettv;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final String SUMMARY_URL = "https://www.saudiexchange.sa/wps/portal/saudiexchange/ourmarkets/main-market-watch/marketsummary?locale=ar";
    private static final String ALL_STOCKS_URL = "https://www.saudiexchange.sa/wps/portal/saudiexchange/ourmarkets/main-market-watch?locale=ar";
    private static final String ARGAAM_URL = "https://www.argaam.com/ar/company/companies-prices";

    private static final String PREFS = "saudi_market_tv";
    private static final String PREF_LAST_URL = "last_url";
    private static final String PREF_LAST_MODE = "last_mode";

    private static final String MODE_SUMMARY = "summary";
    private static final String MODE_ALL = "all";
    private static final String MODE_GAINERS = "gainers";
    private static final String MODE_LOSERS = "losers";
    private static final String MODE_ARGAAM = "argaam";
    private static final String MODE_CUSTOM = "custom";

    private static final long AUTO_REFRESH_MS = 5 * 60 * 1000L;

    private WebView webView;
    private ProgressBar progressBar;
    private LinearLayout sideMenu;
    private boolean menuVisible = false;
    private String currentMode = MODE_SUMMARY;
    private SharedPreferences preferences;

    private final Handler handler = new Handler(Looper.getMainLooper());

    private final Runnable refreshRunnable = new Runnable() {
        @Override
        public void run() {
            refreshPage(false);
            handler.postDelayed(this, AUTO_REFRESH_MS);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enterImmersiveMode();
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        progressBar = new ProgressBar(this);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(dp(64), dp(64));
        progressParams.gravity = Gravity.CENTER;
        root.addView(progressBar, progressParams);

        sideMenu = buildSideMenu();
        FrameLayout.LayoutParams menuParams = new FrameLayout.LayoutParams(
                dp(390),
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        menuParams.gravity = Gravity.RIGHT;
        root.addView(sideMenu, menuParams);
        sideMenu.setVisibility(View.GONE);

        setContentView(root);
        configureWebView();

        currentMode = preferences.getString(PREF_LAST_MODE, MODE_SUMMARY);
        String startupUrl;
        if (MODE_CUSTOM.equals(currentMode)) {
            startupUrl = preferences.getString(PREF_LAST_URL, SUMMARY_URL);
        } else {
            startupUrl = expectedUrlForMode(currentMode);
        }
        webView.loadUrl(startupUrl);
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
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(true);
        settings.setTextZoom(125);
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
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                super.doUpdateVisitedHistory(view, url, isReload);
                if (url == null || url.startsWith("about:")) {
                    return;
                }
                if (!urlMatchesCurrentMode(url)) {
                    currentMode = MODE_CUSTOM;
                }
                preferences.edit()
                        .putString(PREF_LAST_URL, url)
                        .putString(PREF_LAST_MODE, currentMode)
                        .apply();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                super.onPageFinished(view, url);

                scheduleEnhancements(350);
                scheduleEnhancements(1400);
                scheduleEnhancements(3500);
                scheduleEnhancements(7000);

                if (MODE_GAINERS.equals(currentMode)) {
                    scheduleMarketTab("الأكثر ارتفاع", 1700);
                    scheduleMarketTab("الأكثر ارتفاع", 4200);
                } else if (MODE_LOSERS.equals(currentMode)) {
                    scheduleMarketTab("الأكثر انخفاض", 1700);
                    scheduleMarketTab("الأكثر انخفاض", 4200);
                }
            }
        });
    }

    private LinearLayout buildSideMenu() {
        LinearLayout menu = new LinearLayout(this);
        menu.setOrientation(LinearLayout.VERTICAL);
        menu.setPadding(dp(24), dp(30), dp(24), dp(24));
        menu.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        GradientDrawable menuBg = new GradientDrawable();
        menuBg.setColor(Color.rgb(7, 27, 45));
        menuBg.setStroke(dp(1), Color.rgb(36, 75, 93));
        menu.setBackground(menuBg);

        TextView title = new TextView(this);
        title.setText("السوق السعودي");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28);
        title.setGravity(Gravity.RIGHT);
        title.setPadding(dp(8), 0, dp(8), dp(4));
        menu.addView(title, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView hint = new TextView(this);
        hint.setText("V1.2  •  اختر الصفحة بالريموت");
        hint.setTextColor(Color.rgb(151, 184, 198));
        hint.setTextSize(15);
        hint.setGravity(Gravity.RIGHT);
        hint.setPadding(dp(8), 0, dp(8), dp(20));
        menu.addView(hint, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        addRouteButton(menu, "ملخص السوق", MODE_SUMMARY);
        addRouteButton(menu, "جميع الأسهم", MODE_ALL);
        addRouteButton(menu, "الأكثر ارتفاعًا", MODE_GAINERS);
        addRouteButton(menu, "الأكثر انخفاضًا", MODE_LOSERS);
        addRouteButton(menu, "أرقام", MODE_ARGAAM);

        View spacer = new View(this);
        LinearLayout.LayoutParams spacerParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        menu.addView(spacer, spacerParams);

        Button refresh = createMenuButton("↻  تحديث الصفحة");
        refresh.setOnClickListener(v -> {
            refreshPage(true);
            closeSideMenu();
        });
        menu.addView(refresh, menuButtonLayoutParams());

        TextView footer = new TextView(this);
        footer.setText("يمين: القائمة   •   Back: رجوع   •   Play/Pause: تحديث");
        footer.setTextColor(Color.rgb(132, 159, 171));
        footer.setTextSize(13);
        footer.setGravity(Gravity.CENTER);
        footer.setPadding(0, dp(12), 0, 0);
        menu.addView(footer, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        return menu;
    }

    private void addRouteButton(LinearLayout menu, String label, String mode) {
        Button button = createMenuButton(label);
        button.setTag(mode);
        button.setOnClickListener(v -> {
            navigateToMode((String) v.getTag());
            closeSideMenu();
        });
        menu.addView(button, menuButtonLayoutParams());
    }

    private Button createMenuButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(21);
        button.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        button.setAllCaps(false);
        button.setPadding(dp(20), 0, dp(20), 0);
        button.setFocusable(true);
        button.setBackground(createButtonBackground());
        return button;
    }

    private LinearLayout.LayoutParams menuButtonLayoutParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(62));
        params.setMargins(0, dp(5), 0, dp(5));
        return params;
    }

    private StateListDrawable createButtonBackground() {
        StateListDrawable states = new StateListDrawable();

        GradientDrawable focused = new GradientDrawable();
        focused.setColor(Color.rgb(0, 108, 53));
        focused.setCornerRadius(dp(10));
        focused.setStroke(dp(2), Color.WHITE);

        GradientDrawable normal = new GradientDrawable();
        normal.setColor(Color.rgb(17, 48, 66));
        normal.setCornerRadius(dp(10));
        normal.setStroke(dp(1), Color.rgb(45, 79, 97));

        states.addState(new int[]{android.R.attr.state_focused}, focused);
        states.addState(new int[]{android.R.attr.state_pressed}, focused);
        states.addState(new int[]{}, normal);
        return states;
    }

    private void navigateToMode(String mode) {
        currentMode = mode;
        String url = expectedUrlForMode(mode);
        preferences.edit()
                .putString(PREF_LAST_MODE, mode)
                .putString(PREF_LAST_URL, url)
                .apply();
        progressBar.setVisibility(View.VISIBLE);
        webView.loadUrl(url);
    }

    private String expectedUrlForMode(String mode) {
        if (MODE_ALL.equals(mode)) return ALL_STOCKS_URL;
        if (MODE_ARGAAM.equals(mode)) return ARGAAM_URL;
        return SUMMARY_URL;
    }

    private boolean urlMatchesCurrentMode(String url) {
        String lower = url.toLowerCase();
        if (MODE_SUMMARY.equals(currentMode) || MODE_GAINERS.equals(currentMode) || MODE_LOSERS.equals(currentMode)) {
            return lower.contains("saudiexchange.sa") && lower.contains("marketsummary");
        }
        if (MODE_ALL.equals(currentMode)) {
            return lower.contains("saudiexchange.sa") && lower.contains("main-market-watch") && !lower.contains("marketsummary");
        }
        if (MODE_ARGAAM.equals(currentMode)) {
            return lower.contains("argaam.com");
        }
        return true;
    }

    private void scheduleEnhancements(long delayMs) {
        handler.postDelayed(this::applyPageEnhancements, delayMs);
    }

    private void applyPageEnhancements() {
        if (webView == null) return;
        String url = webView.getUrl();
        if (url == null) return;

        if (url.contains("saudiexchange.sa")) {
            injectSaudiExchangeCleanup();
            moveMarketTickerToTop();
        } else if (url.contains("argaam.com")) {
            injectArgaamCleanup();
        }
    }

    private void injectSaudiExchangeCleanup() {
        String script =
                "(function(){try{" +
                "var sid='saudi-tv-clean-style';" +
                "var s=document.getElementById(sid);" +
                "if(!s){s=document.createElement('style');s.id=sid;document.head.appendChild(s);}" +
                "s.textContent='" +
                "html,body{margin:0!important;}" +
                "body{overflow-x:hidden!important;}" +
                "main,[role=main]{max-width:none!important;width:100%!important;}" +
                "table{width:100%!important;}" +
                "';" +
                "function hide(el){if(el&&el.id!==\"saudi-tv-market-ticker\"){el.style.setProperty(\"display\",\"none\",\"important\");}}" +
                "var hs=document.querySelectorAll('header,nav');for(var i=0;i<hs.length;i++){var rr=hs[i].getBoundingClientRect();if(rr.top<280&&rr.height<280)hide(hs[i]);}" +
                "var els=document.querySelectorAll('body *');" +
                "for(var i=0;i<els.length;i++){" +
                "var el=els[i],r=el.getBoundingClientRect();if(r.width<1||r.height<1)continue;" +
                "var t=(el.innerText||'').replace(/\\s+/g,' ').trim();" +
                "if(r.top<260&&r.width>window.innerWidth*.65&&r.height>55&&r.height<250){" +
                "if((/قائمة المتابعة/.test(t)&&/English/.test(t))||/Saudi Exchange/.test(t)){hide(el);continue;}" +
                "}" +
                "if(r.height<110&&/الصفحة الرئيسية/.test(t)&&/الأسواق/.test(t)){hide(el);continue;}" +
                "}" +
                "var cs=document.querySelectorAll('.container');for(var j=0;j<cs.length;j++){var cr=cs[j].getBoundingClientRect();if(cr.top>80){cs[j].style.setProperty('max-width','none','important');cs[j].style.setProperty('width','96%','important');}}" +
                "return 'cleaned';" +
                "}catch(e){return 'cleanup-error:'+e.message;}})();";
        webView.evaluateJavascript(script, null);
    }

    private void injectArgaamCleanup() {
        String script =
                "(function(){try{" +
                "var sid='saudi-tv-argaam-style';var s=document.getElementById(sid);" +
                "if(!s){s=document.createElement('style');s.id=sid;document.head.appendChild(s);}" +
                "s.textContent='header{display:none!important;}nav{display:none!important;}body{margin-top:0!important;} .container{max-width:none!important;width:96%!important;} table{width:100%!important;}';" +
                "return 'argaam-cleaned';" +
                "}catch(e){return 'argaam-error:'+e.message;}})();";
        webView.evaluateJavascript(script, null);
    }

    private void scheduleMarketTab(String wantedText, long delayMs) {
        handler.postDelayed(() -> selectMarketTab(wantedText), delayMs);
    }

    private void selectMarketTab(String wantedText) {
        if (webView == null) return;
        String escaped = wantedText.replace("'", "\\'");
        String script =
                "(function(){try{" +
                "var wanted='" + escaped + "';" +
                "var els=document.querySelectorAll('button,a,li,label,span,div');var target=null;" +
                "for(var i=0;i<els.length;i++){var t=(els[i].innerText||'').replace(/\\s+/g,' ').trim();if(t.indexOf(wanted)===0&&t.length<45){target=els[i];break;}}" +
                "if(!target)return 'tab-not-found';" +
                "var c=target.closest('button,a,li,label')||target;c.click();" +
                "setTimeout(function(){" +
                "var hs=document.querySelectorAll('h1,h2,h3,h4');for(var j=0;j<hs.length;j++){if((hs[j].innerText||'').indexOf('نشاط اليوم')>=0){hs[j].scrollIntoView({block:'start'});window.scrollBy(0,-90);break;}}" +
                "},350);" +
                "return 'tab-selected';" +
                "}catch(e){return 'tab-error:'+e.message;}})();";
        webView.evaluateJavascript(script, null);
    }

    private void moveMarketTickerToTop() {
        if (webView == null) return;

        String script =
                "(function(){" +
                "try{" +
                "var marker='saudi-tv-market-ticker';" +
                "var ticker=document.getElementById(marker);" +
                "function findTicker(){" +
                "var els=document.querySelectorAll('body *');" +
                "var best=null,bestScore=-1;" +
                "for(var i=0;i<els.length;i++){" +
                "var el=els[i];var r=el.getBoundingClientRect();var cs=window.getComputedStyle(el);" +
                "if(r.width<window.innerWidth*0.55||r.height<25||r.height>140)continue;" +
                "if(r.bottom<window.innerHeight-10||r.top>window.innerHeight)continue;" +
                "if(cs.position!=='fixed'&&cs.position!=='sticky'&&cs.bottom==='auto')continue;" +
                "var txt=(el.innerText||'').replace(/\\s+/g,' ').trim();if(txt.length<8)continue;" +
                "var score=0;if(/%|٪/.test(txt))score+=5;var nums=txt.match(/\\d[\\d,.]*/g);score+=Math.min(nums?nums.length:0,8);" +
                "if(/تاسي|السوق|أنابيب|الراجحي|أرامكو|سابك|أكوا|أماك/.test(txt))score+=4;" +
                "if(r.bottom>=window.innerHeight-2)score+=2;if(r.width>=window.innerWidth*0.90)score+=2;" +
                "if(score>bestScore){best=el;bestScore=score;}" +
                "}" +
                "return bestScore>=5?best:null;}" +
                "if(!ticker){ticker=findTicker();if(!ticker)return 'ticker-not-found';ticker.id=marker;}" +
                "ticker.style.setProperty('display','block','important');ticker.style.setProperty('position','fixed','important');" +
                "ticker.style.setProperty('top','0px','important');ticker.style.setProperty('bottom','auto','important');" +
                "ticker.style.setProperty('left','0px','important');ticker.style.setProperty('right','0px','important');" +
                "ticker.style.setProperty('width','100%','important');ticker.style.setProperty('max-width','none','important');" +
                "ticker.style.setProperty('margin','0','important');ticker.style.setProperty('transform','none','important');" +
                "ticker.style.setProperty('z-index','2147483647','important');" +
                "var h=Math.ceil(ticker.getBoundingClientRect().height);if(h>0&&h<160){document.body.style.setProperty('padding-top',h+'px','important');}" +
                "return 'ticker-moved:'+h;" +
                "}catch(e){return 'ticker-error:'+e.message;}" +
                "})();";
        webView.evaluateJavascript(script, null);
    }

    private void refreshPage(boolean showToast) {
        if (webView != null) {
            progressBar.setVisibility(View.VISIBLE);
            webView.reload();
            if (showToast) {
                Toast.makeText(this, "جاري تحديث بيانات السوق…", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void openSideMenu() {
        if (menuVisible) return;
        menuVisible = true;
        sideMenu.setVisibility(View.VISIBLE);
        if (sideMenu.getChildCount() > 2) {
            sideMenu.getChildAt(2).requestFocus();
        }
    }

    private void closeSideMenu() {
        if (!menuVisible) return;
        menuVisible = false;
        sideMenu.setVisibility(View.GONE);
        webView.requestFocus();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            int keyCode = event.getKeyCode();

            if (keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE || keyCode == KeyEvent.KEYCODE_F5) {
                refreshPage(true);
                return true;
            }

            if (keyCode == KeyEvent.KEYCODE_MENU) {
                if (menuVisible) closeSideMenu(); else openSideMenu();
                return true;
            }

            if (!menuVisible && keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
                openSideMenu();
                return true;
            }

            if (menuVisible && keyCode == KeyEvent.KEYCODE_DPAD_LEFT) {
                closeSideMenu();
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
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
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (menuVisible) {
                closeSideMenu();
                return true;
            }
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
                return true;
            }
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

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
