# Aplicație contractare medici — Dr. Ardeleanu

Portal de lucru al Rețelei de Clinici Dr. Ardeleanu pentru întregul flux de colaborare cu medicii: contractul de prestări servicii medicale, anexele, acordurile de încetare și dosarul de documente al medicului.

**Site live:** https://vladtm75.github.io/Aplicatie-Contractare-Medici-Dr-Ardeleanu/

## Cum e publicat

Site-ul este servit de **GitHub Pages** din folderul `docs/` de pe branch-ul `main`. Orice commit pe `main` care atinge `docs/` declanșează automat un redeploy (~1 minut). Atenție: CDN-ul GitHub Pages păstrează versiunea veche în cache până la **10 minute** — pentru verificare imediată folosește un parametru de tip `?v=2` la URL sau Ctrl+F5.

Nu există build, framework sau dependențe: totul este HTML/CSS/JS static, editabil direct.

## Harta paginilor

Fiecare document există în două variante: **desktop** (completabil de administrator, cu cuprins lateral și căutare) și **mobil** (`- Mobil.html`, read-only informativ, cu meniu drawer și buton WhatsApp).

| Document | Desktop | Mobil | Namespace stocare |
|---|---|---|---|
| Meniul principal | `index.html` | (același, responsive) | — |
| Contractul de prestări servicii | `Contract Prestari Servicii Medicale.html` | `... - Mobil.html` | implicit (`contract`) |
| Contract + Anexa 1 (document unic) | `Contract Prestari Servicii Medicale cu Anexa 1.html` | `... - Mobil.html` | implicit |
| Anexa 1 — Grila de remunerare | `Anexa 1 - Grila de Remunerare.html` | `... - Mobil.html` | `anexa1` |
| Anexa 2 — Amortizare curs | `Anexa 2 - Amortizare Curs.html` | `... - Mobil.html` | `anexa2` |
| Acord de încetare (tranziție la contractul nou) | `Acord de Incetare Contract.html` | `... - Mobil.html` | `acord` |
| Model încetare — contract existent (simplu) | `Model Incetare Contract.html` | `... - Mobil.html` | `incetare-model` |
| Dosar medic — documente | `Dosar Medic.html` | `Dosar Medic - Mobil.html` | `ardeleanu_dosar*` |
| Panou administrator | `Administrator.html` | — | `ardeleanu_admin` |

### Secțiunile din meniul principal (`index.html`)

1. **Contractul și anexele** — contractul, contract+Anexa 1, Anexa 1, Anexa 2, acordul de încetare (varianta corelată cu intrarea în vigoare a contractului nou).
2. **Dosarul medicului** — fișa de documente a medicului și modelul simplu de încetare a contractului existent (fluxul: se semnează întâi încetarea, apoi contractul nou).

Fiecare card din index are atributele `data-desktop` și `data-mobil` (fișierul țintă pentru fiecare mod) și **trebuie înregistrat și în array-ul `cards` din scriptul inline** de la finalul `index.html` — altfel comutatorul calculator/telefon nu îi setează link-ul.

## Asset-uri comune (`docs/assets/`)

| Fișier | Rol |
|---|---|
| `wiki.css` / `wiki.js` | Aspectul documentelor desktop: masthead, cuprins generat automat din `.chapter h2 [data-toc]`, căutare în text |
| `mobile.css` / `mobile.js` | Chrome-ul paginilor mobil: header compact, drawer cuprins, căutare, FAB |
| `fields.css` / `fields.js` | Câmpurile completabile, grilele selectabile, semnătura beneficiarului |
| `admin.js` | Modul administrator (gard pe completare/tipărire; setează `body.admin-on`) |
| `dosar.css` / `dosar.js` | Pagina Dosar medic: dosare multiple, statusuri, termene de expirare |
| `drive.js` | Încărcarea documentelor din dosar în Google Drive |
| `share.js` | Butonul „Trimite pe WhatsApp" (`data-wa-share`, `data-wa-title`) |
| `crossref.js`, `zip.js` | Referințe încrucișate în contract; export arhivă |
| `*-og.png`, `*-hero.jpg` | Imagini Open Graph / hero pentru preview la partajarea link-urilor |

## Mecanisme cheie

**Câmpuri completabile (`fields.js`).** HTML-ul sursă păstrează liniuțele originale (`______`); la încărcare, scriptul le transformă în câmpuri editabile persistente. Valorile se salvează **local, în browser** (localStorage, chei `ardeleanu_<ns>_fill_v1`), nu pe server. Câmpurile sunt indexate **secvențial, după poziția în document** — dacă adaugi sau ștergi o liniuță undeva în document, toate câmpurile de după ea se decalează și valorile salvate local se pot nepotrivi. De aceea, după modificări structurale, valorile completate anterior trebuie reverificate.

**Mod administrator.** Pe desktop, doar administratorul (autentificat prin `Administrator.html`) poate completa, tipări sau salva documentele; vizitatorii văd modelul read-only cu o notă. Paginile mobil sunt întotdeauna read-only. Semnătura beneficiarului se afișează în sloturile `.sig-slot[data-sig="beneficiar"]` și se stochează global (aceeași semnătură în toate documentele). Codul de acces este definit în `assets/admin.js`.

**Grile selectabile (Anexa 1).** Rândurile de manopere au `tr[data-opt="..."]` cu checkbox `.grila-pick`; administratorul bifează manoperele aplicabile fiecărui prestator, iar selecția se salvează local (`ardeleanu_<ns>_grila_sel_v1`). Un rând nou = un `data-opt` nou, unic — bifa lui pornește debifată.

**Namespace-uri de stocare.** Fiecare document își izolează datele prin `<body data-store-ns="...">`. La crearea unui document nou, setează un namespace unic ca să nu se suprascrie datele între documente.

## Cum adaugi un document nou (checklist)

1. Copiază tiparul unui document existent apropiat (ex. `Acord de Incetare Contract.html` + varianta `- Mobil`), păstrând structura: masthead/`m-top`, `doc-head`, secțiuni `.chapter` cu `data-toc`, semnături, disclaimer.
2. Setează `data-store-ns` unic pe `<body>` în ambele variante.
3. Completează meta OG (title, description, image) pentru preview-ul de link.
4. Adaugă cardul în `index.html`: blocul `<a class="card" id="card-...">` cu `data-desktop`/`data-mobil` **și** intrarea corespunzătoare în array-ul `cards` din scriptul inline.
5. Verifică local înainte de publicare (vezi mai jos), apoi urcă toate fișierele atinse.

## Cum publici un update

1. Editează fișierele din `docs/`.
2. **Verifică integritatea** fiecărui fișier modificat: se termină cu `</html>`, iar scriptul inline din `index.html` trece de `node --check`. (A existat un incident în iulie 2026 cu un `index.html` trunchiat la sincronizarea OneDrive — simptom: niciun card nu mai era clicabil.)
3. Pe GitHub: `docs/` → **Add file → Upload files** → trage fișierele → commit direct pe `main`. Fișierele cu același nume se suprascriu.
4. După ~1 minut verifică live cu `?v=<ceva>` în URL ca să ocolești cache-ul.

## Capcane cunoscute

Fișierele editate pe mașini cu OneDrive se pot trunchia la sincronizare — verifică întotdeauna finalul fișierului înainte de upload. Cache-ul GitHub Pages ține ~10 minute versiunea veche. Adăugarea de liniuțe noi decalează indexarea câmpurilor completate local (vezi mai sus). Datele completate trăiesc doar în browserul respectiv — nu există server; schimbarea browserului/dispozitivului pornește de la zero.

## Istoric versiuni

- **Iunie 2026** — versiunea inițială: contract, Anexa 1 (grilă selectabilă), Anexa 2, acord de încetare cu tranziție, dosar medic, mod administrator, variante mobil, partajare WhatsApp.
- **Iulie 2026** — adăugat „Model încetare — contractul existent" (acord simplu de încetare, desktop + mobil) în secțiunea Dosarul medicului; în grila B (tarife fixe chirurgie/implantologie), „Pterigoid / zigomatic" a fost separat în „Implant pterigoidian" și „Implant zigomatic".
