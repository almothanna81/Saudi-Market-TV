(function () {
  'use strict';

  function installFixStyle() {
    var style = document.getElementById('saudi-tv-v22-fix-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'saudi-tv-v22-fix-style';
      document.head.appendChild(style);
    }

    style.textContent = [
      '#saudi-tv-dashboard{position:fixed!important;inset:0!important;display:block!important;overflow:hidden!important;transform:none!important;}',
      '#saudi-tv-ticker-slot{position:absolute!important;top:0!important;left:0!important;right:0!important;height:8vh!important;min-height:58px!important;z-index:100!important;display:flex!important;visibility:visible!important;opacity:1!important;overflow:hidden!important;transform:none!important;will-change:auto!important;clip-path:none!important;border-radius:0!important;contain:layout paint style!important;}',
      '#saudi-tv-ticker-viewport{position:relative!important;width:100%!important;height:100%!important;overflow:hidden!important;direction:ltr!important;transform:none!important;will-change:auto!important;}',
      '#saudi-tv-ticker-track{position:relative!important;display:flex!important;width:max-content!important;min-width:max-content!important;animation:none!important;transform:none!important;will-change:auto!important;left:auto!important;right:auto!important;}',
      '#saudi-tv-tasi{position:absolute!important;top:8vh!important;left:0!important;right:0!important;height:11vh!important;min-height:82px!important;z-index:20!important;}',
      '#saudi-tv-sabic{position:absolute!important;top:19vh!important;left:0!important;right:0!important;height:11vh!important;min-height:82px!important;z-index:20!important;}',
      '#saudi-tv-table-wrap{position:absolute!important;top:30vh!important;bottom:0!important;left:0!important;right:0!important;height:auto!important;z-index:10!important;overflow-y:auto!important;overflow-x:hidden!important;transform:none!important;}',
      '@media (max-height:760px){#saudi-tv-ticker-slot{height:58px!important}#saudi-tv-tasi{top:58px!important}#saudi-tv-sabic{top:140px!important}#saudi-tv-table-wrap{top:222px!important}}'
    ].join('');
  }

  function enforceTickerLayer() {
    installFixStyle();

    var dash = document.getElementById('saudi-tv-dashboard');
    var slot = document.getElementById('saudi-tv-ticker-slot');
    var viewport = document.getElementById('saudi-tv-ticker-viewport');
    var track = document.getElementById('saudi-tv-ticker-track');

    if (dash) {
      dash.style.setProperty('position', 'fixed', 'important');
      dash.style.setProperty('inset', '0', 'important');
      dash.style.setProperty('overflow', 'hidden', 'important');
      dash.style.setProperty('transform', 'none', 'important');
    }

    if (slot) {
      slot.style.setProperty('position', 'absolute', 'important');
      slot.style.setProperty('top', '0', 'important');
      slot.style.setProperty('left', '0', 'important');
      slot.style.setProperty('right', '0', 'important');
      slot.style.setProperty('display', 'flex', 'important');
      slot.style.setProperty('visibility', 'visible', 'important');
      slot.style.setProperty('opacity', '1', 'important');
      slot.style.setProperty('z-index', '100', 'important');
      slot.style.setProperty('transform', 'none', 'important');
    }

    if (viewport) {
      viewport.setAttribute('dir', 'ltr');
      viewport.style.setProperty('overflow', 'hidden', 'important');
      viewport.style.setProperty('transform', 'none', 'important');
    }

    if (track) {
      track.style.setProperty('animation', 'none', 'important');
      track.style.setProperty('transform', 'none', 'important');
      track.style.setProperty('will-change', 'auto', 'important');
    }
  }

  function startTickerLoop() {
    if (window.__saudiTvTickerLoopV22Started) return;
    window.__saudiTvTickerLoopV22Started = true;

    var last = performance.now();
    var carry = 0;
    var pixelsPerMs = 0.055; // about 55 px/sec; smooth and readable on a 65-inch TV.

    function tick(now) {
      var viewport = document.getElementById('saudi-tv-ticker-viewport');
      var groupA = document.getElementById('saudi-tv-ticker-a');
      var track = document.getElementById('saudi-tv-ticker-track');

      if (viewport && groupA && track) {
        track.style.setProperty('animation', 'none', 'important');
        track.style.setProperty('transform', 'none', 'important');

        var dt = Math.min(100, Math.max(0, now - last));
        carry += dt * pixelsPerMs;
        if (carry >= 1) {
          var step = Math.floor(carry);
          carry -= step;
          viewport.scrollLeft += step;

          var loopWidth = groupA.scrollWidth;
          if (loopWidth > 0 && viewport.scrollLeft >= loopWidth) {
            viewport.scrollLeft = viewport.scrollLeft - loopWidth;
          }
        }
      }

      last = now;
      window.__saudiTvTickerLoopV22Raf = requestAnimationFrame(tick);
    }

    window.__saudiTvTickerLoopV22Raf = requestAnimationFrame(tick);
  }

  function installGuards() {
    if (!window.__saudiTvTickerGuardV22) {
      window.__saudiTvTickerGuardV22 = new MutationObserver(function () {
        clearTimeout(window.__saudiTvTickerGuardTimerV22);
        window.__saudiTvTickerGuardTimerV22 = setTimeout(function () {
          enforceTickerLayer();
          startTickerLoop();
        }, 30);
      });
      window.__saudiTvTickerGuardV22.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (!window.__saudiTvTickerScrollGuardV22) {
      window.__saudiTvTickerScrollGuardV22 = true;
      document.addEventListener('scroll', function () {
        enforceTickerLayer();
      }, true);
    }
  }

  enforceTickerLayer();
  startTickerLoop();
  installGuards();

  setTimeout(enforceTickerLayer, 300);
  setTimeout(enforceTickerLayer, 1200);
  setTimeout(enforceTickerLayer, 3500);
})();
