/* ============================================================
   Dr. Ardeleanu — Contract — MOBILE behaviour
   TOC + scrollspy + drawer + search + reading progress +
   thumb FAB + read-only labelled blanks.
   Contract text stays 1:1 (only underscore placeholders are
   re-rendered as read-only labelled blanks, same rule as desktop).
   ============================================================ */
(function () {
  "use strict";

  var article = document.querySelector(".article");
  var tocList = document.getElementById("toc-list");
  if (!article) return;

  /* ============================================================
     1. Read-only labelled blanks (verbatim-safe placeholder render)
     ============================================================ */
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
  (function renderBlanks() {
    var RE = /(_{3,}|\.{4,}|…{2,}\.?)/;
    var REg = /(_{3,}|\.{4,}|…{2,}\.?)/g;
    var walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !RE.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        while (p && p !== article) {
          if (/^(SCRIPT|STYLE|A)$/.test(p.nodeName)) return NodeFilter.FILTER_REJECT;
          if (p.classList && (p.classList.contains("fill-ro") || p.classList.contains("xref"))) return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var text = node.nodeValue;
      var parts = text.split(REg);
      var frag = document.createDocumentFragment();
      var cursor = 0;
      for (var i = 0; i < parts.length; i++) {
        var piece = parts[i];
        if (i % 2 === 1) {
          var before = text.slice(0, cursor);
          var after = text.slice(cursor + piece.length);
          var span = document.createElement("span");
          span.className = "fill-ro";
          span.setAttribute("data-label", labelFor(before, after));
          frag.appendChild(span);
        } else if (piece) {
          frag.appendChild(document.createTextNode(piece));
        }
        cursor += piece.length;
      }
      node.parentNode.replaceChild(frag, node);
    });
  })();

  /* ============================================================
     2. Tables → wrap wide ones in a horizontal scroll container
     ============================================================ */
  Array.prototype.slice.call(article.querySelectorAll("table.grila, table.clinic-table")).forEach(function (t) {
    if (t.parentElement && t.parentElement.classList.contains("m-table-scroll")) return;
    var wrap = document.createElement("div");
    wrap.className = "m-table-scroll";
    t.parentNode.insertBefore(wrap, t);
    wrap.appendChild(t);
  });

  /* ============================================================
     3. Build Contents (chapters h2 + subheads h3)
     ============================================================ */
  var chapters = Array.prototype.slice.call(article.querySelectorAll(".chapter"));
  var links = [];

  if (tocList) {
    chapters.forEach(function (ch) {
      var h2 = ch.querySelector("h2");
      if (!h2 || !ch.id) return;
      var cnumEl = h2.querySelector(".cnum");
      var titleEl = h2.querySelector(".ctitle");
      var label = titleEl ? titleEl.textContent.trim() : h2.textContent.trim();
      var num = cnumEl ? cnumEl.getAttribute("data-toc") || cnumEl.textContent.trim() : "";

      var li = document.createElement("li");
      li.className = "lvl-top";
      var a = document.createElement("a");
      a.href = "#" + ch.id;
      a.innerHTML = (num ? '<span class="num">' + num + "</span>" : "") + label;
      a.setAttribute("data-target", ch.id);
      li.appendChild(a);
      links.push(a);

      var subs = ch.querySelectorAll("h3.sub-h[id]");
      if (subs.length) {
        li.classList.add("has-sub", "collapsed");
        var caret = document.createElement("button");
        caret.className = "toc-caret";
        caret.type = "button";
        caret.setAttribute("aria-label", "Extinde subcapitolele");
        caret.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          li.classList.toggle("collapsed");
        });
        li.insertBefore(caret, li.firstChild);
        var subOl = document.createElement("ol");
        subOl.className = "sub";
        Array.prototype.slice.call(subs).forEach(function (s) {
          var sli = document.createElement("li");
          var sa = document.createElement("a");
          sa.href = "#" + s.id;
          sa.textContent = s.textContent.trim();
          sa.setAttribute("data-target", s.id);
          sli.appendChild(sa);
          subOl.appendChild(sli);
          links.push(sa);
        });
        li.appendChild(subOl);
      }
      tocList.appendChild(li);
    });
  }

  /* ============================================================
     4. Scrollspy
     ============================================================ */
  var targets = links
    .map(function (a) { return document.getElementById(a.getAttribute("data-target")); })
    .filter(Boolean);

  function setActive(id) {
    links.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-target") === id);
    });
  }
  if (targets.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      var visible = entries
        .filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      if (visible.length) setActive(visible[0].target.id);
    }, { rootMargin: "-66px 0px -70% 0px", threshold: 0 });
    targets.forEach(function (t) { spy.observe(t); });
    setActive(targets[0].id);
  }

  /* ============================================================
     5. Drawer (Cuprins) + scrim
     ============================================================ */
  var body = document.body;
  function openNav() { body.classList.add("m-nav-open"); body.classList.remove("m-search-open"); }
  function closeNav() { body.classList.remove("m-nav-open"); }

  var menuBtn = document.getElementById("m-menu");
  var drawerClose = document.getElementById("m-drawer-close");
  var scrim = document.getElementById("m-scrim");
  if (menuBtn) menuBtn.addEventListener("click", openNav);
  if (drawerClose) drawerClose.addEventListener("click", closeNav);
  if (scrim) scrim.addEventListener("click", closeNav);

  if (tocList) {
    tocList.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      closeNav();
    });
  }

  /* ============================================================
     6. Smooth anchor scroll (xref + toc), close overlays
     ============================================================ */
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    closeNav();
    body.classList.remove("m-search-open");
    var top = el.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: top, behavior: "smooth" });
    if (history.replaceState) history.replaceState(null, "", "#" + id);
  });

  /* ============================================================
     7. Search (toggle row + filter/highlight)
     ============================================================ */
  var searchBtn = document.getElementById("m-search");
  var search = document.getElementById("search");

  if (searchBtn) {
    searchBtn.addEventListener("click", function () {
      var open = body.classList.toggle("m-search-open");
      if (open) { closeNav(); setTimeout(function () { search && search.focus(); }, 180); }
      else if (search) { search.value = ""; runSearch(""); search.blur(); }
    });
  }

  var blocks = chapters;
  var noResult = null;

  function clearMarks(root) {
    var marks = root.querySelectorAll("mark.hit");
    marks.forEach(function (m) {
      var t = document.createTextNode(m.textContent);
      m.parentNode.replaceChild(t, m);
    });
  }
  function highlight(el, term) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentNode && /^(SCRIPT|STYLE|MARK)$/.test(n.parentNode.nodeName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    var re = new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    nodes.forEach(function (node) {
      if (!re.test(node.nodeValue)) return;
      re.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      while ((m = re.exec(node.nodeValue))) {
        if (m.index > last) frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
        var mk = document.createElement("mark");
        mk.className = "hit";
        mk.textContent = m[0];
        frag.appendChild(mk);
        last = m.index + m[0].length;
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      if (last < node.nodeValue.length) frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  function runSearch(term) {
    term = (term || "").trim();
    blocks.forEach(function (b) { clearMarks(b); b.style.display = ""; });
    if (noResult) { noResult.remove(); noResult = null; }
    if (term.length < 2) return;
    var lower = term.toLowerCase();
    var any = false;
    blocks.forEach(function (b) {
      var hit = b.textContent.toLowerCase().indexOf(lower) !== -1;
      if (hit) { any = true; highlight(b, term); }
      else { b.style.display = "none"; }
    });
    if (!any) {
      noResult = document.createElement("p");
      noResult.className = "no-result";
      noResult.textContent = 'Niciun rezultat pentru „' + term + '".';
      article.appendChild(noResult);
    }
  }
  if (search) {
    var t;
    search.addEventListener("input", function () {
      clearTimeout(t);
      var v = search.value;
      t = setTimeout(function () { runSearch(v); }, 160);
    });
    search.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { search.value = ""; runSearch(""); search.blur(); body.classList.remove("m-search-open"); }
    });
  }

  /* ============================================================
     8. Reading progress bar + FAB visibility
     ============================================================ */
  var bar = document.createElement("div");
  bar.id = "readbar";
  body.appendChild(bar);

  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var pct = h > 0 ? (window.scrollY / h) * 100 : 0;
    bar.style.width = pct + "%";
    body.classList.toggle("m-scrolled", window.scrollY > 520);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

  /* ============================================================
     9. FAB actions
     ============================================================ */
  var fabTop = document.getElementById("m-fab-top");
  var fabToc = document.getElementById("m-fab-toc");
  if (fabTop) fabTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  if (fabToc) fabToc.addEventListener("click", openNav);

  /* close drawer/search on Escape */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeNav(); body.classList.remove("m-search-open"); }
  });

  /* ============================================================
     10. Anexa 1 — apply remuneration-type selection (read-only)
     Mirrors the desktop selector: hide unselected sections +
     their Contents entries, based on the same saved choice.
     ============================================================ */
  (function () {
    var anexa = document.getElementById("anexa-1");
    if (!anexa) return;
    var sections = Array.prototype.slice.call(anexa.querySelectorAll(".remun-section"));
    if (!sections.length) return;
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem("ardeleanu_remun_sel_v1") || "null"); } catch (e) {}
    var active = new Set(Array.isArray(saved) ? saved : ["a", "b", "c", "d"]);

    // capture base titles (without the letter)
    sections.forEach(function (sec) {
      var h3 = sec.querySelector("h3.sub-h");
      var span = h3 ? h3.querySelector(".sec-letter") : null;
      if (!h3 || !span) return;
      var base = "";
      Array.prototype.slice.call(h3.childNodes).forEach(function (n) { if (n !== span) base += n.textContent; });
      sec.setAttribute("data-sectitle", base.trim());
    });

    var letters = "ABCDEFGH", idx = 0;
    sections.forEach(function (sec) {
      var type = sec.getAttribute("data-remun");
      var on = active.has(type);
      sec.classList.toggle("remun-off", !on);
      var h3 = sec.querySelector("h3.sub-h");
      var span = h3 ? h3.querySelector(".sec-letter") : null;
      var base = sec.getAttribute("data-sectitle") || "";
      var link = document.querySelector('#toc-list a[data-target="anexa-1-' + type + '"]');
      var li = link ? link.closest("li") : null;
      if (on) {
        var L = letters[idx] || ""; idx++;
        if (span) span.textContent = L + ". ";
        if (link) link.textContent = L + ". " + base;
        if (li) li.style.display = "";
      } else {
        if (span) span.textContent = "";
        if (li) li.style.display = "none";
      }
    });
  })();

  /* ============================================================
     11. Anexa 1.A — restore + persist role choice (de bază / secundară)
     ============================================================ */
  (function () {
    var radios = Array.prototype.slice.call(document.querySelectorAll("input.rol-pick, input.var-pick"));
    if (!radios.length) return;
    var KEY = "ardeleanu_rol_sel_v1";
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

  /* Anexa 2 — monthly label reflects the chosen variant (read-only on mobile) */
  (function () {
    var anexa2 = document.getElementById("anexa-2");
    if (!anexa2) return;
    var lbl = document.getElementById("a2-monthly-label");
    if (!lbl) return;
    function setLabel() {
      var r = anexa2.querySelector('input[name="anexa2-mod"]:checked');
      var v = r ? r.value : null;
      lbl.textContent = v === "retinere" ? "Sumă reținută din comision / lună"
        : v === "fara" ? "Sumă suportată de Beneficiar / lună"
        : "Sumă pe lună";
    }
    Array.prototype.slice.call(anexa2.querySelectorAll('input[name="anexa2-mod"]')).forEach(function (r) {
      r.addEventListener("change", setLabel);
    });
    setLabel();
  })();
})();
