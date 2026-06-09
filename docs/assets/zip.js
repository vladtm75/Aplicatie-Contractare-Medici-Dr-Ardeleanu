/* ============================================================
   Mic utilitar ZIP (metoda „store", fără compresie, fără
   biblioteci externe) — pentru a împacheta documentele unui
   dosar într-o arhivă descărcabilă, încărcabilă manual în Drive.
   window.makeZip([{name, blob}]) -> Promise<Blob>
   ============================================================ */
(function () {
  "use strict";
  var crcTable = (function () {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function dosTime(d) { return ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31); }
  function dosDate(d) { return (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31); }

  window.makeZip = function (files) {
    var enc = new TextEncoder();
    var now = new Date(), t = dosTime(now), dd = dosDate(now);
    var parts = [], central = [], offset = 0, count = 0;
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        return f.blob.arrayBuffer().then(function (ab) {
          var data = new Uint8Array(ab);
          var nameBytes = enc.encode(f.name);
          var crc = crc32(data);
          var lh = new DataView(new ArrayBuffer(30));
          lh.setUint32(0, 0x04034b50, true);
          lh.setUint16(4, 20, true); lh.setUint16(6, 0, true); lh.setUint16(8, 0, true);
          lh.setUint16(10, t, true); lh.setUint16(12, dd, true);
          lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
          lh.setUint16(26, nameBytes.length, true); lh.setUint16(28, 0, true);
          parts.push(new Uint8Array(lh.buffer), nameBytes, data);
          var cd = new DataView(new ArrayBuffer(46));
          cd.setUint32(0, 0x02014b50, true);
          cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0, true); cd.setUint16(10, 0, true);
          cd.setUint16(12, t, true); cd.setUint16(14, dd, true);
          cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
          cd.setUint16(28, nameBytes.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true);
          cd.setUint16(34, 0, true); cd.setUint16(36, 0, true); cd.setUint32(38, 0, true); cd.setUint32(42, offset, true);
          central.push(new Uint8Array(cd.buffer), nameBytes);
          offset += 30 + nameBytes.length + data.length;
          count++;
        });
      });
    });
    return chain.then(function () {
      var cdStart = offset, cdSize = 0;
      central.forEach(function (c) { cdSize += c.length; });
      var eo = new DataView(new ArrayBuffer(22));
      eo.setUint32(0, 0x06054b50, true);
      eo.setUint16(4, 0, true); eo.setUint16(6, 0, true);
      eo.setUint16(8, count, true); eo.setUint16(10, count, true);
      eo.setUint32(12, cdSize, true); eo.setUint32(16, cdStart, true); eo.setUint16(20, 0, true);
      return new Blob(parts.concat(central, [new Uint8Array(eo.buffer)]), { type: "application/zip" });
    });
  };
})();
