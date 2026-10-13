// Immodrim : registre des estimations (Google Apps Script) - v2
var KEY = 'kxDX_MSO_YTRtLpOKFfBEQ';   // clé secrète : fait partie du lien envoyé à Cédric
var SITE = 'https://immodrim-git-preprod-marions-projects-4766d9f0.vercel.app'; // passer à https://immodrim.com en production
var COLS = ['id','date','statut','fiche','civilite','prenom','nom','email','telephone','type','adresse','cp','ville','surface','terrain','pieces','chambres','etage','etages','annee','etat','specs','prix','delai','fourchette_basse','fourchette_haute','note_cedric','validee_le'];
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
function doGet(e) {
  if (!e.parameter || e.parameter.k !== KEY) return json_({ error: 'forbidden' });
  var sh = sheet_(), r = rowOf_(sh, e.parameter.id);
  if (!r) return json_({ error: 'notfound' });
  var vals = sh.getRange(r, 1, 1, COLS.length).getDisplayValues()[0], o = {};
  COLS.forEach(function (c, i) { o[c] = vals[i]; });
  return json_(o);
}
function doPost(e) {
  var sh = sheet_(), d = JSON.parse(e.postData.contents);
  if (d.action === 'valider') {
    if (d.k !== KEY) return json_({ error: 'forbidden' });
    var r = rowOf_(sh, d.id);
    if (!r) return json_({ error: 'notfound' });
    ['fourchette_basse','fourchette_haute','note_cedric'].forEach(function (c) { sh.getRange(r, COLS.indexOf(c) + 1).setValue(d[c] === undefined ? '' : d[c]); });
    sh.getRange(r, COLS.indexOf('statut') + 1).setValue('Validée');
    sh.getRange(r, COLS.indexOf('validee_le') + 1).setValue(new Date());
    return json_({ ok: true });
  }
  d.statut = 'À estimer';
  d.fiche = SITE + '/fiche?id=' + encodeURIComponent(d.id) + '&k=' + KEY;
  sh.appendRow(COLS.map(function (c) { return d[c] === undefined ? '' : d[c]; }));
  return json_({ ok: true });
}
