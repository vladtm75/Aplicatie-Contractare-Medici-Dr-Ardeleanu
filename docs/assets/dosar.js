/* ============================================================
   Dosar medic — motor comun (checklist + upload local)
   Montat de două shell-uri: desktop (.act-top) și mobil (.m-top).
   Tot conținutul (bara de dosar, sumar, grupuri) e randat aici,
   în #dosar-root, ca shell-urile să rămână subțiri.

   Stocare:
   - localStorage „ardeleanu_dosare"          -> [{id,name,createdAt}]
   - localStorage „ardeleanu_dosar_current"   -> id-ul dosarului activ
   - localStorage „ardeleanu_dosar_state::ID" -> { items:{ itemId:{status,expiry} } }
   - IndexedDB     „ardeleanu_dosar" / store „files" -> blob-urile încărcate
   ============================================================ */
(function () {
  "use strict";
  var root = document.getElementById("dosar-root");
  if (!root) return;

  /* ---------- checklist config ---------- */
  var GROUPS = [
    { id: "identitate", title: "Identitate & drept de practică", items: [
      { id: "ci",        name: "Carte de identitate",                 desc: "Copie CI valabilă.", required: true },
      { id: "diploma",   name: "Diplomă de licență — medic dentist",  desc: "Diploma de absolvire a facultății de medicină dentară.", required: true },
      { id: "cmd",       name: "Certificat de membru CMD",            desc: "Colegiul Medicilor Dentiști din România.", required: true },
      { id: "aviz",      name: "Aviz anual de liberă practică",       desc: "Avizul CMD, valabil pe anul în curs.", required: true, expiry: true },
      { id: "malpraxis", name: "Asigurare malpraxis (RCP)",           desc: "Poliță de răspundere civilă profesională, în vigoare.", required: true, expiry: true },
      { id: "parafa",    name: "Parafă profesională",                 desc: "Dovada parafei (în formă fizică).", required: true },
      { id: "specialist",name: "Certificat de specialist / atestate", desc: "Dacă este cazul (ortodonție, chirurgie, implantologie etc.).", required: false }
    ]},
    { id: "profesional", title: "Profesional & medical", items: [
      { id: "cv",       name: "CV profesional",            desc: "Curriculum vitae actualizat.", required: false },
      { id: "emc",      name: "Diplome EMC / formare",     desc: "Educație medicală continuă, cursuri relevante.", required: false },
      { id: "medmunca", name: "Aviz medicina muncii",      desc: "Adeverință de aptitudine în muncă.", required: false, expiry: true },
      { id: "cazier",   name: "Cazier judiciar",           desc: "Dacă este solicitat de clinică.", required: false }
    ]},
    { id: "fiscal", title: "Firmă & date fiscale", items: [
      { id: "orc",  name: "Certificat de înmatriculare a Prestatorului (ORC)", desc: "Eliberat de ONRC — Oficiul Național al Registrului Comerțului.", required: true },
      { id: "cui",  name: "Certificat de înregistrare fiscală (CUI)", desc: "Codul unic de înregistrare — eliberat de ANAF.", required: true },
      { id: "iban", name: "Dovadă cont bancar (IBAN)",       desc: "Extras sau document cu IBAN-ul de încasare.", required: true }
    ]}
  ];
  var ALL_ITEMS = [];
  GROUPS.forEach(function (g) { g.items.forEach(function (it) { it.group = g.id; ALL_ITEMS.push(it); }); });

  var STATUS = { pregatit: "De pregătit", incarcat: "Încărcat", validat: "Validat" };

  /* ---------- dossier registry ---------- */
  var DK = "ardeleanu_dosare", CK = "ardeleanu_dosar_current";
  function loadDossiers() { try { return JSON.parse(localStorage.getItem(DK) || "[]"); } catch (e) { return []; } }
  function saveDossiers(list) { try { localStorage.setItem(DK, JSON.stringify(list)); } catch (e) {} }
  function slug(s) { return (s || "").toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "dosar"; }

  var dossiers = loadDossiers();
  var currentId = null;
  try { currentId = localStorage.getItem(CK); } catch (e) {}
  if (!dossiers.length) {
    var d0 = { id: slug("dosar") + "-" + Date.now().toString(36), name: "Dosar fără nume", createdAt: Date.now() };
    dossiers.push(d0); saveDossiers(dossiers); currentId = d0.id;
    try { localStorage.setItem(CK, currentId); } catch (e) {}
  }
  if (!currentId || !dossiers.some(function (d) { return d.id === currentId; })) {
    currentId = dossiers[0].id; try { localStorage.setItem(CK, currentId); } catch (e) {}
  }
  function currentDossier() { return dossiers.filter(function (d) { return d.id === currentId; })[0]; }

  /* ---------- per-dossier state ---------- */
  function stateKey(id) { return "ardeleanu_dosar_state::" + id; }
  function loadState() { try { return JSON.parse(localStorage.getItem(stateKey(currentId)) || "{}"); } catch (e) { return {}; } }
  function saveState(st) { try { localStorage.setItem(stateKey(currentId), JSON.stringify(st)); } catch (e) {} }
  function itemState(itemId) { var st = loadState(); return (st.items && st.items[itemId]) || {}; }
  function setItemState(itemId, patch) {
    var st = loadState(); st.items = st.items || {};
    st.items[itemId] = Object.assign({}, st.items[itemId], patch);
    saveState(st);
  }

  /* ---------- IndexedDB for files ---------- */
  var DB = null;
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (DB) return resolve(DB);
      var req = indexedDB.open("ardeleanu_dosar", 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("files")) {
          var os = db.createObjectStore("files", { keyPath: "key" });
          os.createIndex("byItem", ["dossierId", "itemId"], { unique: false });
        }
      };
      req.onsuccess = function () { DB = req.result; resolve(DB); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbAdd(rec) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(rec);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbDelete(key) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("files", "readwrite");
        tx.objectStore("files").delete(key);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbListForItem(itemId) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var out = [];
        var tx = db.transaction("files", "readonly");
        var idx = tx.objectStore("files").index("byItem");
        var range = IDBKeyRange.only([currentId, itemId]);
        idx.openCursor(range).onsuccess = function (e) {
          var cur = e.target.result;
          if (cur) { out.push(cur.value); cur.continue(); }
          else res(out.sort(function (a, b) { return a.addedAt - b.addedAt; }));
        };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  /* ---------- helpers ---------- */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function fmtSize(b) { if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(0) + " KB"; return (b / 1048576).toFixed(1) + " MB"; }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr + "T00:00:00"); if (isNaN(d)) return null;
    return Math.round((d - new Date(new Date().toDateString())) / 86400000);
  }
  function fmtDateRO(dateStr) {
    if (!dateStr) return "";
    var p = dateStr.split("-"); if (p.length !== 3) return dateStr;
    return p[2] + "." + p[1] + "." + p[0];
  }
  var ICON = {
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'
  };
  var toastEl = null;
  function toast(msg) {
    if (!toastEl) { toastEl = el("div"); toastEl.id = "toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  /* ---------- render ---------- */
  function render() {
    root.innerHTML = "";

    /* dossier bar */
    var bar = el("div", "dossier-bar");
    bar.appendChild(el("span", "lbl", "Dosar activ"));
    var sel = el("select"); sel.id = "dossier-select";
    dossiers.forEach(function (d) {
      var o = el("option"); o.value = d.id; o.textContent = d.name; if (d.id === currentId) o.selected = true; sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      currentId = sel.value; try { localStorage.setItem(CK, currentId); } catch (e) {} render();
    });
    bar.appendChild(sel);

    var renameBtn = el("button", "btn", "Redenumește");
    renameBtn.addEventListener("click", function () {
      var d = currentDossier(); var name = prompt("Numele dosarului (ex. „Dr. Popescu Ion”):", d.name);
      if (name && name.trim()) { d.name = name.trim(); saveDossiers(dossiers); render(); toast("Dosar redenumit."); }
    });
    bar.appendChild(renameBtn);

    var newBtn = el("button", "btn", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Dosar nou');
    newBtn.addEventListener("click", function () {
      var name = prompt("Numele noului dosar (ex. „Dr. Popescu Ion”):", "");
      if (!name || !name.trim()) return;
      var d = { id: slug(name) + "-" + Date.now().toString(36), name: name.trim(), createdAt: Date.now() };
      dossiers.push(d); saveDossiers(dossiers); currentId = d.id;
      try { localStorage.setItem(CK, currentId); } catch (e) {} render(); toast("Dosar nou creat.");
    });
    bar.appendChild(newBtn);

    bar.appendChild(el("span", "spacer"));
    if (dossiers.length > 1) {
      var delBtn = el("button", "btn", "Șterge dosarul");
      delBtn.addEventListener("click", function () {
        if (!confirm("Ștergi dosarul „" + currentDossier().name + "“? Documentele încărcate în el se pierd.")) return;
        ALL_ITEMS.forEach(function (it) { idbListForItem(it.id).then(function (fs) { fs.forEach(function (f) { idbDelete(f.key); }); }); });
        try { localStorage.removeItem(stateKey(currentId)); } catch (e) {}
        dossiers = dossiers.filter(function (d) { return d.id !== currentId; });
        saveDossiers(dossiers); currentId = dossiers[0].id;
        try { localStorage.setItem(CK, currentId); } catch (e) {} render(); toast("Dosar șters.");
      });
      bar.appendChild(delBtn);
    }
    root.appendChild(bar);

    /* summary */
    var summary = el("div", "summary"); summary.id = "summary"; root.appendChild(summary);

    /* cloud actions */
    var cloud = el("div", "cloud-row");
    var zipBtn = el("button", "cloud-btn primary", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Trimite documentele');
    zipBtn.title = "Trimite documentele încărcate (arhivă) — pe telefon prin WhatsApp către clinică.";
    zipBtn.addEventListener("click", sendDocs);
    cloud.appendChild(zipBtn);

    var printBtn = el("button", "cloud-btn", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Tipărește fișa');
    printBtn.addEventListener("click", function () { window.print(); });
    cloud.appendChild(printBtn);
    root.appendChild(cloud);

    /* groups */
    GROUPS.forEach(function (g) {
      var gEl = el("div", "group");
      gEl.appendChild(el("h2", null, g.title));
      g.items.forEach(function (it) { gEl.appendChild(renderItem(it)); });
      root.appendChild(gEl);
    });

    root.appendChild(el("p", "disclaimer", "Documentele se păstrează în acest browser, pe acest dispozitiv (privat). După încărcare, apasă „Trimite documentele” pentru a le trimite clinicii (pe telefon, prin WhatsApp)."));

    updateSummary();
  }

  function renderItem(it) {
    var st = itemState(it.id);
    var wrap = el("div", "item"); wrap.setAttribute("data-item", it.id);

    var main = el("div", "item-main");
    var info = el("div", "item-info");
    var name = el("div", "item-name");
    name.appendChild(document.createTextNode(it.name));
    name.appendChild(el("span", "tag " + (it.required ? "req" : "opt"), it.required ? "Obligatoriu" : "Opțional"));
    info.appendChild(name);
    info.appendChild(el("div", "item-desc", it.desc));
    main.appendChild(info);

    var statusSel = el("select", "status");
    Object.keys(STATUS).forEach(function (k) {
      var o = el("option"); o.value = k; o.textContent = STATUS[k]; statusSel.appendChild(o);
    });
    statusSel.value = st.status || "pregatit";
    statusSel.setAttribute("data-state", statusSel.value);
    statusSel.addEventListener("change", function () {
      setItemState(it.id, { status: statusSel.value });
      statusSel.setAttribute("data-state", statusSel.value);
      reflectItem(it.id); updateSummary();
    });
    main.appendChild(statusSel);
    wrap.appendChild(main);

    /* expiry */
    if (it.expiry) {
      var exp = el("div", "expiry");
      exp.appendChild(el("label", null, "Expiră la:"));
      var inp = el("input"); inp.type = "date"; inp.value = st.expiry || "";
      inp.addEventListener("change", function () { setItemState(it.id, { expiry: inp.value }); reflectItem(it.id); updateSummary(); });
      exp.appendChild(inp);
      exp.appendChild(el("span", "exp-chip")); // filled by reflectItem
      wrap.appendChild(exp);
    }

    /* files */
    var files = el("div", "files");
    var dzRow = el("div", "dz-row");
    var dz = el("div", "dropzone", ICON.upload + "<span class='dz-txt'><b>Adaugă document</b><span class='dz-sub'>Atinge pentru a alege · PDF, JPG, PNG</span></span>");
    var fi = el("input"); fi.type = "file"; fi.multiple = true; fi.accept = ".pdf,.jpg,.jpeg,.png,.webp,.heic"; fi.style.display = "none";
    dz.addEventListener("click", function () { fi.click(); });
    fi.addEventListener("change", function () { handleFiles(it, fi.files); fi.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("drag"); }); });
    dz.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files) handleFiles(it, e.dataTransfer.files); });
    // camera — pe aceeași linie, în dreapta; vizibil doar pe dispozitive cu touch (CSS)
    var cam = el("button", "dz-cam", ICON.cam + "<span>Fă o poză</span>");
    var ci = el("input"); ci.type = "file"; ci.accept = "image/*"; ci.setAttribute("capture", "environment"); ci.style.display = "none";
    cam.addEventListener("click", function () { ci.click(); });
    ci.addEventListener("change", function () { handleFiles(it, ci.files); ci.value = ""; });
    dzRow.appendChild(dz); dzRow.appendChild(cam);
    files.appendChild(dzRow);
    files.appendChild(fi); files.appendChild(ci);
    var list = el("ul", "filelist"); list.setAttribute("data-files", it.id); files.appendChild(list);
    wrap.appendChild(files);

    reflectItem(it.id, wrap);
    refreshFileList(it.id, list);
    return wrap;
  }

  function handleFiles(it, fileList) {
    var arr = Array.prototype.slice.call(fileList || []);
    if (!arr.length) return;
    var chain = Promise.resolve();
    arr.forEach(function (f) {
      chain = chain.then(function () {
        var rec = { key: currentId + "::" + it.id + "::" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
          dossierId: currentId, itemId: it.id, name: f.name, type: f.type, size: f.size, blob: f, addedAt: Date.now() };
        return idbAdd(rec);
      });
    });
    chain.then(function () {
      var cur = itemState(it.id);
      if (!cur.status || cur.status === "pregatit") { setItemState(it.id, { status: "incarcat" }); }
      var wrap = root.querySelector('.item[data-item="' + it.id + '"]');
      if (wrap) { var ss = wrap.querySelector(".status"); if (ss) { ss.value = itemState(it.id).status; ss.setAttribute("data-state", ss.value); } }
      refreshFileList(it.id); reflectItem(it.id); updateSummary();
      toast(arr.length > 1 ? arr.length + " fișiere încărcate." : "Fișier încărcat.");
    }).catch(function () { toast("Eroare la încărcare."); });
  }

  function refreshFileList(itemId, listEl) {
    listEl = listEl || root.querySelector('.filelist[data-files="' + itemId + '"]');
    if (!listEl) return;
    idbListForItem(itemId).then(function (recs) {
      listEl.innerHTML = "";
      recs.forEach(function (r) {
        var li = el("li");
        li.appendChild(el("span", "fico", ICON.file));
        var meta = el("div", "fmeta");
        meta.appendChild(el("div", "fname", r.name));
        meta.appendChild(el("div", "fsize", fmtSize(r.size)));
        li.appendChild(meta);
        var act = el("div", "fact");
        var openB = el("button", null, ICON.open); openB.title = "Deschide";
        openB.addEventListener("click", function () { var u = URL.createObjectURL(r.blob); window.open(u, "_blank"); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); });
        var delB = el("button", "del", ICON.del); delB.title = "Șterge";
        delB.addEventListener("click", function () {
          if (!confirm("Ștergi „" + r.name + "“?")) return;
          idbDelete(r.key).then(function () { refreshFileList(itemId); reflectItem(itemId); updateSummary(); toast("Fișier șters."); });
        });
        act.appendChild(openB); act.appendChild(delB);
        li.appendChild(act);
        listEl.appendChild(li);
      });
    });
  }

  function reflectItem(itemId, wrap) {
    wrap = wrap || root.querySelector('.item[data-item="' + itemId + '"]');
    if (!wrap) return;
    var st = itemState(itemId);
    var it = ALL_ITEMS.filter(function (x) { return x.id === itemId; })[0];
    // expiry chip
    var chip = wrap.querySelector(".exp-chip");
    if (chip && it && it.expiry) {
      var dleft = daysUntil(st.expiry);
      chip.className = "chip exp-chip";
      if (dleft == null) { chip.textContent = ""; }
      else if (dleft < 0) { chip.classList.add("expired"); chip.textContent = "Expirat (" + fmtDateRO(st.expiry) + ")"; }
      else if (dleft <= 60) { chip.classList.add("soon"); chip.textContent = "Expiră în " + dleft + " zile"; }
      else { chip.classList.add("valid"); chip.textContent = "Valabil până la " + fmtDateRO(st.expiry); }
    }
    idbListForItem(itemId).then(function (recs) {
      wrap.classList.toggle("has-files", recs.length > 0 && st.status !== "validat");
      wrap.classList.toggle("is-validated", st.status === "validat");
    });
  }

  function updateSummary() {
    var box = document.getElementById("summary"); if (!box) return;
    var reqItems = ALL_ITEMS.filter(function (it) { return it.required; });
    var st = loadState();
    var items = st.items || {};
    var reqDone = reqItems.filter(function (it) { var s = items[it.id]; return s && (s.status === "incarcat" || s.status === "validat"); }).length;
    var validated = ALL_ITEMS.filter(function (it) { var s = items[it.id]; return s && s.status === "validat"; }).length;
    // expiry alerts
    var alerts = 0;
    ALL_ITEMS.forEach(function (it) { if (!it.expiry) return; var s = items[it.id]; if (!s || !s.expiry) return; var d = daysUntil(s.expiry); if (d != null && d <= 60) alerts++; });
    var pct = reqItems.length ? Math.round(reqDone / reqItems.length * 100) : 0;

    box.innerHTML = "";
    var c1 = el("div", "stat");
    c1.innerHTML = '<div class="num">' + reqDone + "/" + reqItems.length + '</div><div class="cap">documente obligatorii încărcate</div><div class="bar"><i style="width:' + pct + '%"></i></div>';
    box.appendChild(c1);
    var c2 = el("div", "stat");
    c2.innerHTML = '<div class="num">' + validated + '</div><div class="cap">documente validate de clinică</div>';
    box.appendChild(c2);
    var c3 = el("div", "stat" + (alerts ? " alert" : ""));
    c3.innerHTML = '<div class="num">' + alerts + '</div><div class="cap">documente care expiră curând</div>';
    box.appendChild(c3);
  }

  // ---- export ZIP (documente + fișă) pentru încărcare manuală în Drive ----
  function buildSummary(d) {
    var st = loadState(), items = st.items || {};
    var lines = ["DOSAR MEDIC — " + (d.name || ""), "Rețeaua de Clinici Dr. Ardeleanu", "Generat: " + new Date().toLocaleString("ro-RO"), ""];
    GROUPS.forEach(function (g) {
      lines.push("== " + g.title + " ==");
      g.items.forEach(function (it) {
        var s = items[it.id] || {};
        var line = "- " + it.name + ": " + (STATUS[s.status || "pregatit"]) + (it.required ? " [obligatoriu]" : "");
        if (it.expiry && s.expiry) line += " · expiră " + fmtDateRO(s.expiry);
        lines.push(line);
      });
      lines.push("");
    });
    return lines.join("\r\n");
  }
  function sendDocs() {
    if (!window.makeZip) { toast("Utilitarul nu e disponibil."); return; }
    var d = currentDossier();
    toast("Se pregătește pachetul…");
    var files = [], chain = Promise.resolve();
    ALL_ITEMS.forEach(function (it) {
      chain = chain.then(function () {
        return idbListForItem(it.id).then(function (recs) {
          recs.forEach(function (r) {
            var safe = (it.name + " - " + r.name).replace(/[\/\\:*?\"<>|]+/g, "-");
            files.push({ name: safe, blob: r.blob });
          });
        });
      });
    });
    chain.then(function () {
      files.unshift({ name: "00 - Fisa dosar.txt", blob: new Blob([buildSummary(d)], { type: "text/plain" }) });
      return makeZip(files);
    }).then(function (zipBlob) {
      var base = "Dosar - " + (d.name || "medic").replace(/[\/\\:*?\"<>|]+/g, "-");
      var file = new File([zipBlob], base + ".zip", { type: "application/zip" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Dosar medic — " + (d.name || ""), text: "Documentele pentru dosarul medical — Dr. Ardeleanu" })
          .then(function () { toast("Trimis."); }).catch(function () {});
      } else {
        var url = URL.createObjectURL(zipBlob);
        var a = document.createElement("a");
        a.href = url; a.download = base + ".zip";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        toast("Pachet descărcat (trimite-l clinicii).");
      }
    }).catch(function () { toast("Eroare la pregătirea pachetului."); });
  }

  // ---- bridge pentru Panoul de administrator / Google Drive ----
  window.DosarBridge = {
    getDossier: function () { var d = currentDossier(); return { id: currentId, name: d ? d.name : "" }; },
    listFiles: function () {
      var out = [], chain = Promise.resolve();
      ALL_ITEMS.forEach(function (it) {
        chain = chain.then(function () {
          return idbListForItem(it.id).then(function (recs) {
            recs.forEach(function (r) { out.push({ itemId: it.id, itemName: it.name, name: r.name, type: r.type, blob: r.blob }); });
          });
        });
      });
      return chain.then(function () { return out; });
    }
  };

  render();
})();
