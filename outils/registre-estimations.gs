// Immodrim : registre des demandes d'estimation (Google Apps Script)
// Colonnes créées automatiquement à la première demande.
var COLS = ['id','date','statut','civilite','prenom','nom','email','telephone','type','adresse','cp','ville','surface','pieces','chambres','etage','etages','annee','etat','specs','prix','delai','fourchette_basse','fourchette_haute','note_cedric','envoyee_le'];
function doPost(e) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) { sh.appendRow(COLS); sh.setFrozenRows(1); }
  var d = JSON.parse(e.postData.contents);
  d.statut = 'À estimer';
  sh.appendRow(COLS.map(function (c) { return d[c] === undefined ? '' : d[c]; }));
  return ContentService.createTextOutput('ok');
}
