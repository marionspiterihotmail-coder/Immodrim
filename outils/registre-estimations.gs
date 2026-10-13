// Immodrim : registre des estimations (Google Apps Script) - v5
var KEY = 'kxDX_MSO_YTRtLpOKFfBEQ';   // clé secrète de Cédric (lien de validation)
var SITE = 'https://immodrim-git-preprod-marions-projects-4766d9f0.vercel.app'; // passer à https://immodrim.com en production
var COLS = ['id','date','statut','fiche','civilite','prenom','nom','email','telephone','type','adresse','cp','ville','surface','terrain','pieces','chambres','etage','etages','annee','etat','specs','prix','delai','fourchette_basse','fourchette_haute','note_cedric','validee_le','comparables','jeton','avis','commentaire_client','avis_le'];
var PUBLIC = ['id','date','statut','type','adresse','surface','terrain','pieces','chambres','etage','etages','annee','etat','specs','fourchette_basse','fourchette_haute','note_cedric','comparables','avis'];

function sheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) { sh.appendRow(COLS); sh.setFrozenRows(1); }
  return sh;
}
function rowOf_(sh, id) {
  var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = 1; i < ids.length; i++) { if (ids[i][0] === id) return i + 1; }
  return 0;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function col_(sh, r, c, v) { sh.getRange(r, COLS.indexOf(c) + 1).setValue(v); }
function val_(sh, r, c) { return sh.getRange(r, COLS.indexOf(c) + 1).getValue(); }

function doGet(e) {
  var p = e.parameter || {};
  var sh = sheet_(), r = rowOf_(sh, p.id);
  if (!r) return json_({ error: 'notfound' });
  var admin = p.k === KEY, client = !admin && p.t && p.t === String(val_(sh, r, 'jeton'));
  if (!admin && !client) return json_({ error: 'forbidden' });
  var vals = sh.getRange(r, 1, 1, COLS.length).getDisplayValues()[0], o = {};
  COLS.forEach(function (c, i) { if (admin || PUBLIC.indexOf(c) >= 0) o[c] = vals[i]; });
  return json_(o);
}

function doPost(e) {
  var sh = sheet_(), d = JSON.parse(e.postData.contents), r;
  if (d.action === 'valider') {
    if (d.k !== KEY) return json_({ error: 'forbidden' });
    r = rowOf_(sh, d.id); if (!r) return json_({ error: 'notfound' });
    col_(sh, r, 'fourchette_basse', d.fourchette_basse); col_(sh, r, 'fourchette_haute', d.fourchette_haute);
    col_(sh, r, 'note_cedric', d.note_cedric || ''); col_(sh, r, 'statut', 'Validée'); col_(sh, r, 'validee_le', new Date());
    return json_({ ok: true });
  }
  if (d.action === 'avis') {
    r = rowOf_(sh, d.id);
    if (!r || !d.t || d.t !== String(val_(sh, r, 'jeton'))) return json_({ error: 'forbidden' });
    col_(sh, r, 'avis', String(d.avis || '').slice(0, 60)); col_(sh, r, 'commentaire_client', String(d.commentaire || '').slice(0, 1000)); col_(sh, r, 'avis_le', new Date());
    return json_({ ok: true });
  }
  // nouvelle demande d'estimation
  d.statut = 'Estimation auto';
  d.jeton = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  d.fiche = SITE + '/fiche?id=' + encodeURIComponent(d.id) + '&k=' + KEY;
  d.comparables = comparables_(d);
  var rg = range_(d); if (rg) { d.fourchette_basse = rg[0]; d.fourchette_haute = rg[1]; }
  sh.appendRow(COLS.map(function (c) { return d[c] === undefined ? '' : d[c]; }));
  return json_({ ok: true, id: d.id, t: d.jeton });
}

// Première estimation : médiane du prix au m² des ventes proches x surface, -5 % / +5 %, arrondie à 5 000 €.
function range_(d) {
  try {
    var cp = JSON.parse(d.comparables), s = parseFloat(d.surface) || 0;
    if (!cp.items || cp.items.length < 3 || !s) return null;
    var pm = cp.items.map(function (o) { return o.prix / o.sb; }).sort(function (a, b) { return a - b; });
    var n = pm.length, mid = n % 2 ? pm[(n - 1) / 2] : (pm[n / 2 - 1] + pm[n / 2]) / 2;
    var r5 = function (v) { return Math.round(v / 5000) * 5000; };
    return [r5(mid * s * 0.95), r5(mid * s * 1.05)];
  } catch (err) { return null; }
}

// Ventes proches (DVF via l'API du Cerema) + adresses approchées (Base Adresse Nationale). Ne bloque jamais l'enregistrement.
function comparables_(d) {
  try {
    var get = function (u) { return JSON.parse(UrlFetchApp.fetch(u, { muteHttpExceptions: true }).getContentText()); };
    var g = get('https://api-adresse.data.gouv.fr/search/?limit=1&q=' + encodeURIComponent(d.adresse || ''));
    var f = g.features && g.features[0]; if (!f) return JSON.stringify({ err: 'adresse introuvable' });
    var x0 = f.geometry.coordinates[0], y0 = f.geometry.coordinates[1], code = f.properties.citycode;
    var type = d.type === 'Maison' ? '111' : '121';
    var an = new Date().getFullYear() - 5, s = parseFloat(d.surface) || 0;
    var j = get('https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/?code_insee=' + code + '&codtypbien=' + type + '&anneemut_min=' + an + '&page_size=200&format=json');
    var cen = function (geom) { var pts = []; (function w(a) { if (typeof a[0] === 'number') pts.push(a); else a.forEach(w); })(geom.coordinates);
      return [pts.reduce(function (q, p) { return q + p[0]; }, 0) / pts.length, pts.reduce(function (q, p) { return q + p[1]; }, 0) / pts.length]; };
    var dist = function (x, y) { return Math.sqrt(Math.pow((x - x0) * Math.cos(y0 * Math.PI / 180), 2) + Math.pow(y - y0, 2)) * 111320; };
    var items = (j.features || []).map(function (ft) { var p = ft.properties, c = cen(ft.geometry);
      return { date: p.datemut, prix: +p.valeurfonc, sb: +p.sbati, terr: +p.sterr || 0, x: c[0], y: c[1], dist: Math.round(dist(c[0], c[1])), vefa: p.vefa, nb: p.nblocmut }; })
      .filter(function (o) { return o.nb === 1 && !o.vefa && o.prix > 100000 && o.sb > 0 && (!s || (o.sb >= s * 0.6 && o.sb <= s * 1.5)); })
      .sort(function (a, b) { return a.dist - b.dist; }).slice(0, 5);
    var reqs = items.map(function (o) { return { url: 'https://api-adresse.data.gouv.fr/reverse/?limit=1&lon=' + o.x + '&lat=' + o.y, muteHttpExceptions: true }; });
    var resp = reqs.length ? UrlFetchApp.fetchAll(reqs) : [];
    items.forEach(function (o, i) { var rf = null; try { rf = JSON.parse(resp[i].getContentText()).features[0]; } catch (e2) {}
      o.adresse = rf ? rf.properties.name + ', ' + rf.properties.postcode + ' ' + rf.properties.city : ''; delete o.vefa; delete o.nb; });
    return JSON.stringify({ x: x0, y: y0, items: items });
  } catch (err) { return JSON.stringify({ err: String(err) }); }
}
// À exécuter UNE fois à la main si Google redemande des autorisations.
function autoriser() { UrlFetchApp.fetch('https://api-adresse.data.gouv.fr/search/?q=test&limit=1'); }
