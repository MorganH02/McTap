/* ===========================================================================
   MC TAP — ONLINE ORDERING
   ===========================================================================
   Menu items and prices live in menu.js. Opening hours live in hours.js.
   This file only handles the interface, the cart maths, and sending.

   Nothing is stored between visits and no payment is taken here. The order
   is composed in the browser and handed off. Where it goes is set by
   MCTAP_CONFIG.endpoint in menu.js — see sendOrder() at the bottom.
   =========================================================================== */
(function () {
  "use strict";

  var CFG = window.MCTAP_CONFIG;
  var MENU = window.MCTAP_MENU;
  var Hours = window.MCTapHours;

  /* cart lives in memory only — refreshing the page clears it, which is the
     behaviour we want for a takeout order */
  var cart = [];
  var lineSeq = 0;

  /* ---------------------------------------------------------------- utils */

  function money(n) {
    return "$" + n.toFixed(2);
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function findItem(id) {
    for (var i = 0; i < MENU.length; i++) {
      for (var j = 0; j < MENU[i].items.length; j++) {
        if (MENU[i].items[j].id === id) return MENU[i].items[j];
      }
    }
    return null;
  }

  /* ------------------------------------------------------- ordering window */

  /* Can we take an order right now? Returns { ok, reason }. */
  function orderingWindow() {
    if (CFG.orderingPaused) {
      return { ok: false, reason: "Online ordering is paused right now. Give us a call at " + CFG.phoneDisplay + " and we'll sort you out." };
    }
    var s = Hours.state();
    if (!s.open) {
      return { ok: false, reason: "Build your order now and call it in when we open, or come sit down." };
    }
    var minsLeft = s.closesAt - s.nowMins;
    if (minsLeft < CFG.lastOrderBeforeCloseMinutes) {
      return { ok: false, reason: "The kitchen has stopped taking online orders for tonight. Call " + CFG.phoneDisplay + " and ask what's still possible." };
    }
    return { ok: true, closesAt: s.closesAt, nowMins: s.nowMins };
  }

  /* Pickup times, every 15 minutes from now + prep time until close. */
  function pickupSlots(win) {
    var slots = [];
    var earliest = win.nowMins + CFG.prepMinutes;
    var start = Math.ceil(earliest / 15) * 15;
    for (var m = start; m <= win.closesAt - 15 && slots.length < 16; m += 15) {
      slots.push(m);
    }
    return slots;
  }

  /* ------------------------------------------------------------- the menu */

  function renderMenu() {
    var root = document.getElementById("menuRoot");
    root.innerHTML = "";

    MENU.forEach(function (section) {
      var wrapper = el("section", "menu-section");
      wrapper.id = "sec-" + section.id;

      wrapper.appendChild(el("h2", "menu-section-title", section.name));
      if (section.note) wrapper.appendChild(el("p", "menu-section-note", section.note));

      var list = el("ul", "menu-list");
      section.items.forEach(function (item) {
        var li = el("li", "menu-item");

        var btn = el("button", "menu-item-btn");
        btn.type = "button";
        btn.setAttribute("aria-label", "Add " + item.name + " to your order");

        /* optional photo — only the items with an `image` in menu.js get one */
        if (item.image) {
          var thumb = el("span", "menu-item-thumb");
          var img = document.createElement("img");
          img.src = item.image;
          img.alt = "";
          img.loading = "lazy";
          thumb.appendChild(img);
          btn.appendChild(thumb);
        }

        var body = el("div", "menu-item-body");
        body.appendChild(el("h3", null, item.name));
        if (item.desc) body.appendChild(el("p", "menu-item-desc", item.desc));
        var meta = el("p", "menu-item-meta");
        meta.appendChild(el("span", "price", money(item.price)));
        if (item.groups && item.groups.length) {
          meta.appendChild(el("span", "customizable", "Make it your way"));
        }
        body.appendChild(meta);

        btn.appendChild(body);
        btn.appendChild(el("span", "menu-item-add", "+"));
        btn.addEventListener("click", function () { openItem(item); });

        li.appendChild(btn);
        list.appendChild(li);
      });

      wrapper.appendChild(list);
      root.appendChild(wrapper);
    });
  }

  /* ------------------------------------------------- customize one item */

  var dialog = document.getElementById("itemDialog");
  var currentItem = null;

  function openItem(item) {
    currentItem = item;
    var form = document.getElementById("itemForm");
    form.innerHTML = "";

    document.getElementById("itemDialogTitle").textContent = item.name;
    var sub = document.getElementById("itemDialogDesc");
    sub.textContent = item.desc || "";
    sub.hidden = !item.desc;

    (item.groups || []).forEach(function (group) {
      var fs = el("fieldset", "opt-group");
      var lg = el("legend", null, group.label);
      if (group.required) {
        var req = el("span", "req", "required");
        lg.appendChild(req);
      }
      fs.appendChild(lg);

      var wrap = el("div", "opt-options");
      group.options.forEach(function (opt, idx) {
        var id = "opt-" + group.id + "-" + idx;
        var row = el("label", "opt");
        row.setAttribute("for", id);

        var input = document.createElement("input");
        input.type = group.type === "multi" ? "checkbox" : "radio";
        input.name = group.id;
        input.id = id;
        input.value = opt.label;
        input.dataset.price = opt.price;
        if (group.type === "single" && group.required && idx === 0) input.checked = true;

        row.appendChild(input);
        row.appendChild(el("span", "opt-label", opt.label));
        if (opt.price > 0) row.appendChild(el("span", "opt-price", "+" + money(opt.price)));
        else if (opt.price < 0) row.appendChild(el("span", "opt-price", "\u2212" + money(Math.abs(opt.price))));

        input.addEventListener("change", updateDialogTotal);
        wrap.appendChild(row);
      });

      fs.appendChild(wrap);
      form.appendChild(fs);
    });

    /* free-text note, always available */
    var noteWrap = el("div", "opt-group note-group");
    var noteLabel = el("label", null, "Anything else the kitchen should know?");
    noteLabel.setAttribute("for", "itemNote");
    var note = document.createElement("textarea");
    note.id = "itemNote";
    note.rows = 2;
    note.maxLength = 200;
    note.placeholder = "Cut in half, extra napkins, allergy \u2014 whatever it is";
    noteWrap.appendChild(noteLabel);
    noteWrap.appendChild(note);
    form.appendChild(noteWrap);

    document.getElementById("itemQty").value = 1;
    updateDialogTotal();

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function readDialogSelections() {
    var chosen = [];
    var extra = 0;
    var form = document.getElementById("itemForm");
    Array.prototype.forEach.call(form.querySelectorAll("input:checked"), function (input) {
      var price = parseFloat(input.dataset.price) || 0;
      chosen.push({ label: input.value, price: price });
      extra += price;
    });
    return { chosen: chosen, extra: extra };
  }

  function updateDialogTotal() {
    if (!currentItem) return;
    var sel = readDialogSelections();
    var qty = parseInt(document.getElementById("itemQty").value, 10) || 1;
    var each = currentItem.price + sel.extra;
    document.getElementById("itemTotal").textContent = money(each * qty);
  }

  function addCurrentItemToCart() {
    var sel = readDialogSelections();
    var qty = parseInt(document.getElementById("itemQty").value, 10) || 1;
    var noteEl = document.getElementById("itemNote");

    cart.push({
      line: ++lineSeq,
      id: currentItem.id,
      name: currentItem.name,
      base: currentItem.price,
      options: sel.chosen.filter(function (o) { return o.label !== "None"; }),
      note: noteEl ? noteEl.value.trim() : "",
      qty: qty,
      each: currentItem.price + sel.extra
    });

    closeDialog();
    renderCart();
    flashCart();
  }

  function closeDialog() {
    currentItem = null;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  /* ------------------------------------------------------------- the cart */

  function cartSubtotal() {
    return cart.reduce(function (sum, line) { return sum + line.each * line.qty; }, 0);
  }

  function renderCart() {
    var list = document.getElementById("cartLines");
    var empty = document.getElementById("cartEmpty");
    list.innerHTML = "";

    empty.hidden = cart.length > 0;

    cart.forEach(function (line) {
      var li = el("li", "cart-line");

      var head = el("div", "cart-line-head");
      head.appendChild(el("span", "cart-line-name", (line.qty > 1 ? line.qty + " \u00d7 " : "") + line.name));
      head.appendChild(el("span", "cart-line-price", money(line.each * line.qty)));
      li.appendChild(head);

      if (line.options.length) {
        li.appendChild(el("p", "cart-line-opts",
          line.options.map(function (o) { return o.label; }).join(", ")));
      }
      if (line.note) {
        li.appendChild(el("p", "cart-line-note", "\u201c" + line.note + "\u201d"));
      }

      var remove = el("button", "cart-line-remove", "Remove");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove " + line.name + " from your order");
      remove.addEventListener("click", function () {
        cart = cart.filter(function (l) { return l.line !== line.line; });
        renderCart();
      });
      li.appendChild(remove);

      list.appendChild(li);
    });

    var subtotal = cartSubtotal();
    var tax = CFG.taxRate ? subtotal * CFG.taxRate : 0;
    document.getElementById("cartSubtotal").textContent = money(subtotal);
    document.getElementById("taxRow").hidden = !CFG.taxRate;
    document.getElementById("taxNote").hidden = !!CFG.taxRate;
    document.getElementById("cartTax").textContent = money(tax);
    document.getElementById("cartTotal").textContent = money(subtotal + tax);
    document.getElementById("cartTotals").hidden = cart.length === 0;

    var count = cart.reduce(function (n, l) { return n + l.qty; }, 0);
    var bar = document.getElementById("cartBar");
    document.getElementById("cartBarCount").textContent =
      count + (count === 1 ? " item" : " items");
    document.getElementById("cartBarTotal").textContent = money(subtotal + tax);
    bar.hidden = count === 0;

    var checkout = document.getElementById("toCheckout");
    var win = orderingWindow();
    checkout.disabled = cart.length === 0 || !win.ok;
  }

  function flashCart() {
    var panel = document.getElementById("cartPanel");
    panel.classList.remove("flash");
    void panel.offsetWidth;
    panel.classList.add("flash");
  }

  /* --------------------------------------------------------- the checkout */

  function openCheckout() {
    var win = orderingWindow();
    if (!win.ok || cart.length === 0) return;

    var select = document.getElementById("pickupTime");
    select.innerHTML = "";
    var asap = document.createElement("option");
    asap.value = "asap";
    asap.textContent = "As soon as it's ready (about " + CFG.prepMinutes + " minutes)";
    select.appendChild(asap);
    pickupSlots(win).forEach(function (m) {
      var o = document.createElement("option");
      o.value = String(m);
      o.textContent = Hours.labelMinutes(m);
      select.appendChild(o);
    });

    document.getElementById("orderStep").hidden = true;
    document.getElementById("checkoutStep").hidden = false;
    document.getElementById("checkoutStep").scrollIntoView({ block: "start" });
    document.getElementById("custName").focus();
  }

  function backToMenu() {
    document.getElementById("checkoutStep").hidden = true;
    document.getElementById("orderStep").hidden = false;
    window.scrollTo(0, 0);
  }

  /* Builds the plain-text ticket a human reads in the kitchen. */
  function ticketText(order) {
    var lines = [];
    lines.push("MC TAP \u2014 ONLINE ORDER");
    lines.push("Pickup: " + order.pickup);
    lines.push("Name: " + order.name);
    lines.push("Phone: " + order.phone);
    lines.push("");
    order.items.forEach(function (line) {
      lines.push(line.qty + " x " + line.name + "   " + money(line.each * line.qty));
      line.options.forEach(function (o) { lines.push("    - " + o.label); });
      if (line.note) lines.push("    ** " + line.note);
    });
    lines.push("");
    if (order.tax) {
      lines.push("Subtotal " + money(order.subtotal));
      lines.push("Tax      " + money(order.tax));
      lines.push("TOTAL    " + money(order.total));
    } else {
      lines.push("SUBTOTAL " + money(order.subtotal) + "  (plus tax)");
    }
    lines.push("");
    lines.push("PAY AT PICKUP \u2014 no payment taken online.");
    if (order.note) {
      lines.push("");
      lines.push("Note: " + order.note);
    }
    return lines.join("\n");
  }

  function collectOrder() {
    var subtotal = cartSubtotal();
    var tax = CFG.taxRate ? subtotal * CFG.taxRate : 0;
    var select = document.getElementById("pickupTime");
    var pickup = select.value === "asap"
      ? "ASAP (about " + CFG.prepMinutes + " min)"
      : Hours.labelMinutes(parseInt(select.value, 10));

    return {
      placedAt: new Date().toISOString(),
      name: document.getElementById("custName").value.trim(),
      phone: document.getElementById("custPhone").value.trim(),
      pickup: pickup,
      note: document.getElementById("orderNote").value.trim(),
      items: cart.map(function (l) {
        return { name: l.name, qty: l.qty, each: l.each, options: l.options, note: l.note };
      }),
      subtotal: subtotal,
      tax: tax,
      total: subtotal + tax
    };
  }

  /* ------------------------------------------------------------- sending */

  /* If CFG.endpoint is set the order is POSTed there as JSON. Otherwise the
     customer gets a finished ticket plus buttons to text it, email it, or
     copy it — which needs no server and works the day you publish. */
  function sendOrder(order) {
    var status = document.getElementById("sendStatus");
    var submit = document.getElementById("placeOrder");

    if (!CFG.endpoint) {
      showConfirmation(order, false);
      return;
    }

    submit.disabled = true;
    status.textContent = "Sending your order\u2026";
    status.className = "send-status working";

    fetch(CFG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      showConfirmation(order, true);
    }).catch(function () {
      submit.disabled = false;
      status.className = "send-status error";
      status.textContent = "That didn't go through. Call " + CFG.phoneDisplay +
        " and read them the order, or try again in a moment.";
    });
  }

  function showConfirmation(order, wasSent) {
    var text = ticketText(order);

    document.getElementById("checkoutStep").hidden = true;
    document.getElementById("doneStep").hidden = false;

    document.getElementById("doneHeadline").textContent =
      wasSent ? "Order sent" : "Your order is ready to send";
    var canSend = CFG.orderTextTo || CFG.orderEmailTo;
    document.getElementById("doneBlurb").textContent = wasSent
      ? "We've got it. Come by at " + order.pickup + " and pay when you pick up. If anything's wrong we'll call you at " + order.phone + "."
      : canSend
        ? "Send it one of these ways and we'll start cooking. You pay when you pick up."
        : "Copy your order below and give us a call \u2014 it's quicker than reading it out. You pay when you pick up.";

    document.getElementById("handoff").hidden = wasSent;
    document.getElementById("ticket").textContent = text;

    var body = encodeURIComponent(text);

    /* Only offer the text and email buttons if a PUBLIC destination is set in
       menu.js. With none set, the customer copies the ticket and calls it in,
       so no contact details are ever published. */
    var textBtn = document.getElementById("sendText");
    if (CFG.orderTextTo) {
      textBtn.href = "sms:" + CFG.orderTextTo +
        (/iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?") + "body=" + body;
      textBtn.hidden = false;
    } else {
      textBtn.hidden = true;
    }

    var mailBtn = document.getElementById("sendEmail");
    if (CFG.orderEmailTo) {
      mailBtn.href = "mailto:" + CFG.orderEmailTo + "?subject=" +
        encodeURIComponent("Online order \u2014 " + order.name) + "&body=" + body;
      mailBtn.hidden = false;
    } else {
      mailBtn.hidden = true;
    }

    document.getElementById("callItIn").href = "tel:" + CFG.phone;

    document.getElementById("copyTicket").addEventListener("click", function () {
      var btn = this;
      function done() { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy order"; }, 2000); }
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
      else done();
    });

    cart = [];
    renderCart();
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------- startup */

  function showTodaysSpecial() {
    var el2 = document.getElementById("todaySpecial");
    if (!el2 || !CFG.dailySpecials) return;
    var text = CFG.dailySpecials[Hours.now().day];
    if (!text) { el2.hidden = true; return; }
    el2.hidden = false;
    el2.textContent = text;
  }

  function showWindowNotice() {
    var win = orderingWindow();
    var notice = document.getElementById("orderNotice");
    if (win.ok) {
      notice.hidden = true;
    } else {
      notice.hidden = false;
      notice.textContent = win.reason;
    }
    Hours.renderBadge(
      document.getElementById("statusText"),
      document.getElementById("dot"),
      Hours.state()
    );
  }

  function boot() {
    if (!CFG.pricesConfirmed) {
      document.getElementById("priceWarning").hidden = false;
    }

    renderMenu();
    renderCart();
    showWindowNotice();
    showTodaysSpecial();

    document.getElementById("itemQty").addEventListener("change", updateDialogTotal);
    document.getElementById("addToOrder").addEventListener("click", addCurrentItemToCart);
    document.getElementById("cancelItem").addEventListener("click", closeDialog);
    dialog.addEventListener("cancel", function (e) { e.preventDefault(); closeDialog(); });

    document.getElementById("toCheckout").addEventListener("click", openCheckout);
    document.getElementById("cartBarBtn").addEventListener("click", function () {
      document.getElementById("cartPanel").scrollIntoView({ block: "start" });
    });
    document.getElementById("backToMenu").addEventListener("click", backToMenu);

    document.getElementById("checkoutForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var order = collectOrder();
      if (!order.name || !order.phone) return;
      sendOrder(order);
    });

    /* re-check the ordering window every minute so a page left open
       doesn't let someone order after the kitchen has shut */
    setInterval(function () {
      showWindowNotice();
      showTodaysSpecial();
      renderCart();
    }, 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
