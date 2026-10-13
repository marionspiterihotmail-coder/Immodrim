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
    [['Surface', surf ? surf + ' m²' : ''], ['Terrain', data.terrain ? data.terrain + ' m²' : ''], ['Pièces', data.pieces], ['Chambres', data.chambres], ['Étage', data.etage && data.etages ? data.etage + ' / ' + data.etages : data.etage], ['Année', data.annee], ['État', data.etat], ['Atouts', data.specs]].forEach(function (p) {
      if (!p[1]) { return; }
      var kx = el('div', 'k', null, gr); el('span', null, p[0], kx); el('b', null, p[1], kx);
    });
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

  if (!id || !k) { msg.textContent = 'Lien incomplet.'; return; }
  fetch(SHEET_URL + '?id=' + encodeURIComponent(id) + '&k=' + encodeURIComponent(k))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { msg.textContent = d.error === 'forbidden' ? 'Accès refusé.' : 'Fiche introuvable.'; return; }
      data = d; msg.hidden = true;
      low.value = d.fourchette_basse || ''; high.value = d.fourchette_haute || ''; note.value = d.note_cedric || '';
      if (!viewOnly) { panel.hidden = false; }
      if (d.statut === 'Validée') { setStatus('Estimation déjà validée. Vous pouvez la modifier et la valider de nouveau.', 'ok'); }
      render();
    })
    .catch(function () { msg.textContent = 'Impossible de charger la fiche. Réessayez dans un instant.'; });

  [low, high, note].forEach(function (i) { i.addEventListener('input', function () { if (data) { data.note_cedric = note.value; render(); } }); });
  save.addEventListener('click', function () {
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
