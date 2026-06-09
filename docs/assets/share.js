/* ============================================================
   Share — leagă orice element [data-wa-share].
   Folosește fereastra nativă de partajare a sistemului (care
   include WhatsApp, e-mail etc.) când e disponibilă; altfel
   deschide direct WhatsApp prin wa.me.
   Partajează titlul documentului + linkul paginii curente.
   (Pe link-ul public — github.io — WhatsApp arată preview-ul cu
   imaginea din meta og:image.)
   ============================================================ */
(function () {
  "use strict";
  var btns = document.querySelectorAll("[data-wa-share]");
  if (!btns.length) return;
  Array.prototype.forEach.call(btns, function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      var title = b.getAttribute("data-wa-title") || document.title || "";
      var url = location.href;
      if (navigator.share) {
        navigator.share({ title: title, text: title, url: url }).catch(function () {});
      } else {
        window.open("https://wa.me/?text=" + encodeURIComponent(title + "\n" + url), "_blank", "noopener");
      }
    });
  });
})();
