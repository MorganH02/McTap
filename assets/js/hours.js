/* MC Tap — opening hours.
   Works out whether the bar is open right now in Monroe Center time, no
   matter where the visitor is, and handles closing times after midnight.

   TO CHANGE THE HOURS: edit the HOURS array below, and the matching
   openingHoursSpecification block in index.html (Google reads that one).
   Closing times after midnight go past 24 — 1am is 25.

   Exposes window.MCTapHours for other scripts (the order page uses it). */
(function () {
  "use strict";

  var HOURS = [
    { day: "Sunday",    open: 12, close: 22 },
    { day: "Monday",    open: 11, close: 24 },
    { day: "Tuesday",   open: 11, close: 24 },
    { day: "Wednesday", open: 11, close: 24 },
    { day: "Thursday",  open: 11, close: 24 },
    { day: "Friday",    open: 11, close: 25 },
    { day: "Saturday",  open: 11, close: 25 }
  ];

  function label(h) {
    var hr = h % 24;
    if (hr === 0) return "midnight";
    var suffix = hr < 12 ? "am" : "pm";
    var display = hr % 12 === 0 ? 12 : hr % 12;
    return display + suffix;
  }

  function labelMinutes(mins) {
    var h = Math.floor(mins / 60) % 24;
    var m = mins % 60;
    var suffix = h < 12 ? "am" : "pm";
    var display = h % 12 === 0 ? 12 : h % 12;
    return display + ":" + (m < 10 ? "0" : "") + m + suffix;
  }

  function rangeText(d) {
    return label(d.open) + " \u2013 " + label(d.close);
  }

  /* Current day and minute-of-day in America/Chicago. */
  function now() {
    try {
      var parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        weekday: "short", hour: "numeric", minute: "numeric", hour12: false
      }).formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return {
        day: days[map.weekday],
        mins: (parseInt(map.hour, 10) % 24) * 60 + parseInt(map.minute, 10)
      };
    } catch (e) {
      var n = new Date();
      return { day: n.getDay(), mins: n.getHours() * 60 + n.getMinutes() };
    }
  }

  /* { open, closesAt, opensAt, text }
     closesAt / opensAt are minutes of the day in Monroe Center time. */
  function state() {
    var t = now();
    var today = HOURS[t.day];
    var yesterday = HOURS[(t.day + 6) % 7];
    var res = { open: false, closesAt: null, opensAt: null, nowMins: t.mins, day: t.day };

    if (t.mins >= today.open * 60 && t.mins < today.close * 60) {
      res.open = true;
      res.closesAt = today.close * 60;
    } else if (yesterday.close > 24 && t.mins < (yesterday.close - 24) * 60) {
      res.open = true;
      res.closesAt = (yesterday.close - 24) * 60;
    } else if (t.mins < today.open * 60) {
      res.opensAt = today.open * 60;
    }

    if (res.open) {
      res.text = "Open now, until " + label(res.closesAt / 60);
    } else if (res.opensAt !== null) {
      res.text = "Closed \u2014 opens today at " + label(today.open);
    } else {
      var tomorrow = HOURS[(t.day + 1) % 7];
      res.text = "Closed \u2014 opens " + tomorrow.day + " at " + label(tomorrow.open);
    }
    return res;
  }

  function renderTable(tbody) {
    if (!tbody) return;
    var t = now();
    [1, 2, 3, 4, 5, 6, 0].forEach(function (i) {
      var d = HOURS[i];
      var tr = document.createElement("tr");
      if (i === t.day) tr.className = "today";
      var name = document.createElement("td");
      name.textContent = d.day;
      var time = document.createElement("td");
      time.textContent = rangeText(d);
      tr.appendChild(name);
      tr.appendChild(time);
      tbody.appendChild(tr);
    });
  }

  function renderBadge(textEl, dotEl, s) {
    if (textEl) textEl.textContent = s.text;
    if (dotEl) dotEl.className = "dot " + (s.open ? "open" : "closed");
  }

  window.MCTapHours = {
    HOURS: HOURS,
    label: label,
    labelMinutes: labelMinutes,
    now: now,
    state: state,
    renderTable: renderTable,
    renderBadge: renderBadge
  };

  function boot() {
    renderTable(document.getElementById("hoursBody"));
    renderBadge(
      document.getElementById("statusText"),
      document.getElementById("dot"),
      state()
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
