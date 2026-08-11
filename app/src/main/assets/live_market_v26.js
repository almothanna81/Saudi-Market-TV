(function () {
  'use strict';

  function clean(value) {
    return (value == null ? '' : String(value)).replace(/\s+/g, ' ').trim();
  }

  function numericValue(text) {
    var n = parseFloat(clean(text).replace(/,/g, '').replace(/[^0-9+\-.]/g, ''));
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

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function updateTasi(tasi) {
    if (!tasi) return;
    var value = document.getElementById('saudi-tv-tasi-value');
    var change = document.getElementById('saudi-tv-tasi-change');
    var percent = document.getElementById('saudi-tv-tasi-percent');
    if (!value || !change || !percent) return;
    value.textContent = clean(tasi.value) || '—';
    change.textContent = signed(tasi.change, '');
    percent.textContent = signed(tasi.percent, '%');
    var cls = valueClass(tasi.change);
    change.className = 'saudi-tv-change ' + cls;
    percent.className = 'saudi-tv-change ' + cls;
  }

  function updateSabic(sabic) {
    if (!sabic) return;
    var price = document.getElementById('saudi-tv-sabic-price');
    var change = document.getElementById('saudi-tv-sabic-change');
    var volume = document.getElementById('saudi-tv-sabic-volume');
    if (!price || !change || !volume) return;
    price.textContent = clean(sabic.price) || '—';
    change.textContent = signed(sabic.change, '');
    change.className = 'saudi-tv-change ' + valueClass(sabic.change);
    volume.textContent = 'حجم التداول: ' + (clean(sabic.volume) || '—');
  }

  function tickerItemHtml(row) {
    var cls = valueClass(row.change);
    var arrow = cls === 'up' ? '▲' : (cls === 'down' ? '▼' : '•');
    return '<div class="saudi-tv-ticker-item">' +
      '<span class="saudi-tv-ticker-name">' + escapeHtml(row.company) + '</span>' +
      '<span class="saudi-tv-ticker-price">' + escapeHtml(row.price) + '</span>' +
      '<span class="saudi-tv-ticker-change ' + cls + '">' + arrow + ' ' + escapeHtml(signed(row.change, '')) + '</span>' +
      '</div>';
  }

  function updateTickerGroup(group, rows) {
    if (!group) return;
    var sameShape = group.children.length === rows.length;
    if (sameShape) {
      for (var i = 0; i < rows.length; i++) {
        var item = group.children[i];
        var name = item && item.querySelector('.saudi-tv-ticker-name');
        if (!name || clean(name.textContent) !== clean(rows[i].company)) {
          sameShape = false;
          break;
        }
      }
    }

    if (!sameShape) {
      var html = '';
      for (var j = 0; j < rows.length; j++) html += tickerItemHtml(rows[j]);
      group.innerHTML = html;
      return;
    }

    for (var k = 0; k < rows.length; k++) {
      var row = rows[k];
      var node = group.children[k];
      var price = node.querySelector('.saudi-tv-ticker-price');
      var change = node.querySelector('.saudi-tv-ticker-change');
      if (price) price.textContent = clean(row.price);
      if (change) {
        var cls = valueClass(row.change);
        var arrow = cls === 'up' ? '▲' : (cls === 'down' ? '▼' : '•');
        change.textContent = arrow + ' ' + signed(row.change, '');
        change.className = 'saudi-tv-ticker-change ' + cls;
      }
    }
  }

  function updateTicker(rows) {
    if (!rows || !rows.length) return;
    var picks = rows.slice(0, Math.min(rows.length, 30));
    updateTickerGroup(document.getElementById('saudi-tv-ticker-a'), picks);
    updateTickerGroup(document.getElementById('saudi-tv-ticker-b'), picks);
  }

  function tableMatchesRows(table, rows) {
    if (!table) return false;
    var bodyRows = table.querySelectorAll('tbody tr');
    if (bodyRows.length !== rows.length) return false;
    for (var i = 0; i < rows.length; i++) {
      var first = bodyRows[i].children[0];
      if (!first || clean(first.textContent) !== clean(rows[i].company)) return false;
    }
    return true;
  }

  function rebuildTable(wrap, rows, scrollTop) {
    var html = '<table id="saudi-tv-table"><thead><tr><th>الشركة</th><th>السعر</th><th>التغير</th><th>حجم التداول</th></tr></thead><tbody>';
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var isSabic = /سابك/.test(row.rawCompany || row.company) || /\b2010\b/.test(row.rawCompany || '');
      var cls = valueClass(row.change);
      html += '<tr' + (isSabic ? ' class="sabic-row"' : '') + '>' +
        '<td>' + escapeHtml(row.company) + '</td>' +
        '<td>' + escapeHtml(row.price) + '</td>' +
        '<td class="' + cls + '">' + escapeHtml(signed(row.change, '')) + '</td>' +
        '<td>' + escapeHtml(row.volume) + '</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
    wrap.scrollTop = scrollTop;
  }

  function updateTable(rows) {
    if (!rows || !rows.length) return;
    var wrap = document.getElementById('saudi-tv-table-wrap');
    var table = document.getElementById('saudi-tv-table');
    if (!wrap) return;
    var scrollTop = wrap.scrollTop;

    if (!tableMatchesRows(table, rows)) {
      rebuildTable(wrap, rows, scrollTop);
      return;
    }

    var bodyRows = table.querySelectorAll('tbody tr');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var tr = bodyRows[i];
      if (!tr || tr.children.length < 4) continue;
      tr.children[1].textContent = clean(row.price);
      tr.children[2].textContent = signed(row.change, '');
      tr.children[2].className = valueClass(row.change);
      tr.children[3].textContent = clean(row.volume);
      var isSabic = /سابك/.test(row.rawCompany || row.company) || /\b2010\b/.test(row.rawCompany || '');
      tr.className = isSabic ? 'sabic-row' : '';
    }
    wrap.scrollTop = scrollTop;
  }

  window.saudiTvApplyMarketData = function (payload) {
    try {
      if (!payload) return;
      if (typeof payload === 'string') payload = JSON.parse(payload);
      if (payload.tasi) updateTasi(payload.tasi);
      if (payload.sabic) updateSabic(payload.sabic);
      if (payload.rows && payload.rows.length) {
        updateTicker(payload.rows);
        updateTable(payload.rows);
      }
      window.__saudiTvLastMarketUpdate = Date.now();
    } catch (e) {
    }
  };
})();
