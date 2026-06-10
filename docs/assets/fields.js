/* ============================================================
   Fillable fields + tools — enhances the verbatim contract at runtime.
   The source HTML keeps the original underscores (text stays 1:1);
   this script converts placeholder runs into labelled, persistent fields.

   Per-page storage namespace: set <body data-store-ns="acord"> etc.
   so each document keeps its own field/selection data and they never
   clobber one another. No attribute => the original contract keys.
   ============================================================ */
var ARD_NS = (document.body && document.body.getAttribute("data-store-ns")) || "";
function ardStoreKey(base){ return ARD_NS ? ("ardeleanu_" + ARD_NS + "_" + base) : ("ardeleanu_" + base); }

(function () {
  "use strict";
  var article = document.querySelector(".article");
  if (!article) return;

  // On mobile, documents are read-only/informative — no fill toolbar (bottom buttons).
  // Detect by the mobile header that only the "- Mobil" pages render.
  var IS_MOBILE = !!document.querySelector("header.m-top");
  if (IS_MOBILE && document.body) document.body.classList.add("doc-readonly");

  var STORE = ARD_NS ? ("ardeleanu_" + ARD_NS + "_fill_v1") : "ardeleanu_contract_fill_v1";
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) {}

  // ---- label inference from surrounding text ----
  function labelFor(before, after) {
    var b = before.toLowerCase().replace(/\s+$/, "");
    var a = after.replace(/^\s+/, "");
    if (/^s\.r\.l/i.test(a)) return "denumire firmă";
    if (/cabinet$/.test(b)) return "cabinet";
    if (/\/?\s*cui$/.test(b)) return "CUI";
    if (/iban[:\s]*$/.test(b)) return "IBAN";
    if (/banca$/.test(b)) return "banca";
    if (/num[ăa]rul$/.test(b)) return "nr. ORC";
    if (/denti[șs]ti?\s*nr\.?$/.test(b)) return "nr. certificat";
    if (/\bnr\.?$/.test(b)) return "număr";
    if (/procentul de$/.test(b)) return "%";
    if (/maxim(um)?$/.test(b)) return "număr";
    if (/(mai mult de)$/.test(b)) return "număr";
    if (/luna$/.test(b)) return "luna";
    if (/ast[ăa]zi,?$/.test(b)) return "data";
    if (/data:?$/.test(b)) return "data";
    if (/adresa:?$/.test(b)) return "email / adresă";
    if (/consim[țt]?[ăa]?mintele$/.test(b) || /acordul pacientului,?$/.test(b)) return "document";
    if (/cu acesta$/.test(b)) return "detalii";
    if (/doctor[-_]?dentist$/.test(b)) return "nume medic";
    if (/\bdr\.?$/.test(b)) return "nume medic";
    if (/semn[ăa]tur[ăa]:?$/.test(b)) return "semnătură";
    if (/\b[îi]n$/.test(b)) return "localitate";
    return "completează";
  }

  // ---- walk text nodes, replace placeholder runs ----
  var RE = /(_{3,}|\.{4,}|…{2,}\.?)/;
  var REg = /(_{3,}|\.{4,}|…{2,}\.?)/g;
  var walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      if (!n.nodeValue || !RE.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      var p = n.parentNode;
      while (p && p !== article) {
        if (/^(SCRIPT|STYLE|A)$/.test(p.nodeName)) return NodeFilter.FILTER_REJECT;
        if (p.classList && (p.classList.contains("fill") || p.classList.contains("xref"))) return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [], n;
  while ((n = walker.nextNode())) nodes.push(n);

  var idx = 0;
  nodes.forEach(function (node) {
    var text = node.nodeValue;
    var parts = text.split(REg);
    var frag = document.createDocumentFragment();
    var cursor = 0; // track offset for context
    for (var i = 0; i < parts.length; i++) {
      var piece = parts[i];
      if (i % 2 === 1) {
        // a placeholder run
        var before = text.slice(0, cursor);
        var after = text.slice(cursor + piece.length);
        var span = document.createElement("span");
        span.className = "fill";
        // Mobile is read-only/informative — blanks are shown but not fillable.
        span.setAttribute("contenteditable", IS_MOBILE ? "false" : "true");
        span.setAttribute("spellcheck", "false");
        span.setAttribute("data-fill", idx);
        span.setAttribute("data-label", labelFor(before, after));
        var v = saved[idx];
        if (v != null && v !== "") { span.textContent = v; span.classList.add("filled"); }
        frag.appendChild(span);
        idx++;
      } else if (piece) {
        frag.appendChild(document.createTextNode(piece));
      }
      cursor += piece.length;
    }
    node.parentNode.replaceChild(frag, node);
  });

  var fields = Array.prototype.slice.call(article.querySelectorAll(".fill"));

  // ---- persistence + state ----
  var savedEl = null, savedTimer = null;
  function flashSaved() {
    if (!savedEl) return;
    savedEl.classList.add("on");
    savedEl.textContent = "Salvat automat ✓";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { savedEl.classList.remove("on"); }, 1600);
  }
  function persist() {
    var o = {};
    fields.forEach(function (f) {
      var t = f.textContent.trim();
      if (t) o[f.getAttribute("data-fill")] = t;
    });
    try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {}
    flashSaved();
  }
  function refresh() {
    var filled = 0;
    fields.forEach(function (f) {
      var has = f.textContent.trim().length > 0;
      f.classList.toggle("filled", has);
      if (has) filled++;
    });
    updateProgress(filled, fields.length);
  }
  fields.forEach(function (f) {
    f.addEventListener("input", function () { persist(); var has=f.textContent.trim().length>0; f.classList.toggle("filled",has); updateProgress(); });
    f.addEventListener("blur", function () { persist(); refresh(); });
    f.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); f.blur(); jumpNext(); }
      if (e.key === "Tab") { /* allow native; but route to next field */ }
    });
  });

  // ---- toolbar ----
  var tools = document.createElement("div");
  tools.id = "doctools";
  tools.innerHTML =
    '<div class="progress"><div class="ring-wrap">' +
      '<svg class="ring" viewBox="0 0 40 40"><circle class="bg" cx="20" cy="20" r="16" fill="none" stroke-width="4"/>' +
      '<circle class="fg" cx="20" cy="20" r="16" fill="none" stroke-width="4" transform="rotate(-90 20 20)"/>' +
      '<text x="20" y="24" text-anchor="middle">0%</text></svg>' +
      '<div class="lbl"><b><span id="dt-filled">0</span>/<span id="dt-total">0</span> completate</b>câmpuri de completat</div>' +
    '</div><div id="dt-saved" class="saved-pill"></div></div>' +
    '<div class="btns">' +
      '<button id="dt-next" class="primary" title="Sari la următorul câmp gol">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>Următorul</button>' +
      '<button id="dt-print" title="Tipărește / Salvează PDF">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>' +
      '<button id="dt-save" title="Salvează o copie de siguranță (fișier)">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>' +
      '<button id="dt-restore" title="Restaurează dintr-o copie salvată">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>' +
      '<button id="dt-clear" title="Golește toate câmpurile">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>' +
    '</div>';
  // Desktop only: mobile pages are read-only, so the bottom toolbar is omitted.
  // (Elements below are queried within `tools`, which works even when detached,
  // so the rest of the script keeps running without the bar being shown.)
  if (!IS_MOBILE) document.body.appendChild(tools);

  var elFilled = tools.querySelector("#dt-filled"),
      elTotal = tools.querySelector("#dt-total"),
      ring = tools.querySelector(".ring .fg"),
      ringTxt = tools.querySelector(".ring text"),
      C = 2 * Math.PI * 16;
  ring.style.strokeDasharray = C;

  function updateProgress(filled, total) {
    if (filled == null) { filled = fields.filter(function(f){return f.textContent.trim();}).length; }
    if (total == null) total = fields.length;
    elFilled.textContent = filled; elTotal.textContent = total;
    var pct = total ? filled / total : 0;
    ring.style.strokeDashoffset = C * (1 - pct);
    ringTxt.textContent = Math.round(pct * 100) + "%";
    tools.classList.toggle("done", filled === total && total > 0);
  }

  function jumpNext() {
    var empty = fields.filter(function (f) { return !f.textContent.trim(); });
    if (!empty.length) return;
    // pick first empty below current scroll position, else first
    var y = window.scrollY + 120;
    var target = empty.find(function (f) { return f.getBoundingClientRect().top + window.scrollY > y; }) || empty[0];
    var top = target.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4;
    window.scrollTo({ top: top, behavior: "smooth" });
    setTimeout(function () { target.focus(); }, 350);
  }

  tools.querySelector("#dt-next").addEventListener("click", jumpNext);
  tools.querySelector("#dt-print").addEventListener("click", function () { window.print(); });
  tools.querySelector("#dt-clear").addEventListener("click", function () {
    if (!confirm("Golești toate câmpurile completate?")) return;
    fields.forEach(function (f) { f.textContent = ""; f.classList.remove("filled"); });
    persist(); refresh();
  });

  // ---- save / restore a backup file (portable across devices) ----
  savedEl = tools.querySelector("#dt-saved");
  var PREFIX = "ardeleanu_" + (ARD_NS || "contract");
  function exportData() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) out[k] = localStorage.getItem(k);
    }
    var payload = { app: "ardeleanu", doc: (ARD_NS || "contract"), savedAt: new Date().toISOString(), data: out };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = backupName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    if (savedEl) { savedEl.classList.add("on"); savedEl.textContent = "Copie descărcată ✓"; clearTimeout(savedTimer); savedTimer = setTimeout(function () { savedEl.classList.remove("on"); }, 2200); }
  }
  // filename: "<doc> — Ardeleanu & <medic> — <data>.json"
  function fieldByLabel(label) {
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].getAttribute("data-label") === label) {
        var t = fields[i].textContent.trim();
        if (t) return t;
      }
    }
    return "";
  }
  function sanitize(s) { return (s || "").replace(/[\/\\:*?"<>|]+/g, "").replace(/\s+/g, " ").trim(); }
  function backupName() {
    var DOCLABEL = { contract: "Contract", acord: "Acord incetare", anexa1: "Anexa 1 Grila", anexa2: "Anexa 2 Amortizare" }[(ARD_NS || "contract")] || "Document";
    var prestator = sanitize(fieldByLabel("denumire firmă"));
    var medic = sanitize(fieldByLabel("nume medic"));
    if (medic && !/^dr\.?\s/i.test(medic)) medic = "Dr. " + medic;
    var who = [prestator, medic].filter(Boolean).join(" & ");
    var date = new Date().toISOString().slice(0, 10);
    var base = who ? DOCLABEL + " - " + who : DOCLABEL;
    return sanitize(base + " - " + date) + ".json";
  }
  function restoreData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var payload = JSON.parse(reader.result);
        var data = payload && payload.data ? payload.data : null;
        if (!data) throw new Error("format");
        if (payload.doc && (ARD_NS || "contract") !== payload.doc) {
          if (!confirm("Copia este pentru „" + payload.doc + "”, iar acum ești pe „" + (ARD_NS || "contract") + "”. Continui restaurarea?")) return;
        }
        Object.keys(data).forEach(function (k) { try { localStorage.setItem(k, data[k]); } catch (e) {} });
        location.reload();
      } catch (e) { alert("Fișier invalid. Alege o copie .json salvată din acest document."); }
    };
    reader.readAsText(file);
  }
  var restoreInput = document.createElement("input");
  restoreInput.type = "file"; restoreInput.accept = "application/json,.json"; restoreInput.style.display = "none";
  document.body.appendChild(restoreInput);
  restoreInput.addEventListener("change", function () { if (restoreInput.files[0]) restoreData(restoreInput.files[0]); restoreInput.value = ""; });
  tools.querySelector("#dt-save").addEventListener("click", exportData);
  tools.querySelector("#dt-restore").addEventListener("click", function () { restoreInput.click(); });

  refresh();

  // ---- reading progress bar ----
  var bar = document.createElement("div");
  bar.id = "readbar";
  document.body.appendChild(bar);
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();


/* ============================================================
   Anexa 1 — selectable manopere grids (dynamic include/exclude)
   ============================================================ */
(function () {
  "use strict";
  var grids = Array.prototype.slice.call(document.querySelectorAll("table.grila.selectable"));
  if (!grids.length) return;
  var anexa = document.getElementById("anexa-1");
  var GKEY = ardStoreKey("grila_sel_v1");
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(GKEY) || "null"); } catch (e) {}
  var firstTime = (saved === null);
  var set = new Set(Array.isArray(saved) ? saved : []);
  function persist() { try { localStorage.setItem(GKEY, JSON.stringify(Array.from(set))); } catch (e) {} }
  function refreshEmpties() {
    grids.forEach(function (t) {
      t.classList.toggle("is-empty", t.querySelectorAll("tbody tr.on").length === 0);
    });
  }
  grids.forEach(function (t) {
    var cols = t.querySelectorAll("thead th").length;
    var tb = t.querySelector("tbody");
    var ph = document.createElement("tr");
    ph.className = "grila-empty";
    ph.innerHTML = '<td colspan="' + cols + '">Nicio manoperă selectată. Apasă „Editează manoperele" și bifează manoperele aplicabile Prestatorului.</td>';
    tb.appendChild(ph);
    Array.prototype.slice.call(t.querySelectorAll("tbody tr[data-opt]")).forEach(function (tr) {
      var id = tr.getAttribute("data-opt");
      var cb = tr.querySelector("input.grila-pick");
      var on = firstTime ? false : set.has(id);
      cb.checked = on;
      tr.classList.toggle("on", on);
      cb.addEventListener("change", function () {
        tr.classList.toggle("on", cb.checked);
        if (cb.checked) set.add(id); else set.delete(id);
        persist(); refreshEmpties();
      });
    });
  });
  refreshEmpties();
  var btn = document.getElementById("grila-edit-toggle");
  function setMode(editing) {
    if (anexa) anexa.classList.toggle("grid-editing", editing);
    if (btn) {
      btn.setAttribute("aria-pressed", editing ? "true" : "false");
      var lbl = btn.querySelector(".lbl");
      if (lbl) lbl.textContent = editing ? "Gata — vezi anexa" : "Editează manoperele";
    }
  }
  if (btn) btn.addEventListener("click", function () {
    setMode(!(anexa && anexa.classList.contains("grid-editing")));
  });
  setMode(false);
})();


/* ============================================================
   Anexa 1 — remuneration-TYPE selector (confidentiality split)
   Picks which remuneration types apply to this Prestator; only
   the ticked sections appear on the annex and at print/PDF.
   ============================================================ */
(function () {
  "use strict";
  var anexa = document.getElementById("anexa-1");
  if (!anexa) return;
  var picks = Array.prototype.slice.call(anexa.querySelectorAll(".remun-pick"));
  var sections = Array.prototype.slice.call(anexa.querySelectorAll(".remun-section"));
  if (!picks.length || !sections.length) return;

  var RKEY = ardStoreKey("remun_sel_v1");
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(RKEY) || "null"); } catch (e) {}
  // default: NO types active — only the administrator selects which apply
  var active = new Set(Array.isArray(saved) ? saved : []);
  function persist() { try { localStorage.setItem(RKEY, JSON.stringify(Array.from(active))); } catch (e) {} }

  // map type -> the h3 id used by the TOC, to hide its TOC entry too
  function tocLinkFor(type) {
    var a = document.querySelector('.toc a[data-target="anexa-1-' + type + '"]');
    return a ? a.closest("li") : null;
  }

  // capture base titles (without the letter) once, for dynamic relettering
  var orderedSecs = sections.slice();
  orderedSecs.forEach(function (sec) {
    var h3 = sec.querySelector("h3.sub-h");
    var span = h3 ? h3.querySelector(".sec-letter") : null;
    if (!h3 || !span) return;
    var base = "";
    Array.prototype.slice.call(h3.childNodes).forEach(function (n) {
      if (n !== span) base += n.textContent;
    });
    sec.setAttribute("data-sectitle", base.trim());
  });

  // re-letter only the active sections, sequentially (A, B, C…), + sync TOC
  function relabel() {
    var letters = "ABCDEFGH";
    var n = 0;
    orderedSecs.forEach(function (sec) {
      var type = sec.getAttribute("data-remun");
      var h3 = sec.querySelector("h3.sub-h");
      var span = h3 ? h3.querySelector(".sec-letter") : null;
      var tocA = h3 ? document.querySelector('.toc a[data-target="' + h3.id + '"]') : null;
      var base = sec.getAttribute("data-sectitle") || "";
      if (active.has(type)) {
        var L = letters[n] || "";
        n++;
        if (span) span.textContent = L + ". ";
        if (tocA) tocA.textContent = L + ". " + base;
      } else {
        if (span) span.textContent = "";
        if (tocA) tocA.textContent = base;
      }
    });
  }

  function applyType(type) {
    var on = active.has(type);
    sections.forEach(function (sec) {
      if (sec.getAttribute("data-remun") === type) sec.classList.toggle("remun-off", !on);
    });
    var li = tocLinkFor(type);
    if (li) li.style.display = on ? "" : "none";
  }

  picks.forEach(function (cb) {
    var type = cb.getAttribute("data-remun");
    cb.checked = active.has(type);
    applyType(type);
    cb.addEventListener("change", function () {
      if (cb.checked) active.add(type); else active.delete(type);
      persist();
      applyType(type);
      relabel();
    });
  });
  relabel();
})();


/* ============================================================
   Anexa 1.A — per-row role choice (de bază / secundară), persistent
   ============================================================ */
(function () {
  "use strict";
  var radios = Array.prototype.slice.call(document.querySelectorAll("input.rol-pick, input.var-pick"));
  if (!radios.length) return;
  var KEY = ardStoreKey("rol_sel_v1");
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
  function persist() {
    var o = {};
    radios.forEach(function (r) { if (r.checked) o[r.name] = r.value; });
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  radios.forEach(function (r) {
    if (saved[r.name] === r.value) r.checked = true;
    r.addEventListener("change", persist);
  });
})();


/* ============================================================
   Anexa 2 — auto-compute monthly amount (baza ÷ luni)
   Label adapts to the chosen variant (deducted / borne).
   ============================================================ */
(function () {
  "use strict";
  var anexa2 = document.getElementById("anexa-2");
  if (!anexa2) return;
  var baseCell = anexa2.querySelector('[data-calc="base"]');
  var monthsCell = anexa2.querySelector('[data-calc="months"]');
  var out = document.getElementById("a2-monthly");
  var lbl = document.getElementById("a2-monthly-label");
  if (!baseCell || !monthsCell || !out) return;

  function num(s) {
    s = (s || "").replace(/[^\d.,]/g, "");
    if (!s) return NaN;
    if (s.indexOf(",") >= 0) { s = s.replace(/\./g, "").replace(",", "."); }
    else {
      var parts = s.split(".");
      if (parts.length > 1 && parts[parts.length - 1].length === 3) s = s.replace(/\./g, "");
    }
    return parseFloat(s);
  }
  function variant() {
    var r = anexa2.querySelector('input[name="anexa2-mod"]:checked');
    return r ? r.value : null;
  }

  // ---- date helpers (start = annex date; end = start + N months) ----
  var MONTHS = ["ianuarie","februarie","martie","aprilie","mai","iunie","iulie","august","septembrie","octombrie","noiembrie","decembrie"];
  function parseDate(s) {
    s = (s || "").trim();
    if (!s) return null;
    var m = s.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})$/);
    if (m) { var y = +m[3]; if (y < 100) y += 2000; return { d: +m[1], mo: +m[2], y: y, kind: "dmy" }; }
    m = s.match(/^(\d{1,2})[.\/\-](\d{4})$/);
    if (m) return { d: 1, mo: +m[1], y: +m[2], kind: "my" };
    m = s.toLowerCase().match(/^([a-zăâîșț]+)\s+(\d{4})$/);
    if (m) { var mi = MONTHS.indexOf(m[1]); if (mi >= 0) return { d: 1, mo: mi + 1, y: +m[2], kind: "name" }; }
    return null;
  }
  function addMonths(dt, n) {
    var idx = dt.y * 12 + (dt.mo - 1) + n;
    return { d: dt.d, mo: (idx % 12) + 1, y: Math.floor(idx / 12), kind: dt.kind };
  }
  function fmtDate(dt) {
    if (dt.kind === "name") return MONTHS[dt.mo - 1] + " " + dt.y;
    var mm = ("0" + dt.mo).slice(-2);
    if (dt.kind === "dmy") return ("0" + dt.d).slice(-2) + "." + mm + "." + dt.y;
    return mm + "." + dt.y;
  }
  function annexDateField() {
    var sub = anexa2.querySelector(".annex-sub");
    if (!sub) return null;
    var fills = sub.querySelectorAll(".fill");
    return fills.length >= 2 ? fills[1] : null;   // NR. <număr> / <data>
  }
  var startOut = document.getElementById("a2-start");
  var endOut = document.getElementById("a2-end");

  function recompute() {
    if (lbl) {
      var v = variant();
      lbl.textContent = v === "retinere" ? "Sumă reținută din comision / lună"
        : v === "fara" ? "Sumă suportată de Beneficiar / lună"
        : "Sumă pe lună";
    }
    var bf = baseCell.querySelector(".fill");
    var mf = monthsCell.querySelector(".fill");
    var b = bf ? num(bf.textContent) : NaN;
    var m = mf ? num(mf.textContent) : NaN;
    if (isFinite(b) && isFinite(m) && m > 0) {
      out.textContent = Math.round(b / m).toLocaleString("ro-RO", { maximumFractionDigits: 0 });
    } else {
      out.textContent = "—";
    }
    // start = annex date; end = start + (N − 1) months (last month of amortization)
    if (startOut && endOut) {
      var adf = annexDateField();
      var raw = adf ? adf.textContent.trim() : "";
      var sd = parseDate(raw);
      startOut.textContent = raw || "—";
      if (sd && isFinite(m) && m >= 1) {
        endOut.textContent = fmtDate(addMonths(sd, Math.round(m) - 1));
      } else {
        endOut.textContent = "—";
      }
    }
  }
  [baseCell, monthsCell].forEach(function (c) {
    var f = c.querySelector(".fill");
    if (f) { f.addEventListener("input", recompute); f.addEventListener("blur", recompute); }
  });
  var adf0 = annexDateField();
  if (adf0) { adf0.addEventListener("input", recompute); adf0.addEventListener("blur", recompute); }
  Array.prototype.slice.call(anexa2.querySelectorAll('input[name="anexa2-mod"]')).forEach(function (r) {
    r.addEventListener("change", recompute);
  });
  recompute();
})();


/* ============================================================
   Date fields — validate format on input
   Accepts: ZZ.LL.AAAA, ZZ/LL/AAAA, LL.AAAA, „lună AAAA".
   Targets fields marked [data-fmt="date"] and auto-labelled "data".
   ============================================================ */
(function () {
  "use strict";
  var MONTHS_RO = ["ianuarie","februarie","martie","aprilie","mai","iunie","iulie","august","septembrie","octombrie","noiembrie","decembrie"];
  function validFormat(t) {
    if (t === "") return true;
    var m = t.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})$/);
    if (m) { var d = +m[1], mo = +m[2]; return d >= 1 && d <= 31 && mo >= 1 && mo <= 12; }
    m = t.match(/^(\d{1,2})[.\/\-](\d{4})$/);
    if (m) { var mo2 = +m[1]; return mo2 >= 1 && mo2 <= 12; }
    m = t.toLowerCase().match(/^([a-zăâîșț]+)\s+\d{4}$/);
    if (m) return MONTHS_RO.indexOf(m[1]) >= 0;
    return false;
  }
  var fields = Array.prototype.slice.call(
    document.querySelectorAll('[data-fmt="date"] .fill, .fill[data-label="data"]')
  );
  if (!fields.length) return;
  function validate(f) {
    var ok = validFormat(f.textContent.trim());
    f.classList.toggle("fill-invalid", !ok);
    f.setAttribute("title", ok ? "Format dată: ZZ.LL.AAAA (ex. 01.03.2025) sau LL.AAAA"
                                : "Format dată invalid — folosește ZZ.LL.AAAA (ex. 01.03.2025) sau LL.AAAA");
  }
  fields.forEach(function (f) {
    f.setAttribute("data-fmt", "date");
    f.setAttribute("inputmode", "numeric");
    validate(f);
    f.addEventListener("input", function () { validate(f); });
    f.addEventListener("blur", function () { validate(f); });
  });
})();
