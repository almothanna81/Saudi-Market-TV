(function () {
  'use strict';

  function ensureCommodityUi() {
    var tasi = document.getElementById('saudi-tv-tasi');
    if (!tasi) return false;

    var style = document.getElementById('saudi-tv-commodities-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'saudi-tv-commodities-style';
      document.head.appendChild(style);
    }
    style.textContent = [
      '#saudi-tv-tasi{position:absolute!important;}',
      '#saudi-tv-commodities{position:absolute;left:1.8vw;top:0;bottom:0;display:flex;align-items:center;gap:.85vw;direction:rtl;z-index:8;pointer-events:none;}',
      '.saudi-tv-commodity{width:13.2vw;min-width:190px;height:7.5vh;min-height:58px;box-sizing:border-box;border-radius:10px;background:rgba(2,37,61,.34);border:1px solid rgba(255,255,255,.24);display:flex;flex-direction:column;justify-content:center;padding:.55vh 1vw;box-shadow:0 2px 9px rgba(0,0,0,.12);}',
      '.saudi-tv-commodity.gold{border-right:5px solid #f2c94c;}',
      '.saudi-tv-commodity.brent{border-right:5px solid #d7eef9;}',
      '.saudi-tv-commodity-title{font-size:1.03vw;font-weight:800;color:#f6fbff;line-height:1.05;text-align:right;}',
      '.saudi-tv-commodity-line{display:flex;align-items:baseline;gap:.42vw;direction:ltr;margin-top:.3vh;}',
      '.saudi-tv-commodity-price{font-size:1.55vw;font-weight:900;color:#ffffff;letter-spacing:.01em;}',
      '.saudi-tv-commodity-unit{font-size:.78vw;font-weight:700;color:#d9edf7;direction:rtl;}',
      '.saudi-tv-commodity-status{font-size:.63vw;color:#b8d2df;margin-top:.05vh;text-align:right;min-height:.7em;}',
      '@media (max-width:1280px){#saudi-tv-commodities{left:16px;gap:10px}.saudi-tv-commodity{width:185px;min-width:185px}.saudi-tv-commodity-title{font-size:15px}.saudi-tv-commodity-price{font-size:22px}.saudi-tv-commodity-unit{font-size:11px}.saudi-tv-commodity-status{font-size:9px}}'
    ].join('');

    var box = document.getElementById('saudi-tv-commodities');
    if (!box) {
      box = document.createElement('div');
      box.id = 'saudi-tv-commodities';
      box.innerHTML =
        '<div class="saudi-tv-commodity gold">' +
          '<div class="saudi-tv-commodity-title">الذهب <span style="opacity:.72;font-size:.8em">XAU</span></div>' +
          '<div class="saudi-tv-commodity-line"><span id="saudi-tv-gold-price" class="saudi-tv-commodity-price">—</span><span class="saudi-tv-commodity-unit">دولار / أونصة</span></div>' +
          '<div id="saudi-tv-gold-status" class="saudi-tv-commodity-status">جارٍ التحديث…</div>' +
        '</div>' +
        '<div class="saudi-tv-commodity brent">' +
          '<div class="saudi-tv-commodity-title">خام برنت</div>' +
          '<div class="saudi-tv-commodity-line"><span id="saudi-tv-brent-price" class="saudi-tv-commodity-price">—</span><span class="saudi-tv-commodity-unit">دولار / برميل</span></div>' +
          '<div id="saudi-tv-brent-status" class="saudi-tv-commodity-status">جارٍ التحديث…</div>' +
        '</div>';
      tasi.appendChild(box);
    }
    return true;
  }

  function setPrice(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    if (value === null || value === undefined || value === '' || value === '—') {
      el.textContent = '—';
      return;
    }
    var n = Number(value);
    el.textContent = isFinite(n) ? '$' + n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : String(value);
  }

  window.saudiTvSetCommodities = function (gold, brent, goldStatus, brentStatus) {
    if (!ensureCommodityUi()) return;
    setPrice('saudi-tv-gold-price', gold);
    setPrice('saudi-tv-brent-price', brent);
    var gs = document.getElementById('saudi-tv-gold-status');
    var bs = document.getElementById('saudi-tv-brent-status');
    if (gs) gs.textContent = goldStatus || '';
    if (bs) bs.textContent = brentStatus || '';
  };

  function keepUiAlive() {
    ensureCommodityUi();
  }

  keepUiAlive();
  setInterval(keepUiAlive, 2000);
})();
