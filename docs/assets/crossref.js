/* ============================================================
   Cross-reference links — turns "Capitolul XIV", "Anexa 1" etc.
   into clickable jumps. Runtime only; the source text stays 1:1.
   ============================================================ */
(function () {
  "use strict";
  var article = document.querySelector(".article");
  if (!article) return;

  // inject styles
  var st = document.createElement("style");
  st.textContent =
    ".xref{color:#7B1C16;text-decoration:none;border-bottom:1px dotted #9a3b34;cursor:pointer;transition:background .12s,border-color .12s;}" +
    ".xref:hover{background:#f6ece9;border-bottom-color:#7B1C16;}" +
    ".xref:focus{outline:2px solid #9a3b34;outline-offset:2px;border-radius:2px;}" +
    "li[id]{scroll-margin-top:90px;}" +
    "@media print{.xref{color:inherit;border-bottom:none;}}";
  document.head.appendChild(st);

  var ROMAN = ["XVIII","XVII","XIII","VIII","XVI","XIV","XII","VII","III","XV","XI","IX","VI","IV","II","X","V","I"];
  var map = { I:"cap-1",II:"cap-2",III:"cap-3",IV:"cap-4",V:"cap-5",VI:"cap-6",VII:"cap-7",
    VIII:"cap-8",IX:"cap-9",X:"cap-10",XI:"cap-11",XII:"cap-12",XIII:"cap-13",XIV:"cap-14",
    XV:"cap-15",XVI:"cap-16",XVII:"cap-17",XVIII:"cap-18" };

  // explicit article references → resolved targets (confirmed mapping)
  // group 5: art. 100  → Cap. XIII, clauza 5 ;  group 6: art. 1 → Cap. II
  var reSrc = "(Capitolele|Capitolul|Capitolului|Cap\\.)\\s+(" + ROMAN.join("|") + ")\\b" +
              "|(Anex(?:a|ei|ele))\\s+(\\d+)" +
              "|(art\\.\\s*100)\\b" +
              "|(art\\.\\s*1)\\b" +
              "|(art\\s*\\.\\s*_{2,})";
  var RE = new RegExp(reSrc);
  var REg = new RegExp(reSrc, "g");

  function targetFor(m, sectionId) {
    if (m[2]) {
      // sursa trimite greșit la "Capitolul XIV"; denunțarea/încetarea este în Cap. XVI
      if (m[2] === "XIV" && sectionId === "cap-3") return "cap-16";
      return map[m[2]] || null;                 // chapter
    }
    if (m[4]) return "anexa-" + m[4];             // annex
    if (m[5]) return "cap-13-5";                 // art. 100 → Cap. XIII, clauza 5
    if (m[6]) return "cap-2";                    // art.1 → Cap. II (Obiectul)
    if (m[7]) return "cap-11-2";                 // art . ___ → Cap. XI, clauza 2
    return null;
  }

  // collect candidate text nodes (skip headings, fields, existing links, toc)
  var walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      if (!n.nodeValue || !RE.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      var p = n.parentNode;
      while (p && p !== article) {
        var nm = p.nodeName, cl = p.classList;
        if (nm === "H2" || nm === "H3" || nm === "A") return NodeFilter.FILTER_REJECT;
        if (cl && (cl.contains("fill") || cl.contains("cnum") || cl.contains("ctitle") || cl.contains("xref"))) return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [], n;
  while ((n = walker.nextNode())) nodes.push(n);

  nodes.forEach(function (node) {
    var sec = node.parentNode, sectionId = "";
    while (sec && sec !== article) {
      if (sec.classList && sec.classList.contains("chapter")) { sectionId = sec.id; break; }
      sec = sec.parentNode;
    }
    var text = node.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
    REg.lastIndex = 0;
    while ((m = REg.exec(text))) {
      var id = targetFor(m, sectionId);
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (id && document.getElementById(id)) {
        var a = document.createElement("a");
        a.className = "xref";
        a.href = "#" + id;
        a.textContent = m[0];
        frag.appendChild(a);
      } else {
        frag.appendChild(document.createTextNode(m[0]));
      }
      last = m.index + m[0].length;
      if (m.index === REg.lastIndex) REg.lastIndex++;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
})();
