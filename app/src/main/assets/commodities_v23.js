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
      '#saudi-tv-commodities{position:absolute;left:2.6vw;top:0;bottom:0;width:29vw;display:flex;align-items:center;justify-content:flex-start;direction:rtl;z-index:8;pointer-events:none;}',
      '.saudi-tv-commodity{height:62%;min-height:58px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;padding:0 1.65vw;background:transparent;border:0;border-radius:0;box-shadow:none;}',
      '.saudi-tv-commodity.gold{width:14.5vw;border-left:1px solid rgba(255,255,255,.28);}',
      '.saudi-tv-commodity.brent{width:14.5vw;}',
      '.saudi-tv-commodity-title{font-size:1.18vw;font-weight:800;color:#f5fbff;line-height:1;text-align:right;margin-bottom:.62vh;}',
      '.saudi-tv-commodity-price{font-size:2.05vw;font-weight:900;color:#ffffff;line-height:1;direction:ltr;text-align:right;letter-spacing:.01em;}',
      '.saudi-tv-commodity-unit,.saudi-tv-commodity-status{display:none!important;}',
      '@media (max-width:1280px){#saudi-tv-commodities{left:24px;width:390px}.saudi-tv-commodity.gold,.saudi-tv-commodity.brent{width:195px;padding:0 20px}.saudi-tv-commodity-title{font-size:18px}.saudi-tv-commodity-price{font-size:30px}}'
    ].join('');

    var box = document.getElementById('saudi-tv-commodities');
    if (!box) {
      box = document.createElement('div');
      box.id = 'saudi-tv-commodities';
      box.innerHTML =
        '<div class="saudi-tv-commodity gold">' +
          '<div class="saudi-tv-commodity-title">الذهب</div>' +
          '<div id="saudi-tv-gold-price" class="saudi-tv-commodity-price">—</div>' +
        '</div>' +
        '<div class="saudi-tv-commodity brent">' +
          '<div class="saudi-tv-commodity-title">خام برنت</div>' +
          '<div id="saudi-tv-brent-price" class="saudi-tv-commodity-price">—</div>' +
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
    el.textContent = isFinite(n)
      ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(value);
  }

  window.saudiTvSetCommodities = function (gold, brent) {
    if (!ensureCommodityUi()) return;
    setPrice('saudi-tv-gold-price', gold);
    setPrice('saudi-tv-brent-price', brent);
  };

  ensureCommodityUi();
  setInterval(ensureCommodityUi, 2000);
})();
