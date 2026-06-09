/* ============================================================
   Mod administrator — logică comună (parolă) + gard Anexa 1.
   Expune window.ArdAdmin pentru Panoul de administrator.
   Butonul flotant se injectează DOAR pe Anexa 1 (unde există
   #anexa-1); pe restul paginilor doar API-ul e disponibil.

   ⚠️ SCHIMBĂ codul de mai jos cu cel dorit pentru Loredana.
   ⚠️ Ascundere „discretă", nu securitate criptografică.
   ============================================================ */
(function () {
  "use strict";
  var ADMIN_CODE = "ardeleanu2026";   // <-- schimbă aici
  var KEY = "ardeleanu_admin";

  function isAdmin() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  function setAdmin(v) { try { v ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch (e) {} }
  function check(code) { return code === ADMIN_CODE; }

  window.ArdAdmin = { isAdmin: isAdmin, setAdmin: setAdmin, check: check, KEY: KEY };

  /* ---- gard Anexa 1 (fără buton flotant; modul admin se setează din Panou) ---- */
  function applyAnexa1Gate() {
    if (!document.getElementById("anexa-1")) return;
    var a = isAdmin();
    document.body.classList.toggle("admin-on", a);
    document.body.classList.toggle("has-remun", document.querySelectorAll(".remun-section:not(.remun-off)").length > 0);
    if (!a) { var an = document.getElementById("anexa-1"); if (an) an.classList.remove("grid-editing"); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyAnexa1Gate);
  else applyAnexa1Gate();
})();
