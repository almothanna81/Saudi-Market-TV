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
    var change = idx(function (p) {
      return /تغيير القيمة|التغير|التغيير/.test(p) && !/نسبة/.test(p);
    });
    var volume = idx(function (p) { return /الكمية المتداولة|حجم التداول/.test(p); });

    if (company < 0 || price < 0 || change < 0 || volume < 0) return null;
    return { company: company, price: price, change: change, volume: volume };
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

  function parseNumber(text) {
    var n = parseFloat((text || '').replace(/,/g, '').replace(/[^0-9+\-.]/g, ''));
    return isNaN(n) ? null : n;
  }

  function leafTextTokens(el) {
    var result = [];
    if (!el) return result;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var t = clean(node.nodeValue);
      if (t) result.push(t);
    }
    return result;
  }

  function extractTasi() {
    var candidates = document.querySelectorAll('body *');
    var best = null;
    var bestScore = -9999;

    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.closest && el.closest('#saudi-tv-dashboard')) continue;
      var text = clean(el.innerText || el.textContent);
      if (!/تاسي/.test(text) || text.length > 500) continue;
      var score = 0;
      if (/%/.test(text)) score += 30;
      if (text.length < 160) score += 20;
      if (text.length < 100) score += 10;
      if (/مؤشر/.test(text)) score += 8;
      score -= text.length / 40;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    if (!best) return null;

    var tokens = leafTextTokens(best);
    var allText = clean(tokens.join(' '));
    var numericTokens = [];
    for (var t = 0; t < tokens.length; t++) {
      var matches = tokens[t].match(/[+-]?\d[\d,]*(?:\.\d+)?\s*%?/g);
      if (!matches) continue;
      for (var m = 0; m < matches.length; m++) {
        var raw = clean(matches[m]);
        var num = parseNumber(raw);
        if (num !== null) numericTokens.push({ raw: raw, num: num, percent: /%/.test(raw) });
      }
    }

    if (!numericTokens.length) {
      var fallback = allText.match(/[+-]?\d[\d,]*(?:\.\d+)?\s*%?/g) || [];
      for (var f = 0; f < fallback.length; f++) {
        var fr = clean(fallback[f]);
        var fn = parseNumber(fr);
        if (fn !== null) numericTokens.push({ raw: fr, num: fn, percent: /%/.test(fr) });
      }
    }

    var value = null;
    var change = null;
    var percent = null;

    for (var a = 0; a < numericTokens.length; a++) {
      var item = numericTokens[a];
      if (item.percent && Math.abs(item.num) <= 20) {
        percent = item.num;
        break;
      }
    }

    for (var b = 0; b < numericTokens.length; b++) {
      var n = numericTokens[b].num;
      if (!numericTokens[b].percent && n >= 7000 && n <= 20000) {
        value = n;
        break;
      }
    }

    if (percent !== null) {
      var targetSign = percent < 0 ? -1 : (percent > 0 ? 1 : 0);
      var expectedAbs = value !== null ? Math.abs(value * percent / 100) : null;
      var bestDiff = Infinity;
      for (var c = 0; c < numericTokens.length; c++) {
        var cand = numericTokens[c];
        if (cand.percent) continue;
        if (value !== null && Math.abs(cand.num - value) < 0.001) continue;
        if (Math.abs(cand.num) > 1000) continue;
        var candSign = cand.num < 0 ? -1 : (cand.num > 0 ? 1 : 0);
        if (targetSign !== 0 && candSign !== 0 && candSign !== targetSign) continue;
        var diff = expectedAbs !== null ? Math.abs(Math.abs(cand.num) - expectedAbs) : Math.abs(cand.num);
        if (diff < bestDiff) {
          bestDiff = diff;
          change = cand.num;
        }
      }
    }

    if (value === null) {
      var valueMatch = allText.match(/(?:تاسي[^0-9]{0,50})(\d{1,2},\d{3}(?:\.\d+)?)/);
      if (valueMatch) value = parseNumber(valueMatch[1]);
    }

    if (percent === null) {
      var percentMatch = allText.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
      if (percentMatch) percent = parseNumber(percentMatch[1]);
    }

    if (change === null && value !== null && percent !== null) {
      change = value * percent / 100;
    }

    if (value === null) return null;
    return {
      value: value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: change === null ? '—' : change.toFixed(2),
      percent: percent === null ? '—' : percent.toFixed(2)
    };
  }

  function numericValue(text) {
    var n = parseFloat((text || '').replace(/,/g, '').replace(/[^0-9+\-.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function signed(text, suffix) {
    var s = clean(String(text == null ? '' : text));
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

  function ensureStyle() {
    var style = document.getElementById('saudi-tv-dashboard-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'saudi-tv-dashboard-style';
      document.head.appendChild(style);
    }
    style.textContent = [
      'html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:#07131d!important;}',
      '#saudi-tv-dashboard{position:fixed;inset:0;z-index:2147483000;background:#07131d;color:#f7fafc;direction:rtl;font-family:Arial,"Noto Sans Arabic",sans-serif;overflow:hidden;}',
      '#saudi-tv-ticker-slot{height:8vh;min-height:58px;box-sizing:border-box;background:#f7f8fa;border:0;border-bottom:2px solid #0d7abf;overflow:hidden;display:flex;align-items:center;position:relative;border-radius:0!important;clip-path:none!important;}',
      '#saudi-tv-ticker-viewport{width:100%;height:100%;overflow:hidden;display:flex;align-items:center;direction:ltr;}',
      '#saudi-tv-ticker-track{display:flex;align-items:center;flex-wrap:nowrap;width:max-content;min-width:max-content;animation:saudiTickerMove 48s linear infinite;will-change:transform;}',
      '.saudi-tv-ticker-group{display:flex;align-items:center;flex-wrap:nowrap;direction:rtl;}',
      '.saudi-tv-ticker-item{height:8vh;min-height:58px;box-sizing:border-box;display:flex;align-items:center;gap:.65vw;padding:0 1.35vw;border-left:1px solid #d8e0e5;white-space:nowrap;color:#263746;font-size:1.15vw;font-weight:700;background:#f7f8fa;}',
      '.saudi-tv-ticker-name{font-weight:800;color:#233746;}',
      '.saudi-tv-ticker-price{direction:ltr;color:#233746;font-weight:800;}',
      '.saudi-tv-ticker-change{direction:ltr;font-weight:800;}',
      '@keyframes saudiTickerMove{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
      '.saudi-tv-card{height:11vh;min-height:82px;box-sizing:border-box;display:flex;align-items:center;padding:0 3vw;border-bottom:1px solid #1c3445;gap:2.4vw;}',
      '#saudi-tv-tasi{background:linear-gradient(90deg,#0b80c9,#056aa9);}',
      '#saudi-tv-sabic{background:linear-gradient(90deg,#0c75b9,#075d94);}',
      '.saudi-tv-title{font-size:1.6vw;font-weight:800;min-width:15vw;color:#f5fbff;}',
      '.saudi-tv-main-value{font-size:2.5vw;font-weight:900;direction:ltr;letter-spacing:.02em;color:#fff;}',
      '.saudi-tv-change{font-size:1.75vw;font-weight:900;direction:ltr;}',
      '.saudi-tv-volume{font-size:1.45vw;color:#eef7fc;direction:ltr;margin-right:auto;}',
      '.up{color:#67ffae!important}.down{color:#ff8aa0!important}.flat{color:#e6edf2!important}',
      '#saudi-tv-table-wrap{height:70vh;overflow-y:auto;overflow-x:hidden;background:#08151f;scroll-behavior:smooth;}',
      '#saudi-tv-table{width:100%;border-collapse:collapse;table-layout:fixed;direction:rtl;}',
      '#saudi-tv-table thead th{position:sticky;top:0;z-index:4;background:#0f8bd3;color:#ffffff;font-size:1.45vw;font-weight:800;padding:1.05vh 1.2vw;border-bottom:2px solid #66c8ff;}',
      '#saudi-tv-table tbody td{font-size:1.35vw;font-weight:700;padding:1.0vh 1.2vw;border-bottom:1px solid #1d5475;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:4.8vh;box-sizing:border-box;}',
      '#saudi-tv-table tbody tr:nth-child(even){background:#0b3450;}',
      '#saudi-tv-table tbody tr:nth-child(odd){background:#092a41;}',
      '#saudi-tv-table tbody tr.sabic-row{background:#14563c!important;}',
      '#saudi-tv-table th:nth-child(1),#saudi-tv-table td:nth-child(1){width:42%;text-align:right;}',
      '#saudi-tv-table th:nth-child(2),#saudi-tv-table td:nth-child(2){width:18%;text-align:center;direction:ltr;}',
      '#saudi-tv-table th:nth-child(3),#saudi-tv-table td:nth-child(3){width:18%;text-align:center;direction:ltr;}',
      '#saudi-tv-table th:nth-child(4),#saudi-tv-table td:nth-child(4){width:22%;text-align:center;direction:ltr;}',
      '#saudi-tv-loading{height:70vh;display:flex;align-items:center;justify-content:center;font-size:1.8vw;color:#afc3cf;background:#08151f;}',
      '#saudi-tv-table-wrap::-webkit-scrollbar{width:10px}#saudi-tv-table-wrap::-webkit-scrollbar-track{background:#07131d}#saudi-tv-table-wrap::-webkit-scrollbar-thumb{background:#3e7899;border-radius:8px}',
      '@media (max-width:1280px){.saudi-tv-ticker-item{font-size:16px}.saudi-tv-title{font-size:22px}.saudi-tv-main-value{font-size:34px}.saudi-tv-change{font-size:25px}.saudi-tv-volume{font-size:20px}#saudi-tv-table thead th{font-size:20px}#saudi-tv-table tbody td{font-size:19px}}'
    ].join('');
  }

  function makeDashboard() {
    var dash = document.getElementById('saudi-tv-dashboard');
    if (dash) return dash;
    dash = document.createElement('div');
    dash.id = 'saudi-tv-dashboard';
    dash.innerHTML =
      '<div id="saudi-tv-ticker-slot"><div id="saudi-tv-ticker-viewport"><div id="saudi-tv-ticker-track"><div class="saudi-tv-ticker-group" id="saudi-tv-ticker-a"></div><div class="saudi-tv-ticker-group" id="saudi-tv-ticker-b"></div></div></div></div>' +
      '<div id="saudi-tv-tasi" class="saudi-tv-card"><div class="saudi-tv-title">مؤشر تاسي</div><div id="saudi-tv-tasi-value" class="saudi-tv-main-value">—</div><div id="saudi-tv-tasi-change" class="saudi-tv-change flat">—</div><div id="saudi-tv-tasi-percent" class="saudi-tv-change flat">—</div></div>' +
      '<div id="saudi-tv-sabic" class="saudi-tv-card"><div class="saudi-tv-title">سابك <span style="font-size:.72em;opacity:.9">2010</span></div><div id="saudi-tv-sabic-price" class="saudi-tv-main-value">—</div><div id="saudi-tv-sabic-change" class="saudi-tv-change flat">—</div><div id="saudi-tv-sabic-volume" class="saudi-tv-volume">حجم التداول: —</div></div>' +
      '<div id="saudi-tv-table-wrap"><div id="saudi-tv-loading">جارٍ تحميل أسعار الأسهم…</div></div>';
    document.documentElement.appendChild(dash);
    return dash;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderTicker(rows) {
    var a = document.getElementById('saudi-tv-ticker-a');
    var b = document.getElementById('saudi-tv-ticker-b');
    var track = document.getElementById('saudi-tv-ticker-track');
    if (!a || !b || !track || !rows || !rows.length) return;
    var picks = rows.slice(0, Math.min(rows.length, 30));
    var html = '';
    for (var i = 0; i < picks.length; i++) {
      var row = picks[i];
      var cls = valueClass(row.change);
      var arrow = cls === 'up' ? '▲' : (cls === 'down' ? '▼' : '•');
      html += '<div class="saudi-tv-ticker-item"><span class="saudi-tv-ticker-name">' + escapeHtml(row.company) + '</span><span class="saudi-tv-ticker-price">' + escapeHtml(row.price) + '</span><span class="saudi-tv-ticker-change ' + cls + '">' + arrow + ' ' + escapeHtml(signed(row.change, '')) + '</span></div>';
    }
    if (a.innerHTML !== html) {
      a.innerHTML = html;
      b.innerHTML = html;
      track.style.animation = 'none';
      void track.offsetWidth;
      track.style.animation = '';
    }
  }

  function renderTasi(tasi) {
    if (!tasi) return;
    var value = document.getElementById('saudi-tv-tasi-value');
    var change = document.getElementById('saudi-tv-tasi-change');
    var percent = document.getElementById('saudi-tv-tasi-percent');
    if (!value || !change || !percent) return;
    value.textContent = tasi.value;
    change.textContent = signed(tasi.change, '');
    percent.textContent = signed(tasi.percent, '%');
    var cls = valueClass(tasi.change);
    change.className = 'saudi-tv-change ' + cls;
    percent.className = 'saudi-tv-change ' + cls;
  }

  function renderSabic(sabic) {
    if (!sabic) return;
    var price = document.getElementById('saudi-tv-sabic-price');
    var change = document.getElementById('saudi-tv-sabic-change');
    var volume = document.getElementById('saudi-tv-sabic-volume');
    if (!price || !change || !volume) return;
    price.textContent = sabic.price || '—';
    change.textContent = signed(sabic.change, '');
    change.className = 'saudi-tv-change ' + valueClass(sabic.change);
    volume.textContent = 'حجم التداول: ' + (sabic.volume || '—');
  }

  function renderTable(rows) {
    var wrap = document.getElementById('saudi-tv-table-wrap');
    if (!wrap || !rows || !rows.length) return;
    var currentScroll = wrap.scrollTop;
    var html = '<table id="saudi-tv-table"><thead><tr><th>الشركة</th><th>السعر</th><th>التغير</th><th>حجم التداول</th></tr></thead><tbody>';
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var isSabic = /سابك/.test(row.rawCompany || row.company) || /\b2010\b/.test(row.rawCompany || '');
      var cls = valueClass(row.change);
      html += '<tr' + (isSabic ? ' class="sabic-row"' : '') + '><td>' + escapeHtml(row.company) + '</td><td>' + escapeHtml(row.price) + '</td><td class="' + cls + '">' + escapeHtml(signed(row.change, '')) + '</td><td>' + escapeHtml(row.volume) + '</td></tr>';
    }
    html += '</tbody></table>';
    var oldTable = document.getElementById('saudi-tv-table');
    var oldSignature = oldTable ? oldTable.getAttribute('data-signature') : '';
    var newSignature = rows.length + '|' + (rows[0] ? rows[0].company + rows[0].price : '') + '|' + (rows[rows.length - 1] ? rows[rows.length - 1].company + rows[rows.length - 1].price : '');
    if (oldTable && oldSignature === newSignature) return;
    wrap.innerHTML = html;
    var newTable = document.getElementById('saudi-tv-table');
    if (newTable) newTable.setAttribute('data-signature', newSignature);
    wrap.scrollTop = currentScroll;
  }

  function installScrollBridge() {
    window.saudiTvScroll = function (amount) {
      var wrap = document.getElementById('saudi-tv-table-wrap');
      if (wrap) wrap.scrollBy({ top: amount, left: 0, behavior: 'smooth' });
    };
  }

  function updateDashboard() {
    ensureStyle();
    makeDashboard();
    installScrollBridge();
    var stocks = extractStocks();
    var tasi = extractTasi();
    if (stocks.rows.length) {
      renderTicker(stocks.rows);
      renderTable(stocks.rows);
      if (stocks.sabic) renderSabic(stocks.sabic);
    }
    if (tasi) renderTasi(tasi);
  }

  updateDashboard();
  if (!window.__saudiTvDashboardObserver) {
    window.__saudiTvDashboardObserver = new MutationObserver(function () {
      clearTimeout(window.__saudiTvDashboardTimer);
      window.__saudiTvDashboardTimer = setTimeout(updateDashboard, 300);
    });
    window.__saudiTvDashboardObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
