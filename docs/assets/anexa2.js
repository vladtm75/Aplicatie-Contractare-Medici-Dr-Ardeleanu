/* ============================================================
   Anexa 2 — gestionar de instanțe (șablon repetabil)
   Fiecare „anexă de amortizare" = o instanță salvată separat
   (un curs). Bara de sus permite: comutare între anexe, anexă
   nouă, salvare, ștergere. Datele live (completate de fields.js
   în cheile namespace-uite „anexa2") sunt copia de lucru a
   instanței curente; la comutare le mutăm în/din magazinul ei.

   IMPORTANT: acest script se încarcă ÎNAINTE de fields.js, ca să
   pună în cheile live datele instanței curente înainte ca
   fields.js să citească și să populeze câmpurile.
   ============================================================ */
(function () {
  "use strict";
  // Mobile pages are read-only/informative: keep loading the current annex's
  // data (so the document shows content) but hide the management bar.
  var IS_MOBILE = !!document.querySelector("header.m-top");
  var KEY_FILL = "ardeleanu_anexa2_fill_v1";
  var KEY_ROL  = "ardeleanu_anexa2_rol_sel_v1";
  var LIST     = "ardeleanu_anexa2_instances";
  var CURRENT  = "ardeleanu_anexa2_current";
  function dataKey(id) { return "ardeleanu_anexa2_data::" + id; }

  function jget(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function rm(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var instances = jget(LIST, []);
  var currentId = null; try { currentId = localStorage.getItem(CURRENT); } catch (e) {}

  if (!instances.length) {
    var id0 = "a2-" + Date.now().toString(36);
    instances = [{ id: id0, name: "Anexă fără curs", savedAt: null }];
    jset(LIST, instances); currentId = id0; try { localStorage.setItem(CURRENT, id0); } catch (e) {}
  }
  if (!currentId || !instances.some(function (x) { return x.id === currentId; })) {
    currentId = instances[0].id; try { localStorage.setItem(CURRENT, currentId); } catch (e) {}
  }

  // 1) load current instance's data into the live keys (BEFORE fields.js)
  function liveLoad(id) {
    var data = jget(dataKey(id), null);
    if (data && data.fill) jset(KEY_FILL, data.fill); else rm(KEY_FILL);
    if (data && data.rol)  jset(KEY_ROL, data.rol);   else rm(KEY_ROL);
  }
  // 2) snapshot live keys into an instance's store
  function liveSave(id) {
    jset(dataKey(id), { fill: jget(KEY_FILL, {}), rol: jget(KEY_ROL, {}) });
  }

  liveLoad(currentId);

  // try to derive a friendly name from the course-name field, if filled
  function instanceName(inst) { return inst.name || "Anexă fără curs"; }

  // ---- build the bar once DOM is ready ----
  function build() {
    var mount = document.getElementById("anexa2-bar");
    if (!mount) return;
    if (IS_MOBILE) { mount.style.display = "none"; return; }
    mount.innerHTML = "";

    var lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = "Anexă de amortizare"; mount.appendChild(lbl);

    var sel = document.createElement("select"); sel.className = "a2-select";
    instances.forEach(function (inst) {
      var o = document.createElement("option"); o.value = inst.id;
      o.textContent = instanceName(inst) + (inst.savedAt ? "" : " · neîncepută");
      if (inst.id === currentId) o.selected = true; sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      liveSave(currentId);
      currentId = sel.value; try { localStorage.setItem(CURRENT, currentId); } catch (e) {}
      location.reload();
    });
    mount.appendChild(sel);

    function btn(txt, cls) { var b = document.createElement("button"); b.className = "a2-btn" + (cls ? " " + cls : ""); b.innerHTML = txt; return b; }

    var saveBtn = btn('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Salvează', "primary");
    saveBtn.addEventListener("click", function () {
      var cn = courseName();
      var inst = instances.filter(function (x) { return x.id === currentId; })[0];
      if (inst) { inst.name = cn || inst.name; inst.savedAt = Date.now(); jset(LIST, instances); }
      liveSave(currentId);
      toast("Anexă salvată" + (cn ? ": " + cn : "") + ".");
      build();
    });
    mount.appendChild(saveBtn);

    var newBtn = btn('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Anexă nouă');
    newBtn.addEventListener("click", function () {
      liveSave(currentId);
      var id = "a2-" + Date.now().toString(36);
      instances.push({ id: id, name: "Anexă fără curs", savedAt: null });
      jset(LIST, instances); currentId = id; try { localStorage.setItem(CURRENT, id); } catch (e) {}
      rm(KEY_FILL); rm(KEY_ROL);
      location.reload();
    });
    mount.appendChild(newBtn);

    var spacer = document.createElement("span"); spacer.className = "a2-spacer"; mount.appendChild(spacer);

    if (instances.length > 1) {
      var delBtn = btn("Șterge anexa");
      delBtn.addEventListener("click", function () {
        var inst = instances.filter(function (x) { return x.id === currentId; })[0];
        if (!confirm("Ștergi „" + instanceName(inst) + "“? Datele completate în ea se pierd.")) return;
        rm(dataKey(currentId));
        instances = instances.filter(function (x) { return x.id !== currentId; });
        jset(LIST, instances); currentId = instances[0].id;
        try { localStorage.setItem(CURRENT, currentId); } catch (e) {}
        rm(KEY_FILL); rm(KEY_ROL);
        location.reload();
      });
      mount.appendChild(delBtn);
    }
  }

  // read the course-name field value (row „Denumirea cursului")
  function courseName() {
    var fills = document.querySelectorAll(".article .fill");
    // course name is the 3rd fill: NR, (date is span), Prestator, Medic, Denumirea cursului...
    var byLabel = null;
    var rows = document.querySelectorAll(".article table.grila tr");
    rows.forEach(function (tr) {
      var td = tr.querySelector("td"); if (!td) return;
      if (/Denumirea cursului/i.test(td.textContent)) {
        var f = tr.querySelector(".fill"); if (f) byLabel = f.textContent.trim();
      }
    });
    return byLabel || "";
  }

  var toastEl = null;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.id = "toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();

  // auto-snapshot on leaving the page (safety)
  window.addEventListener("beforeunload", function () { liveSave(currentId); });
})();
