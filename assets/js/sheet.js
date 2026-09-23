/*
 * sheet.js: lets the bar edit the website from a Google Sheet.
 *
 * WHAT IT DOES
 *   Reads three tabs from a published Google Sheet (Menu, Specials, Words)
 *   and swaps them into the page. If a tab can't be read (not set up yet,
 *   Google is slow, someone renamed a heading), that part of the page keeps
 *   the text already written in the HTML. The site never goes blank.
 *
 * SETUP
 *   See SHEET-SETUP.md. Paste each tab's published CSV link below.
 *   Leave a link empty and that part of the page stays as written in the HTML.
 *   These links are safe to be public: they're read-only copies of those tabs,
 *   not access to the spreadsheet itself.
 *
 * HOOKS IN THE HTML
 *   data-sheet="menu"             the .board on index.html; its .group blocks get replaced
 *   data-sheet="specials-food"    the Food specials <ul>
 *   data-sheet="specials-drinks"  the Drinks specials <ul>
 *   data-sheet="notice"           empty banner; shows when "Notice banner" has text
 *   data-text="Spot name"         any element whose words come from the Words tab
 *   data-sheet-use="menu specials words"
 *                                 load those tabs for other scripts, even with nothing
 *                                 above on the page (order.html uses this for order.js)
 *
 * TESTING
 *   Add ?sheet=off to the address to see the page without the sheet.
 *   Open the browser console to see what loaded: lines start with [sheet].
 *
 * FOR OTHER SCRIPTS
 *   window.MCTAP_SHEET.ready   a Promise that resolves once loading finishes
 *   window.MCTAP_SHEET.data    what loaded, or null for a part that didn't:
 *     .menu      { groups: [...as shown on the board],
 *                  items:  [{ section, name, details, price (number or null), shown }] }
 *                items includes hidden rows, so a hidden item can be pulled from ordering
 *     .specials  [{ type, day, special, show }]  only rows shown on the site
 *     .words     { spotname: text }  spot names lowercased with spaces and punctuation removed
 *   document event 'mctap:sheet' fires each time a part is applied
 */
(function () {
  'use strict';

  // ---- Paste the published CSV links here ---------------------------------
  var SHEET_LINKS = {
    menu:     'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_ZenMIOs7QmKL9DyUu9VVZ_kQ4D-FAUXv0dk5RXn5Psadg8Zc7KYrBWyGid5PITF8abssOek0UYWJ/pub?gid=581120479&single=true&output=csv',   // the Menu tab
    specials: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_ZenMIOs7QmKL9DyUu9VVZ_kQ4D-FAUXv0dk5RXn5Psadg8Zc7KYrBWyGid5PITF8abssOek0UYWJ/pub?gid=704290154&single=true&output=csv',   // the Specials tab
    words:    'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_ZenMIOs7QmKL9DyUu9VVZ_kQ4D-FAUXv0dk5RXn5Psadg8Zc7KYrBWyGid5PITF8abssOek0UYWJ/pub?gid=1241910556&single=true&output=csv'    // the Words tab
  };
  // -------------------------------------------------------------------------

  var TIMEOUT_MS = 8000;              // give up on Google after this long
  var CACHE_KEY  = 'mctap-sheet-v1';  // last good copy, so repeat visits don't flicker

  // Column headings the sheet may use. Matching ignores case, spaces and punctuation.
  var SPEC = {
    menu: {
      section: { names: ['section', 'category'], required: true },
      item:    { names: ['item', 'name'], required: true },
      details: { names: ['details', 'description'] },
      price:   { names: ['price'], required: true },
      show:    { names: ['show', 'showonsite', 'visible'] }
    },
    specials: {
      type:    { names: ['type', 'foodordrink'], required: true },
      day:     { names: ['day'], required: true },
      special: { names: ['special', 'deal'], required: true },
      show:    { names: ['show', 'showonsite', 'visible'] }
    },
    words: {
      spot: { names: ['spot', 'key'], required: true },
      text: { names: ['text', 'wording'], required: true }
    }
  };

  var HIDE_WORDS = ['no', 'n', 'false', 'hide', 'hidden', 'off', '0'];

  var state = { menu: null, specials: null, words: null };
  var resolveReady;
  window.MCTAP_SHEET = {
    data: state,
    ready: new Promise(function (r) { resolveReady = r; })
  };

  if (new URLSearchParams(location.search).get('sheet') === 'off') {
    console.info('[sheet] off (?sheet=off): showing the page as written in the HTML');
    resolveReady(state);
    return;
  }

  // Only fetch what this page uses. A page with no board or lists can still
  // ask for a tab with data-sheet-use="menu specials words" (order.html does).
  function uses(part) {
    return !!document.querySelector('[data-sheet-use~="' + part + '"]');
  }
  var need = {
    menu:     uses('menu') || !!document.querySelector('[data-sheet="menu"]'),
    specials: uses('specials') || !!document.querySelector('[data-sheet^="specials-"]'),
    words:    uses('words') || !!document.querySelector('[data-text], [data-sheet="notice"]')
  };

  // ---- Reading the sheet ---------------------------------------------------

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function shown(v) {
    return HIDE_WORDS.indexOf(norm(v)) < 0;   // blank means show
  }

  function parseCSV(text) {
    var rows = [], row = [], field = '', inQuotes = false, i = 0, c;
    text = String(text).replace(/^\uFEFF/, '');
    while (i < text.length) {
      c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // Finds the heading row (in the first 5 rows), then returns one object per data row.
  // Returns null if the headings it needs aren't there.
  function table(csv, spec) {
    var rows = parseCSV(csv);
    for (var h = 0; h < Math.min(5, rows.length); h++) {
      var heads = rows[h].map(norm), cols = {}, ok = true;
      for (var key in spec) {
        var idx = -1;
        for (var a = 0; a < spec[key].names.length && idx < 0; a++) {
          idx = heads.indexOf(spec[key].names[a]);
        }
        if (idx < 0 && spec[key].required) { ok = false; break; }
        cols[key] = idx;
      }
      if (!ok) continue;
      return rows.slice(h + 1).map(function (r) {
        var o = {};
        for (var k in cols) o[k] = cols[k] < 0 ? '' : String(r[cols[k]] == null ? '' : r[cols[k]]).trim();
        return o;
      }).filter(function (o) {
        for (var k in o) if (o[k]) return true;
        return false;
      });
    }
    return null;
  }

  function toNumber(v) {
    var n = String(v || '').replace(/[\s$,]/g, '');
    return /^\d+(\.\d+)?$/.test(n) ? Number(n) : null;
  }

  function formatPrice(v) {
    var n = String(v || '').replace(/[\s$,]/g, '');
    if (/^\d+(\.\d+)?$/.test(n)) return '$' + Number(n).toFixed(2);
    return String(v || '').trim();   // "Market price", "Ask", etc. go through as typed
  }

  // ---- Turning rows into page content --------------------------------------

  var BUILD = {
    menu: function (rows) {
      var groups = [], bySection = {}, items = [], last = '';
      rows.forEach(function (r) {
        var section = r.section || last;   // a blank Section means "same as the row above"
        if (!section) return;
        last = section;
        var isNote = !r.item || /^(section)?note$/.test(norm(r.item));
        var visible = shown(r.show);
        if (!isNote) {
          // every item, hidden ones included, so the order page knows what's 86'd
          items.push({ section: section, name: r.item, details: r.details,
                       price: toNumber(r.price), shown: visible });
        }
        if (!visible) return;
        var key = norm(section);
        var g = bySection[key];
        if (!g) { g = bySection[key] = { title: section, note: '', items: [] }; groups.push(g); }
        if (isNote) {
          if (r.details) g.note = r.details;
          return;
        }
        g.items.push({ name: r.item, details: r.details, price: formatPrice(r.price) });
      });
      groups = groups.filter(function (g) { return g.items.length; });
      return groups.length ? { groups: groups, items: items } : null;
    },

    specials: function (rows) {
      var out = rows.filter(function (r) {
        var t = norm(r.type);
        return r.special && shown(r.show) && (t.indexOf('food') === 0 || t.indexOf('drink') === 0);
      });
      return out.length ? out : null;
    },

    words: function (rows) {
      var map = {};
      rows.forEach(function (r) { if (r.spot) map[norm(r.spot)] = r.text; });
      return Object.keys(map).length ? map : null;
    }
  };

  function make(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;   // always text, never HTML
    return e;
  }

  var RENDER = {
    menu: function (model) {
      var groups = model.groups;
      var board = document.querySelector('[data-sheet="menu"]');
      if (!board) return;
      var kids = Array.prototype.slice.call(board.children), anchor = null;
      kids.forEach(function (k) {
        if (k.classList.contains('group')) board.removeChild(k);
        else if (!anchor) anchor = k;   // new groups go in front of the board's footer
      });
      groups.forEach(function (g) {
        var div = make('div', 'group');
        div.appendChild(make('h3', null, g.title));
        if (g.note) div.appendChild(make('p', null, g.note));
        var ul = make('ul', 'items priced');
        g.items.forEach(function (it) {
          var li = make('li');
          li.appendChild(make('strong', null, it.name));
          if (it.details) li.appendChild(make('span', null, it.details));
          if (it.price) li.appendChild(make('b', null, it.price));
          ul.appendChild(li);
        });
        div.appendChild(ul);
        board.insertBefore(div, anchor);
      });
    },

    specials: function (rows) {
      var lists = { food: [], drinks: [] };
      rows.forEach(function (r) {
        lists[norm(r.type).indexOf('food') === 0 ? 'food' : 'drinks'].push(r);
      });
      ['food', 'drinks'].forEach(function (kind) {
        var ul = document.querySelector('[data-sheet="specials-' + kind + '"]');
        if (!ul) return;
        ul.textContent = '';
        lists[kind].forEach(function (r) {
          var li = make('li');
          if (r.day) li.appendChild(document.createTextNode(r.day + ' '));
          li.appendChild(make('em', null, r.special));
          ul.appendChild(li);
        });
        if (ul.parentElement) ul.parentElement.hidden = !lists[kind].length;
      });
    },

    words: function (map) {
      document.querySelectorAll('[data-text]').forEach(function (node) {
        var t = map[norm(node.getAttribute('data-text'))];
        if (t) node.textContent = t;   // blank in the sheet keeps the HTML's wording
      });
      showNotice(map.noticebanner, map.noticeends);
    }
  };

  // ---- Notice banner -------------------------------------------------------

  function endOfDay(v) {
    v = String(v || '').trim();
    if (!v) return 0;
    var m, y, mo, d;
    if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
      y = +m[1]; mo = +m[2]; d = +m[3];
    } else if ((m = v.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/))) {
      mo = +m[1]; d = +m[2]; y = m[3] ? +m[3] : new Date().getFullYear();
      if (y < 100) y += 2000;
    } else {
      var p = new Date(v);
      if (isNaN(p.getTime())) return 0;   // can't read the date: ignore it
      y = p.getFullYear(); mo = p.getMonth() + 1; d = p.getDate();
    }
    return new Date(y, mo - 1, d, 23, 59, 59).getTime();
  }

  function showNotice(text, ends) {
    var box = document.querySelector('[data-sheet="notice"]');
    if (!box) return;
    var until = endOfDay(ends);
    if (text && (!until || Date.now() <= until)) {
      addNoticeStyle();
      box.textContent = text;
      box.hidden = false;
    } else {
      box.textContent = '';
      box.hidden = true;
    }
  }

  function addNoticeStyle() {
    if (document.getElementById('sheet-notice-style')) return;
    var s = make('style');
    s.id = 'sheet-notice-style';
    s.textContent =
      '.sheet-notice{background:#E3B33B;color:#1F3527;border-bottom:3px solid #2A4A34;' +
      'font-family:Archivo,system-ui,sans-serif;font-weight:600;font-size:1.05rem;' +
      'line-height:1.4;text-align:center;padding:12px 20px}' +
      '.sheet-notice[hidden]{display:none}';
    document.head.appendChild(s);
  }

  // ---- Loading -------------------------------------------------------------

  function apply(part, csv, source) {
    var rows = table(csv, SPEC[part]);
    var model = rows && BUILD[part](rows);
    if (!model) {
      console.warn('[sheet] ' + part + ' (' + source + '): couldn\'t read the tab (check its headings), keeping what\'s on the page');
      return false;
    }
    try {
      RENDER[part](model);
    } catch (e) {
      console.warn('[sheet] ' + part + ': ' + e.message);
      return false;
    }
    state[part] = model;
    document.dispatchEvent(new CustomEvent('mctap:sheet', { detail: { part: part, source: source, data: model } }));
    if (source === 'sheet') console.info('[sheet] ' + part + ' loaded from the Google Sheet');
    return true;
  }

  function get(url) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);
    return fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('Google answered ' + res.status);
        return res.text();
      })
      .then(function (text) {
        if (/^\s*</.test(text)) throw new Error('got a web page instead of CSV (is the tab published as CSV?)');
        return text;
      }, function (err) {
        clearTimeout(timer);
        throw err;
      });
  }

  var signature = JSON.stringify(SHEET_LINKS);

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY));
      return c && c.sig === signature && c.parts ? c : null;
    } catch (e) { return null; }
  }

  function writeCache(part, csv) {
    try {
      var c = readCache() || { sig: signature, parts: {} };
      c.parts[part] = csv;
      localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) { /* private browsing or storage full: fine, just no cache */ }
  }

  var parts = Object.keys(SHEET_LINKS).filter(function (p) { return need[p] && SHEET_LINKS[p]; });
  if (!parts.length) { resolveReady(state); return; }

  // Show the last good copy straight away, then replace it with a fresh one.
  var cached = readCache();
  parts.forEach(function (p) {
    if (cached && cached.parts[p]) apply(p, cached.parts[p], 'cache');
  });

  Promise.all(parts.map(function (p) {
    return get(SHEET_LINKS[p]).then(function (csv) {
      if (apply(p, csv, 'sheet')) writeCache(p, csv);
    }).catch(function (err) {
      var why = err && err.name === 'AbortError' ? 'Google took too long' : (err && err.message) || err;
      console.warn('[sheet] ' + p + ': ' + why + ', keeping what\'s on the page');
    });
  })).then(function () { resolveReady(state); });
})();
