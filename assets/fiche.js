(function () {
  'use strict';
  var SHEET_URL = 'https://script.google.com/macros/s/AKfycbwMcsamgpuW_ZAoOqLFvPkqVxczaZQ_w4KVcns5D6pJ995gKr7jLV5eIL6bmombUYB7/exec';
  var qs = new URLSearchParams(location.search);
  var id = qs.get('id') || '', k = qs.get('k') || '', viewOnly = qs.get('vue') === '1';
  var msg = document.getElementById('msg'), panel = document.getElementById('panel'), doc = document.getElementById('doc');
  var low = document.getElementById('low'), high = document.getElementById('high'), note = document.getElementById('note');
  var save = document.getElementById('save'), status = document.getElementById('status');
  var data = null;

  function el(tag, cls, text, parent) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    if (parent) { parent.appendChild(e); }
    return e;
  }
  function eur(n) { return Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' €'; }
  function num(v) { var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  function dateFr(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }


  var DEMO = { id: 'EST-MV6JBVET', date: '2026-10-13T10:25:26.213Z', statut: 'À estimer', adresse: "77bis Rue des Sablons 78620 L'Étang-la-Ville", type: 'Maison', surface: '115', terrain: '500', pieces: '4', chambres: '3', etage: '0', etages: '0', annee: 'Après 2000', etat: 'Neuf ou refait à neuf (moins de 3 ans)', specs: 'Terrasse, Jardin',
    fourchette_basse: '720000', fourchette_haute: '800000', note_cedric: 'Belle maison récente avec jardin, très recherchée sur ce secteur. Je vous propose une visite pour affiner cette estimation.',
    comparables: JSON.stringify({ x: 2.070289, y: 48.874643, items: [
      { date: '2021-08-13', prix: 652866, sb: 115, terr: 536, x: 2.0703673, y: 48.8747243, dist: 11, adresse: "77 Rue des Sablons, 78620 L'Étang-la-Ville" },
      { date: '2022-06-23', prix: 826000, sb: 115, terr: 678, x: 2.0701716, y: 48.8747199, dist: 12, adresse: "77ter Rue des Sablons, 78620 L'Étang-la-Ville" },
      { date: '2022-10-27', prix: 904690, sb: 86, terr: 865, x: 2.070176, y: 48.8751439, dist: 56, adresse: "75 Rue des Sablons, 78620 L'Étang-la-Ville" },
      { date: '2022-11-30', prix: 1105010, sb: 156, terr: 1674, x: 2.0711827, y: 48.8735638, dist: 137, adresse: "3 Clos de la Tournelle, 78620 L'Étang-la-Ville" },
      { date: '2020-09-04', prix: 651750, sb: 110, terr: 1072, x: 2.0721049, y: 48.8742277, dist: 141, adresse: "7 Clos de la Tournelle, 78620 L'Étang-la-Ville" } ] }) };
  var compsEl = null, map = null;
  function moisFr(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }); }
  function buildComps() {
    var cp = null;
    try { cp = data.comparables ? JSON.parse(data.comparables) : null; } catch (e) { cp = null; }
    if (!cp || !cp.items || !cp.items.length || typeof L === 'undefined') { return null; }
    var s = el('section', 's');
    el('h2', null, 'Les ventes les plus proches de chez vous', s);
    var tw = el('div', 'tw', null, s), t = el('table', 'cmp', null, tw), hd = el('tr', null, null, el('thead', null, null, t));
    ['Adresse', 'Maison', 'Terrain', 'Prix', '€ / m²', 'Vente', 'Distance', ''].forEach(function (x, i) { el('th', i > 0 && i < 7 ? 'r' : '', x, hd); });
    var tb = el('tbody', null, null, t);
    cp.items.forEach(function (o) {
      var tr = el('tr', null, null, tb);
      el('td', null, o.adresse, tr); el('td', 'r', o.sb + ' m²', tr); el('td', 'r', o.terr ? o.terr + ' m²' : '–', tr);
      el('td', 'r', eur(o.prix), tr); el('td', 'r', eur(o.prix / o.sb), tr); el('td', 'r', moisFr(o.date), tr);
      el('td', 'r', o.dist < 1000 ? o.dist + ' m' : (o.dist / 1000).toFixed(1).replace('.', ',') + ' km', tr);
      var a = el('a', null, 'Satellite', el('td', null, null, tr)); a.target = '_blank'; a.rel = 'noopener';
      a.href = 'https://www.google.com/maps/@?api=1&map_action=map&basemap=satellite&zoom=19&center=' + o.y + ',' + o.x;
    });
    el('p', 'src', 'Source : Demandes de valeurs foncières (DVF, données publiques de l’État). Adresses approximatives, déduites de l’emplacement des parcelles vendues.', s);
    var m = el('div', null, null, s); m.id = 'map';
    compsEl = s; compsEl._cp = cp; compsEl._m = m;
    return s;
  }
  function initMap() {
    if (map || !compsEl) { return; }
    var cp = compsEl._cp;
    map = L.map(compsEl._m, { scrollWheelZoom: false });
    var plan = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© les contributeurs d’OpenStreetMap' });
    var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagerie © Esri' });
    plan.addTo(map); L.control.layers({ 'Plan': plan, 'Satellite': sat }, null, { collapsed: false }).addTo(map);
    var pts = [[cp.y, cp.x]];
    L.circleMarker([cp.y, cp.x], { radius: 11, color: '#fff', weight: 3, fillColor: '#4b3be0', fillOpacity: 1 }).addTo(map).bindTooltip('Votre bien', { permanent: true, direction: 'top' });
    cp.items.forEach(function (o) {
      var box = el('div'); el('b', null, eur(o.prix), box);
      el('span', null, o.adresse, box); box.appendChild(document.createElement('br'));
      el('span', null, o.sb + ' m² · terrain ' + (o.terr || '–') + ' m² · ' + eur(o.prix / o.sb) + ' / m² · ' + moisFr(o.date), box);
      L.circleMarker([o.y, o.x], { radius: 9, color: '#fff', weight: 2, fillColor: '#e0632b', fillOpacity: 1 }).addTo(map).bindPopup(box);
      pts.push([o.y, o.x]);
    });
    map.fitBounds(pts, { padding: [30, 30], maxZoom: 18 });
  }

  function render() {
    var lo = num(low.value), hi = num(high.value), ok = lo > 0 && hi >= lo;
    var surf = num(data.surface);
    doc.textContent = '';
    var top = el('header', 'top', null, doc);
    var lg = el('div', null, null, top);
    var a = el('img', 'lg-l', null, lg); a.src = '/assets/img/immodrim-logo.png'; a.alt = 'Immodrim';
    var b = el('img', 'lg-d', null, lg); b.src = '/assets/img/immodrim-logo-white.png'; b.alt = '';
    var ref = el('div', 'ref', null, top);
    ref.appendChild(document.createTextNode('Estimation n° ' + data.id)); ref.appendChild(document.createElement('br'));
    ref.appendChild(document.createTextNode('Établie le ' + dateFr(ok ? new Date() : data.date)));

    var hero = el('div', 'hero', null, doc);
    el('small', null, 'Estimation indicative de votre bien', hero);
    el('h1', null, data.adresse || 'Votre bien', hero);
    var typ = (data.type || 'Bien') + (data.pieces ? ' · ' + data.pieces + ' pièces' : '') + (surf ? ' · ' + surf + ' m²' : '') + (data.terrain ? ' · terrain ' + data.terrain + ' m²' : '') + (!data.terrain && data.etages ? ' · étage ' + data.etage + ' sur ' + data.etages : '');
    el('p', null, typ, hero);
    var price = el('div', 'price', null, hero);
    el('div', 'lab', 'Fourchette de prix estimée', price);
    if (ok) {
      var c = (lo + hi) / 2;
      el('div', 'val', eur(lo) + ' – ' + eur(hi), price);
      el('div', 'sub', (surf ? 'soit environ ' + eur(c / surf) + ' / m² · ' : '') + 'valeur centrale ' + eur(c), price);
      var g = el('div', 'gauge', null, price); el('i', null, null, g); el('b', null, null, g);
      var gl = el('div', 'gl', null, price); el('span', null, 'Bas ' + eur(lo), gl); el('span', null, 'Haut ' + eur(hi), gl);
    } else {
      el('div', 'val pending', 'En cours d’établissement', price);
    }

    if (ok && data.note_cedric) {
      var sn = el('section', 's', null, doc); el('h2', null, 'Le mot de Cédric', sn); el('p', 'note', data.note_cedric, sn);
    }
    var s1 = el('section', 's', null, doc); el('h2', null, 'Votre bien en un coup d’œil', s1);
    var gr = el('div', 'grid', null, s1);
    [['Surface', surf ? surf + ' m²' : ''], ['Terrain', data.terrain ? data.terrain + ' m²' : ''], ['Pièces', data.pieces], ['Chambres', data.chambres], ['Étage', data.terrain ? '' : (data.etage && data.etages ? data.etage + ' / ' + data.etages : data.etage)], ['Année', data.annee], ['État', data.etat], ['Atouts', data.specs]].forEach(function (p) {
      if (!p[1]) { return; }
      var kx = el('div', 'k', null, gr); el('span', null, p[0], kx); el('b', null, p[1], kx);
    });
    if (compsEl) { doc.appendChild(compsEl); if (map) { map.invalidateSize(); } }
    var s2 = el('section', 's', null, doc); el('h2', null, 'Comment nous avons établi ce prix', s2);
    var ul = el('ul', 'h', null, s2);
    ['Analyse du marché local et des ventes récentes comparables.', 'Prise en compte de la surface, de l’étage, de l’état et des atouts du bien.', 'Fourchette volontairement large : seule une visite permet de la resserrer.'].forEach(function (t) { el('li', null, t, ul); });
    var s3 = el('section', 's', null, doc); el('h2', null, 'Pour aller plus loin', s3);
    var ol = el('ol', 'next', null, s3);
    ['Visite de votre bien pour affiner l’estimation.', 'Avis de valeur définitif et stratégie de mise en vente.', 'Diffusion et accompagnement jusqu’à la signature.'].forEach(function (t) { el('li', null, t, ol); });
    var s4 = el('section', 's', null, doc); var ced = el('div', 'ced', null, s4);
    var ph = el('img', null, null, ced); ph.src = '/assets/img/cedric-brachet.webp'; ph.alt = 'Cédric Brachet';
    var cd = el('div', null, null, ced);
    var p1 = el('p', null, null, cd); el('b', null, 'Cédric Brachet', p1);
    el('p', null, 'Votre interlocuteur Immodrim', cd).style.color = 'var(--muted)';
    el('p', null, '06 83 09 70 95 · cbrachet@immodrim.com', cd);
    var cta = el('a', 'cta', 'Prendre rendez-vous', cd); cta.href = 'https://immodrim.com/#contact';
    el('footer', 'legal', 'Estimation indicative, non contractuelle, établie à partir des informations que vous avez communiquées et de l’analyse du marché local. Elle ne constitue pas une expertise. Immodrim, SARL au capital de 2 500 € – carte professionnelle « Transactions sur immeubles et fonds de commerce » – sans détention de fonds.', doc);
    doc.hidden = false;
  }

  function setStatus(t, cls) { status.textContent = t; status.className = 'status' + (cls ? ' ' + cls : ''); }

  var isDemo = qs.get('demo') === '1';
  if (!isDemo && (!id || !k)) { msg.textContent = 'Lien incomplet.'; return; }
  (isDemo ? Promise.resolve(DEMO) : fetch(SHEET_URL + '?id=' + encodeURIComponent(id) + '&k=' + encodeURIComponent(k)).then(function (r) { return r.json(); }))
    .then(function (d) {
      if (d.error) { msg.textContent = d.error === 'forbidden' ? 'Accès refusé.' : 'Fiche introuvable.'; return; }
      data = d; msg.hidden = true;
      low.value = d.fourchette_basse || ''; high.value = d.fourchette_haute || ''; note.value = d.note_cedric || '';
      if (!viewOnly) { panel.hidden = false; }
      buildComps();
      if (d.statut === 'Validée') { setStatus('Estimation déjà validée. Vous pouvez la modifier et la valider de nouveau.', 'ok'); }
      render(); initMap();
    })
    .catch(function () { msg.textContent = 'Impossible de charger la fiche. Réessayez dans un instant.'; });

  [low, high, note].forEach(function (i) { i.addEventListener('input', function () { if (data) { data.note_cedric = note.value; render(); } }); });
  save.addEventListener('click', function () {
    if (isDemo) { setStatus('Aperçu : la validation est désactivée.', 'err'); return; }
    var lo = num(low.value), hi = num(high.value);
    if (!(lo > 0 && hi >= lo)) { setStatus('Indiquez un prix bas et un prix haut (le haut doit être supérieur ou égal au bas).', 'err'); return; }
    save.disabled = true; setStatus('Enregistrement…');
    fetch(SHEET_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'valider', id: id, k: k, fourchette_basse: lo, fourchette_haute: hi, note_cedric: note.value }) })
      .then(function () { return new Promise(function (res) { setTimeout(res, 1500); }); })
      .then(function () { return fetch(SHEET_URL + '?id=' + encodeURIComponent(id) + '&k=' + encodeURIComponent(k)).then(function (r) { return r.json(); }); })
      .then(function (d) {
        if (d.statut === 'Validée') { setStatus('Estimation validée. Le lien client est la même page avec « &vue=1 » à la fin.', 'ok'); }
        else { setStatus('Enregistrement non confirmé. Réessayez.', 'err'); }
      })
      .catch(function () { setStatus('Échec de l’enregistrement.', 'err'); })
      .then(function () { save.disabled = false; });
  });
})();
