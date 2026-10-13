// Immodrim : registre des estimations (Google Apps Script) - v8
var KEY = 'kxDX_MSO_YTRtLpOKFfBEQ';   // clé secrète de Cédric (lien de validation)
var SITE = 'https://immodrim-git-preprod-marions-projects-4766d9f0.vercel.app'; // passer à https://immodrim.com en production
var COLS = ['id','date','statut','fiche','civilite','prenom','nom','email','telephone','type','adresse','cp','ville','surface','terrain','pieces','chambres','etage','etages','annee','etat','specs','prix','delai','fourchette_basse','fourchette_haute','note_cedric','validee_le','comparables','jeton','avis','commentaire_client','avis_le','envoi_mail','niveaux','mitoyennete','dpe','exceptionnel','ajustements'];
var PUBLIC = ['id','date','statut','type','adresse','surface','terrain','pieces','chambres','etage','etages','annee','etat','specs','fourchette_basse','fourchette_haute','note_cedric','comparables','avis','niveaux','mitoyennete','dpe','exceptionnel'];

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
  if (d.action === 'mail') {
    r = rowOf_(sh, d.id);
    if (r) { envoyerMail_(sh, r); } else { CacheService.getScriptCache().put('mail_' + d.id, '1', 600); }
    return json_({ ok: true });
  }
  // nouvelle demande d'estimation
  d.statut = 'Estimation auto';
  d.jeton = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  d.fiche = SITE + '/fiche?id=' + encodeURIComponent(d.id) + '&k=' + KEY;
  d.comparables = comparables_(d);
  var rg = range_(d); if (rg) { d.fourchette_basse = rg[0]; d.fourchette_haute = rg[1]; d.ajustements = rg[2]; }
  sh.appendRow(COLS.map(function (c) { return d[c] === undefined ? '' : d[c]; }));
  if (CacheService.getScriptCache().get('mail_' + d.id)) { envoyerMail_(sh, rowOf_(sh, d.id)); }
  return json_({ ok: true, id: d.id, t: d.jeton });
}

// E-mail au visiteur avec le lien de sa fiche (uniquement s'il a choisi de la recevoir par e-mail).
function envoyerMail_(sh, r) {
  try {
    if (!r || val_(sh, r, 'envoi_mail')) return;
    var to = String(val_(sh, r, 'email')), id = val_(sh, r, 'id'), t = val_(sh, r, 'jeton'), pre = val_(sh, r, 'prenom');
    var lien = SITE + '/fiche?id=' + encodeURIComponent(id) + '&t=' + t;
    var html = '<p>Bonjour ' + String(pre).replace(/[<>&]/g, '') + ',</p><p>Voici votre estimation indicative Immodrim : <a href="' + lien + '">consulter mon estimation</a>.</p>' +
      '<p>Cédric Brachet, votre interlocuteur, vous contactera pour l\'affiner avec vous.</p><p>À très vite,<br>Immodrim</p>';
    MailApp.sendEmail({ to: to, subject: 'Votre estimation Immodrim', htmlBody: html, name: 'Immodrim', replyTo: 'cbrachet@immodrim.com' });
    col_(sh, r, 'envoi_mail', new Date());
  } catch (err) {}
}

// ===== Réglages : onglet "Réglages" du Sheet (modifiable à la main par Marion ou Cédric) =====
// [clé, libellé, valeur par défaut en %]. Les valeurs de départ s'appuient sur des ordres de grandeur publiés (Meilleurtaux, PAP) : à valider par Cédric.
var DEFAUTS = [
  ['cap_max', 'RÉGLAGE : plafond du cumul des hausses (%)', 15],
  ['cap_min', 'RÉGLAGE : plafond du cumul des baisses (%)', -25],
  ['largeur', 'RÉGLAGE : largeur de la fourchette autour de la valeur centrale (± %)', 5],
  ['etat|À rénover', 'État : à rénover', -15], ['etat|À rafraîchir', 'État : à rafraîchir', -7], ['etat|Bon état', 'État : bon état', 0], ['etat|Neuf ou refait à neuf (moins de 3 ans)', 'État : neuf ou refait à neuf', 8],
  ['dpe|A', 'DPE A', 4], ['dpe|B', 'DPE B', 3], ['dpe|C', 'DPE C', 1], ['dpe|D', 'DPE D', 0], ['dpe|E', 'DPE E', -2], ['dpe|F', 'DPE F', -7], ['dpe|G', 'DPE G', -12],
  ['exc|Vue exceptionnelle', 'Exceptionnel : vue exceptionnelle', 8], ['exc|Proche d’un monument ou site remarquable', 'Exceptionnel : proche d’un monument ou site remarquable', 4],
  ['exc|Calme absolu, sans vis-à-vis', 'Exceptionnel : calme absolu, sans vis-à-vis', 4], ['exc|Luminosité exceptionnelle', 'Exceptionnel : luminosité exceptionnelle', 3],
  ['exc|Prestations haut de gamme', 'Exceptionnel : prestations haut de gamme', 6], ['exc|Cachet ou caractère rare', 'Exceptionnel : cachet ou caractère rare', 5],
  ['spec|Terrasse', 'Équipement : terrasse', 8], ['spec|Balcon', 'Appartement : balcon', 2.5], ['spec|Ascenseur', 'Appartement : ascenseur', 3], ['spec|Cave', 'Appartement : cave', 1],
  ['spec|Parking', 'Appartement : parking', 3], ['spec|Box fermé', 'Appartement : box fermé', 4], ['spec|Gardien ou concierge', 'Appartement : gardien ou concierge', 1.5],
  ['app|rdc', 'Appartement : rez-de-chaussée', -5], ['app|haut_sans_ascenseur', 'Appartement : 3e étage ou plus sans ascenseur', -6],
  ['spec|Piscine', 'Maison : piscine', 8], ['spec|Garage', 'Maison : garage', 3], ['spec|Jardin', 'Maison : jardin', 2], ['spec|Cave ou sous-sol', 'Maison : cave ou sous-sol', 1],
  ['spec|Dépendance (abri, atelier…)', 'Maison : dépendance', 1.5], ['spec|Cheminée ou poêle', 'Maison : cheminée ou poêle', 0.5],
  ['mito|Mitoyenne d’un côté', 'Maison : mitoyenne d’un côté', -3], ['mito|Mitoyenne des deux côtés', 'Maison : mitoyenne des deux côtés', -6]
];
function num_(v) { var n = parseFloat(String(v).replace('%', '').replace(',', '.')); return isNaN(n) ? 0 : n; }
function reglages_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('Réglages');
  if (!sh) { sh = ss.insertSheet('Réglages'); sh.appendRow(['Critère', 'Ajustement (%)', 'Clé technique (ne pas modifier)']); sh.setFrozenRows(1); sh.setColumnWidth(1, 460); sh.setColumnWidth(3, 330); }
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues() : [], map = {};
  rows.forEach(function (r) { map[r[2]] = num_(r[1]); });
  DEFAUTS.forEach(function (d) { if (!(d[0] in map)) { sh.appendRow([d[1], d[2], d[0]]); map[d[0]] = d[2]; } });
  return map;
}

// Première estimation : médiane du prix au m² des ventes proches x surface, ajustée selon les critères du bien (onglet Réglages), avec fourchette ±.
function range_(d) {
  try {
    var cp = JSON.parse(d.comparables), s = parseFloat(d.surface) || 0;
    if (!cp.items || cp.items.length < 3 || !s) return null;
    var pm = cp.items.map(function (o) { return o.prix / o.sb; }).sort(function (a, b) { return a - b; });
    var n = pm.length, mid = n % 2 ? pm[(n - 1) / 2] : (pm[n / 2 - 1] + pm[n / 2]) / 2;
    var R = reglages_(), items = [], add = function (cle, label) { if (cle in R && R[cle] !== 0) items.push([label, R[cle]]); };
    add('etat|' + d.etat, 'état ' + String(d.etat).toLowerCase()); if (d.dpe) add('dpe|' + d.dpe, 'DPE ' + d.dpe);
    String(d.specs || '').split(', ').forEach(function (x) { if (x) add('spec|' + x, x.toLowerCase()); });
    String(d.exceptionnel || '').split(', ').forEach(function (x) { if (x) add('exc|' + x, x.toLowerCase()); });
    if (d.type === 'Maison') { add('mito|' + d.mitoyennete, String(d.mitoyennete).toLowerCase()); }
    else {
      var et = parseInt(d.etage, 10), asc = String(d.specs || '').indexOf('Ascenseur') >= 0;
      if (et === 0) add('app|rdc', 'rez-de-chaussée'); else if (et >= 3 && !asc) add('app|haut_sans_ascenseur', 'étage élevé sans ascenseur');
    }
    var total = items.reduce(function (q, it) { return q + it[1]; }, 0), brut = total;
    total = Math.max(R.cap_min, Math.min(R.cap_max, total));
    var w = (R.largeur || 5) / 100, centre = mid * s * (1 + total / 100), r5 = function (v) { return Math.round(v / 5000) * 5000; };
    var txt = items.map(function (it) { return it[0] + ' ' + (it[1] > 0 ? '+' : '') + it[1] + ' %'; }).join(', ');
    txt = 'Médiane ' + Math.round(mid) + ' €/m²' + (txt ? ' ; ' + txt : '') + ' ; total ' + (total > 0 ? '+' : '') + total + ' %' + (total !== brut ? ' (plafonné, cumul brut ' + brut + ' %)' : '');
    return [r5(centre * (1 - w)), r5(centre * (1 + w)), txt];
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
function autoriser() { UrlFetchApp.fetch('https://api-adresse.data.gouv.fr/search/?q=test&limit=1'); MailApp.getRemainingDailyQuota(); }
