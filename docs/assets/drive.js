/* ============================================================
   Google Drive — integrare client-side (OAuth + Drive REST).
   Scope: drive.file (aplicația vede doar fișierele pe care le creează).
   Expune window.ArdDrive pentru Panoul de administrator.

   ⚠️ Completează CLIENT_ID cu OAuth Client ID-ul tău.
   ⚠️ Funcționează DOAR pe originea publicată (ex. github.io),
      adăugată în „Authorized JavaScript origins" în Google Cloud.
   ============================================================ */
(function () {
  "use strict";
  var CLIENT_ID = "26160058678-6eo7o31opld93kvd18q290un7vvu48ms.apps.googleusercontent.com";
  var SCOPE = "https://www.googleapis.com/auth/drive.file";
  var ROOT_NAME = "Dosare medici — Dr. Ardeleanu";

  var token = null, tokenClient = null, gisLoaded = false, listeners = [];
  var TKEY = "ardeleanu_gtoken";
  try { token = sessionStorage.getItem(TKEY) || null; } catch (e) {}

  function configured() { return !!CLIENT_ID; }
  function connected() { return !!token; }
  function notify() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  function loadGIS() {
    return new Promise(function (resolve, reject) {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Nu s-a putut încărca Google Identity Services.")); };
      document.head.appendChild(s);
    });
  }

  function connect() {
    if (!configured()) {
      alert("Google Drive nu este încă configurat.\nAdaugă Client ID-ul în assets/drive.js și publică site-ul.");
      return Promise.reject(new Error("not configured"));
    }
    return loadGIS().then(function () {
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: function (resp) {
            if (resp && resp.access_token) { token = resp.access_token; try { sessionStorage.setItem(TKEY, token); } catch (e) {} notify(); }
          }
        });
      }
      tokenClient.requestAccessToken({ prompt: connected() ? "" : "consent" });
    });
  }

  function disconnect() {
    if (token && window.google && google.accounts && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(token, function () {}); } catch (e) {}
    }
    token = null; try { sessionStorage.removeItem(TKEY); } catch (e) {} notify();
  }

  function api(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers["Authorization"] = "Bearer " + token;
    return fetch(url, opts).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("Drive " + r.status + ": " + t); });
      return r.json();
    });
  }

  // find a folder by name (optionally within parent); create if missing
  function ensureFolder(name, parentId) {
    var q = "mimeType='application/vnd.google-apps.folder' and trashed=false and name='" + name.replace(/'/g, "\\'") + "'";
    if (parentId) q += " and '" + parentId + "' in parents";
    return api("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) + "&fields=files(id,name)")
      .then(function (res) {
        if (res.files && res.files.length) return res.files[0].id;
        var meta = { name: name, mimeType: "application/vnd.google-apps.folder" };
        if (parentId) meta.parents = [parentId];
        return api("https://www.googleapis.com/drive/v3/files?fields=id", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta)
        }).then(function (f) { return f.id; });
      });
  }

  function uploadBlob(name, blob, parentId) {
    var meta = { name: name }; if (parentId) meta.parents = [parentId];
    var form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
    form.append("file", blob);
    return api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
      method: "POST", body: form
    });
  }

  // urcă tot dosarul curent (folder rădăcină -> folder per medic -> fișiere)
  function syncDossier(onProgress) {
    if (!connected()) return Promise.reject(new Error("not connected"));
    if (!window.DosarBridge) return Promise.reject(new Error("Dosarul nu este disponibil pe această pagină."));
    var dossier = DosarBridge.getDossier();
    var folderName = dossier.name || "Dosar fără nume";
    return ensureFolder(ROOT_NAME).then(function (rootId) {
      return ensureFolder(folderName, rootId);
    }).then(function (folderId) {
      return DosarBridge.listFiles().then(function (recs) {
        var done = 0;
        return recs.reduce(function (chain, rec) {
          return chain.then(function () {
            var fname = (rec.itemName ? rec.itemName + " — " : "") + rec.name;
            return uploadBlob(fname, rec.blob, folderId).then(function () {
              done++; if (onProgress) onProgress(done, recs.length);
            });
          });
        }, Promise.resolve()).then(function () { return { folder: folderName, count: recs.length }; });
      });
    });
  }

  window.ArdDrive = {
    configured: configured,
    connected: connected,
    connect: connect,
    disconnect: disconnect,
    syncDossier: syncDossier,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
