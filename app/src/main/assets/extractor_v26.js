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

  window.saudiTvExportMarketData = function () {
    try {
      var stocks = extractStocks();
      var tasi = extractTasi();
      if (!stocks.rows || !stocks.rows.length || !tasi) return '';
      return JSON.stringify({ rows: stocks.rows, sabic: stocks.sabic, tasi: tasi, capturedAt: Date.now() });
    } catch (e) {
      return '';
    }
  };
})();
