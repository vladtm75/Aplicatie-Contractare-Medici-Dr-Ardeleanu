/* ============================================================
   Wiki document behaviour: TOC build, scrollspy, search, mobile nav
   ============================================================ */
(function () {
  "use strict";

  var article = document.querySelector(".article");
  var tocList = document.getElementById("toc-list");
  if (!article || !tocList) return;

  /* ---- Build Contents from chapters (h2) + subheads (h3) ---- */
  var chapters = Array.prototype.slice.call(article.querySelectorAll(".chapter"));
  var links = [];

  chapters.forEach(function (ch, i) {
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

    // sub headings
    var subs = ch.querySelectorAll("h3.sub-h[id]");
    if (subs.length) {
      li.classList.add("has-sub");
      var caret = document.createElement("button");
      caret.className = "toc-caret";
      caret.type = "button";
      caret.setAttribute("aria-label", "Extinde sau restrânge subcapitolele");
      caret.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        li.classList.toggle("collapsed");
      });
      li.insertBefore(caret, li.firstChild);
      var subOl = document.createElement("ol");
      subOl.className = "sub";
      subs.forEach(function (s) {
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

  /* ---- Scrollspy ---- */
  var targets = links
    .map(function (a) { return document.getElementById(a.getAttribute("data-target")); })
    .filter(Boolean);

  function setActive(id) {
    links.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-target") === id);
    });
  }

  var spy = new IntersectionObserver(
    function (entries) {
      // pick the entry nearest the top that is intersecting
      var visible = entries
        .filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      if (visible.length) {
        setActive(visible[0].target.id);
        // keep active link in view within sidebar
        var act = tocList.querySelector("a.active");
        if (act) {
          var r = act.getBoundingClientRect();
          var pr = tocList.getBoundingClientRect();
          if (r.top < pr.top + 40 || r.bottom > pr.bottom - 40) {
            act.scrollIntoView ? null : null; // avoid scrollIntoView; do manual
            tocList.parentElement.scrollTop += (r.top - pr.top) - pr.height / 2;
          }
        }
      }
    },
    { rootMargin: "-72px 0px -68% 0px", threshold: 0 }
  );
  targets.forEach(function (t) { spy.observe(t); });

  /* ---- Smooth click + close mobile nav ---- */
  tocList.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (!a) return;
    document.body.classList.remove("nav-open");
  });

  /* ---- Mobile nav toggle ---- */
  var toggle = document.getElementById("toc-toggle");
  var scrim = document.getElementById("scrim");
  if (toggle) {
    toggle.addEventListener("click", function () {
      document.body.classList.toggle("nav-open");
    });
  }
  if (scrim) {
    scrim.addEventListener("click", function () {
      document.body.classList.remove("nav-open");
    });
  }

  /* ---- Search / filter ---- */
  var search = document.getElementById("search");
  var blocks = chapters; // filter at chapter level
  var noResult = null;

  function clearMarks(root) {
    var marks = root.querySelectorAll("mark.hit");
    marks.forEach(function (m) {
      var t = document.createTextNode(m.textContent);
      m.parentNode.replaceChild(t, m);
    });
    // normalize adjacent text nodes
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
    term = term.trim();
    blocks.forEach(function (b) { clearMarks(b); b.classList.remove("dimmed"); b.style.display = ""; });
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
      noResult.textContent = 'Niciun rezultat pentru „' + term + '”.';
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
      if (e.key === "Escape") { search.value = ""; runSearch(""); search.blur(); }
    });
  }

  // set first active
  if (targets.length) setActive(targets[0].id);
})();
