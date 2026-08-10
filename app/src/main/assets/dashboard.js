(function () {
  'use strict';

  function clean(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function directCells(row) {
    var out = [];
    var children = row ? row.children : [];
    for (var i = 0; i < children.length; i++) {
      var tag = children[i].tagName;
      if (tag === 'TD' || tag === 'TH') out.push(children[i]);
    }
    return out;
  }

  function headerInfo(table) {
    var headerRows = Array.prototype.slice.call(table.querySelectorAll('thead tr'));
    if (!headerRows.length) {
      var allRows = Array.prototype.slice.call(table.querySelectorAll('tr'));
      for (var i = 0; i < Math.min(3, allRows.length); i++) {
        if (allRows[i].querySelector('th')) headerRows.push(allRows[i]);
      }
    }
    if (!headerRows.length) return null;

    var grid = [];
    for (var r = 0; r < headerRows.length; r++) {
      if (!grid[r]) grid[r] = [];
      var cells = directCells(headerRows[r]);
      var c = 0;
      for (var k = 0; k < cells.length; k++) {
        while (grid[r][c]) c++;
        var cell = cells[k];
        var rowSpan = parseInt(cell.getAttribute('rowspan') || '1', 10);
        var colSpan = parseInt(cell.getAttribute('colspan') || '1', 10);
        var text = clean(cell.innerText || cell.textContent);
        for (var rr = r; rr < r + rowSpan; rr++) {
          if (!grid[rr]) grid[rr] = [];
          for (var cc = c; cc < c + colSpan; cc++) {
            if (!grid[rr][cc]) grid[rr][cc] = text;
          }
        }
        c += colSpan;
      }
    }

    var count = 0;
    for (var g = 0; g < grid.length; g++) count = Math.max(count, grid[g].length);
    var paths = [];
    for (var col = 0; col < count; col++) {
      var bits = [];
      for (var row = 0; row < grid.length; row++) {
        var bit = clean(grid[row][col]);
        if (bit && bits.indexOf(bit) === -1) bits.push(bit);
      }
      paths.push(bits.join(' '));
    }

    function idx(test) {
      for (var x = 0; x < paths.length; x++) if (test(paths[x])) return x;
      return -1;
    }

    var company = idx(function (p) { return /الشركة/.test(p); });
    var price = idx(function (p) {
      return /آخر صفقة/.test(p) && /السعر/.test(p) && !/أفضل/.test(p);
    });
    if (price < 0) {
      price = idx(function (p) {
        return /السعر/.test(p) && !/أفضل طلب|أفضل عرض|52 أسبوع/.test(p);
      });
    }
    var change = idx(function (p) { return /تغيير القيمة|التغير|التغيير/.test(p) && !/نسبة/.test(p); });
    var volume = idx(function (p) { return /الكمية المتداولة|حجم التداول/.test(p); });

    if (company < 0 || price < 0 || change < 0 || volume < 0) return null;
    return { company: company, price: price, change: change, volume: volume, paths: paths };
  }

  function findMarketTable() {
    var tables = Array.prototype.slice.call(document.querySelectorAll('table'));
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i];
      if (table.closest && table.closest('#saudi-tv-dashboard')) continue;
      var info = headerInfo(table);
      if (!info) continue;
      var rows = table.querySelectorAll('tbody tr').length;
      var score = rows * 10;
      var text = clean(table.innerText || table.textContent);
      if (/جميع الأسهم|الكمية المتداولة|آخر صفقة/.test(text)) score += 100;
      if (score > bestScore) {
        bestScore = score;
        best = { table: table, info: info };
      }
    }
    return best;
  }

  function companyName(text) {
    var s = clean(text);
    s = s.replace(/\b20\d{2}\b/g, '');
    s = s.replace(/\b\d{4}\b/g, '');
    s = s.replace(/إضافة.*$/g, '');
    return clean(s);
  }

  function extractStocks() {
    var found = findMarketTable();
    if (!found) return { rows: [], sabic: null };
    var table = found.table;
    var map = found.info;
    var bodyRows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    var rows = [];
    var sabic = null;

    for (var i = 0; i < bodyRows.length; i++) {
      var cells = directCells(bodyRows[i]);
      var maxIndex = Math.max(map.company, map.price, map.change, map.volume);
      if (cells.length <= maxIndex) continue;

      var rawCompany = clean(cells[map.company].innerText || cells[map.company].textContent);
      var name = companyName(rawCompany);
      var price = clean(cells[map.price].innerText || cells[map.price].textContent);
      var change = clean(cells[map.change].innerText || cells[map.change].textContent);
      var volume = clean(cells[map.volume].innerText || cells[map.volume].textContent);

      if (!name || !price) continue;
      var item = { company: name, rawCompany: rawCompany, price: price, change: change, volume: volume };
      rows.push(item);
      if (!sabic && (/سابك/.test(rawCompany) || /\b2010\b/.test(rawCompany))) sabic = item;
    }
    return { rows: rows, sabic: sabic };
  }

  function extractTasi() {
    var candidates = document.querySelectorAll('body *');
    var best = null;
    var bestScore = -9999;

    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.closest && el.closest('#saudi-tv-dashboard')) continue;
      var text = clean(el.innerText || el.textContent);
      if (!/تاسي/.test(text) || text.length > 420) continue;
      var nums = text.match(/[+-]?\d[\d,]*(?:\.\d+)?/g);
      if (!nums || nums.length < 2) continue;
      var score = 0;
      if (text.length < 140) score += 25;
      if (text.length < 80) score += 10;
      if (/%/.test(text)) score += 20;
      if (/افتتاح|إغلاق سابق/.test(text)) score += 8;
      score -= text.length / 30;
      if (score > bestScore) {
        best = text;
        bestScore = score;
      }
    }

    if (!best) return null;
    var after = best.substring(best.indexOf('تاسي') + 4);
    var valueMatch = after.match(/\d[\d,]*(?:\.\d+)?/);
    var pair = after.match(/([+-]?\d[\d,]*(?:\.\d+)?)\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*%\s*\)/);
    var value = valueMatch ? valueMatch[0] : '—';
    var change = pair ? pair[1] : '—';
    var percent = pair ? pair[2] : '—';
    return { value: value, change: change, percent: percent };
  }

  function numericValue(text) {
    var n = parseFloat((text || '').replace(/,/g, '').replace(/[^0-9+\-.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function signed(text, suffix) {
    var s = clean(text);
    if (!s || s === '—') return '—';
    if (s.charAt(0) !== '-' && s.charAt(0) !== '+' && numericValue(s) > 0) s = '+' + s;
    return s + (suffix || '');
  }

  function valueClass(text) {
    var n = numericValue(text);
    if (n > 0) return 'up';
    if (n < 0) return 'down';
    return 'flat';
  }

  function findTicker() {
    var existing = document.getElementById('saudi-tv-market-ticker');
    if (existing) return existing;

    var els = document.querySelectorAll('body *');
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest && el.closest('#saudi-tv-dashboard')) continue;
      var r = el.getBoundingClientRect();
      if (r.width < window.innerWidth * 0.55 || r.height < 25 || r.height > 150) continue;
      if (r.bottom < window.innerHeight - 16 || r.top > window.innerHeight) continue;
      var cs = window.getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky' && cs.bottom === 'auto') continue;
      var text = clean(el.innerText || el.textContent);
      if (text.length < 8) continue;
      var score = 0;
      if (/%|٪/.test(text)) score += 6;
      var nums = text.match(/\d[\d,.]*/g);
      score += Math.min(nums ? nums.length : 0, 10);
      if (/تاسي|السوق|سابك|الراجحي|أرامكو|أنابيب|أماك/.test(text)) score += 5;
      if (r.width > window.innerWidth * 0.9) score += 4;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    if (best) best.id = 'saudi-tv-market-ticker';
    return bestScore >= 6 ? best : null;
  }

  function ensureStyle() {
    var style = document.getElementById('saudi-tv-dashboard-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'saudi-tv-dashboard-style';
      document.head.appendChild(style);
    }
    style.textContent = [
      '#saudi-tv-dashboard{position:fixed;inset:0;z-index:2147483000;background:#07131d;color:#f7fafc;direction:rtl;font-family:Arial,"Noto Sans Arabic",sans-serif;overflow:hidden;}',
      '#saudi-tv-ticker-slot{height:8vh;min-height:58px;background:#0a1f2f;border-bottom:1px solid #254257;overflow:hidden;display:flex;align-items:center;}',
      '#saudi-tv-ticker-slot #saudi-tv-market-ticker{position:relative!important;top:auto!important;bottom:auto!important;left:auto!important;right:auto!important;width:100%!important;max-width:none!important;margin:0!important;transform:none!important;z-index:1!important;}',
      '.saudi-tv-card{height:11vh;min-height:82px;box-sizing:border-box;display:flex;align-items:center;padding:0 3vw;border-bottom:1px solid #1c3445;gap:2.4vw;}',
      '#saudi-tv-tasi{background:linear-gradient(90deg,#0c2434,#0a1b28);}',
      '#saudi-tv-sabic{background:#0b1b28;}',
      '.saudi-tv-title{font-size:1.6vw;font-weight:700;min-width:15vw;color:#d6e3eb;}',
      '.saudi-tv-main-value{font-size:2.5vw;font-weight:800;direction:ltr;letter-spacing:.02em;}',
      '.saudi-tv-change{font-size:1.75vw;font-weight:800;direction:ltr;}',
      '.saudi-tv-volume{font-size:1.45vw;color:#b8c8d2;direction:ltr;margin-right:auto;}',
      '.up{color:#35d07f!important}.down{color:#ff616d!important}.flat{color:#d7dee3!important}',
      '#saudi-tv-table-wrap{height:70vh;overflow-y:auto;overflow-x:hidden;background:#08151f;scroll-behavior:smooth;}',
      '#saudi-tv-table{width:100%;border-collapse:collapse;table-layout:fixed;direction:rtl;}',
      '#saudi-tv-table thead th{position:sticky;top:0;z-index:4;background:#102738;color:#dbe7ee;font-size:1.45vw;font-weight:700;padding:1.05vh 1.2vw;border-bottom:2px solid #2b4a5f;}',
      '#saudi-tv-table tbody td{font-size:1.35vw;font-weight:600;padding:1.0vh 1.2vw;border-bottom:1px solid #183040;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:4.8vh;box-sizing:border-box;}',
      '#saudi-tv-table tbody tr:nth-child(even){background:#0b1b27;}',
      '#saudi-tv-table tbody tr:nth-child(odd){background:#08151f;}',
      '#saudi-tv-table tbody tr.sabic-row{background:#153426!important;}',
      '#saudi-tv-table th:nth-child(1),#saudi-tv-table td:nth-child(1){width:42%;text-align:right;}',
      '#saudi-tv-table th:nth-child(2),#saudi-tv-table td:nth-child(2){width:18%;text-align:center;direction:ltr;}',
      '#saudi-tv-table th:nth-child(3),#saudi-tv-table td:nth-child(3){width:18%;text-align:center;direction:ltr;}',
      '#saudi-tv-table th:nth-child(4),#saudi-tv-table td:nth-child(4){width:22%;text-align:center;direction:ltr;}',
      '#saudi-tv-loading{height:70vh;display:flex;align-items:center;justify-content:center;font-size:1.8vw;color:#afc3cf;background:#08151f;}',
      '#saudi-tv-table-wrap::-webkit-scrollbar{width:10px}#saudi-tv-table-wrap::-webkit-scrollbar-track{background:#07131d}#saudi-tv-table-wrap::-webkit-scrollbar-thumb{background:#315269;border-radius:8px}',
      '@media (max-width:1280px){.saudi-tv-title{font-size:22px}.saudi-tv-main-value{font-size:34px}.saudi-tv-change{font-size:25px}.saudi-tv-volume{font-size:20px}#saudi-tv-table thead th{font-size:20px}#saudi-tv-table tbody td{font-size:19px}}'
    ].join('');
  }

  function makeDashboard() {
    var dash = document.getElementById('saudi-tv-dashboard');
    if (dash) return dash;
    dash = document.createElement('div');
    dash.id = 'saudi-tv-dashboard';
    dash.innerHTML =
      '<div id="saudi-tv-ticker-slot"><div style="width:100%;text-align:center;color:#9fb5c2;font-size:1.3vw">جارٍ تحميل شريط الأسهم…</div></div>' +
      '<div id="saudi-tv-tasi" class="saudi-tv-card"><div class="saudi-tv-title">مؤشر تاسي</div><div id="saudi-tv-tasi-value" class="saudi-tv-main-value">—</div><div id="saudi-tv-tasi-change" class="saudi-tv-change flat">—</div><div id="saudi-tv-tasi-percent" class="saudi-tv-change flat">—</div></div>' +
      '<div id="saudi-tv-sabic" class="saudi-tv-card"><div class="saudi-tv-title">سابك <span style="color:#7fa0b5;font-size:.75em">2010</span></div><div id="saudi-tv-sabic-price" class="saudi-tv-main-value">—</div><div id="saudi-tv-sabic-change" class="saudi-tv-change flat">—</div><div id="saudi-tv-sabic-volume" class="saudi-tv-volume">حجم التداول: —</div></div>' +
      '<div id="saudi-tv-loading">جارٍ تحميل جميع الأسهم من تداول السعودية…</div>' +
      '<div id="saudi-tv-table-wrap" style="display:none"><table id="saudi-tv-table"><thead><tr><th>الشركة</th><th>السعر</th><th>التغير</th><th>حجم التداول</th></tr></thead><tbody></tbody></table></div>';
    document.body.appendChild(dash);
    document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('overflow', 'hidden', 'important');
    return dash;
  }

  function mountTicker() {
    var slot = document.getElementById('saudi-tv-ticker-slot');
    if (!slot) return;
    var ticker = findTicker();
    if (!ticker) return;
    slot.innerHTML = '';
    slot.appendChild(ticker);
    ticker.style.setProperty('position', 'relative', 'important');
    ticker.style.setProperty('top', 'auto', 'important');
    ticker.style.setProperty('bottom', 'auto', 'important');
    ticker.style.setProperty('left', 'auto', 'important');
    ticker.style.setProperty('right', 'auto', 'important');
    ticker.style.setProperty('width', '100%', 'important');
    ticker.style.setProperty('max-width', 'none', 'important');
    ticker.style.setProperty('margin', '0', 'important');
    ticker.style.setProperty('transform', 'none', 'important');
  }

  function updateTasi() {
    var tasi = extractTasi();
    if (!tasi) return;
    var v = document.getElementById('saudi-tv-tasi-value');
    var c = document.getElementById('saudi-tv-tasi-change');
    var p = document.getElementById('saudi-tv-tasi-percent');
    if (v) v.textContent = tasi.value;
    if (c) {
      c.textContent = signed(tasi.change, '');
      c.className = 'saudi-tv-change ' + valueClass(tasi.change);
    }
    if (p) {
      p.textContent = signed(tasi.percent, '%');
      p.className = 'saudi-tv-change ' + valueClass(tasi.percent);
    }
  }

  function updateSabic(sabic) {
    if (!sabic) return;
    var p = document.getElementById('saudi-tv-sabic-price');
    var c = document.getElementById('saudi-tv-sabic-change');
    var v = document.getElementById('saudi-tv-sabic-volume');
    if (p) p.textContent = sabic.price || '—';
    if (c) {
      c.textContent = signed(sabic.change || '—', '');
      c.className = 'saudi-tv-change ' + valueClass(sabic.change);
    }
    if (v) v.textContent = 'حجم التداول: ' + (sabic.volume || '—');
  }

  function updateTable(rows) {
    if (!rows || !rows.length) return false;
    var tbody = document.querySelector('#saudi-tv-table tbody');
    if (!tbody) return false;
    tbody.innerHTML = '';
    for (var i = 0; i < rows.length; i++) {
      var item = rows[i];
      var tr = document.createElement('tr');
      if (/سابك/.test(item.rawCompany || item.company) || /\b2010\b/.test(item.rawCompany || '')) tr.className = 'sabic-row';
      var td1 = document.createElement('td'); td1.textContent = item.company;
      var td2 = document.createElement('td'); td2.textContent = item.price;
      var td3 = document.createElement('td'); td3.textContent = signed(item.change, ''); td3.className = valueClass(item.change);
      var td4 = document.createElement('td'); td4.textContent = item.volume;
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
      tbody.appendChild(tr);
    }
    var loading = document.getElementById('saudi-tv-loading');
    var wrap = document.getElementById('saudi-tv-table-wrap');
    if (loading) loading.style.display = 'none';
    if (wrap) wrap.style.display = 'block';
    return true;
  }

  function build() {
    try {
      ensureStyle();
      makeDashboard();
      mountTicker();
      updateTasi();
      var data = extractStocks();
      updateSabic(data.sabic);
      var ok = updateTable(data.rows);
      return ok ? 'dashboard-ready:' + data.rows.length : 'dashboard-waiting';
    } catch (e) {
      return 'dashboard-error:' + e.message;
    }
  }

  window.saudiTvScroll = function (amount) {
    var wrap = document.getElementById('saudi-tv-table-wrap');
    if (wrap) wrap.scrollBy({ top: amount, behavior: 'smooth' });
  };

  window.saudiTvDashboardBuild = build;
  build();
})();
