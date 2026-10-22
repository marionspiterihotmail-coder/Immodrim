/* Immodrim — simulateur de capacité d'emprunt : neuf (avec PTZ / Action Logement) ou ancien.
   Parcours en 5 écrans -> HubSpot -> résultat immédiat. Le calcul se fait dans le navigateur. */
(function () {
  'use strict';
  var form = document.getElementById('cap-form');
  if (!form) { return; }

  /* ===== Hypothèses de calcul (à tenir à jour) ===== */
  var HYP = {
    taux: 3.6,          /* taux nominal du prêt principal, hors assurance (%) */
    assurance: 0.30,    /* assurance emprunteur, % par an du capital emprunté */
    endettement: 35,    /* taux d'endettement maximum (%) */
    garantie: 1.3,      /* frais de garantie bancaire, % du prix du bien */
    notaireNeuf: 2.5,   /* frais de notaire dans le neuf (%) */
    notaireAncien: 7.5, /* frais de notaire dans l'ancien (%) */
    alMontant: 30000, alTaux: 1, alDuree: 20,   /* prêt Action Logement */
    ptzDuree: 20, ptzDiffere: 8,                /* PTZ : durée totale et différé moyens (ans) */
    dureeDefaut: 25
  };
  /* Zone PTZ retenue par département (la zone exacte dépend de la commune : on garde la plus prudente) */
  var ZONE = { '75': 'A', '92': 'A', '93': 'A', '94': 'A', '77': 'B1', '78': 'B1', '91': 'B1', '95': 'B1' };
  var CAL_URL = 'https://calendar.app.google/qUj4kktypTnpNeL46';
  var HUBSPOT_URL = 'https://api-eu1.hsforms.com/submissions/v3/integration/submit/149488423/6660e385-b2ea-47ee-ad42-4515968c87e8';

  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var eur = function (n) { return fmt.format(Math.round(n)).replace(/[  ]/g, ' ') + ' €'; };
  var roundK = function (n) { return Math.round(n / 1000) * 1000; };

  /* ===== Moteur de calcul ===== */
  function ptzTables(Z) {
    return {
      RB: { A: 49000, B1: 34500, B2: 31500, C: 28500 }[Z],
      PL: { A: [150000, 225000, 270000, 315000, 360000], B1: [135000, 202500, 243000, 283500, 324000], B2: [110000, 165000, 198000, 231000, 264000], C: [100000, 150000, 180000, 210000, 240000] }[Z],
      TH: { A: [25000, 31000, 37000, 49000], B1: [21500, 26000, 30000, 34500], B2: [18000, 22500, 27000, 31500], C: [15000, 19500, 24000, 28500] }[Z]
    };
  }

  /* p : { rev, cha, app, zone, nbp, rp, primo, al } ; dur en années ; neuf = true/false */
  function engine(p, dur, neuf) {
    var n = Math.round(dur * 12), r = HYP.taux / 1200, a = HYP.assurance / 1200;
    var not = (neuf ? HYP.notaireNeuf : HYP.notaireAncien) / 100, gr = HYP.garantie / 100;
    var A = function (k) { return k <= 0 ? 0 : (r > 0 ? (1 - Math.pow(1 + r, -k)) / r : k); };
    var M = Math.max(0, p.rev * HYP.endettement / 100 - p.cha);
    var pd = HYP.ptzDuree, pf = HYP.ptzDiffere, mm = (pd - pf) * 12;
    var ov = Math.max(0, Math.min(n, pd * 12) - pf * 12);
    var W = ov > 0 ? A(Math.min(n, pd * 12)) - A(pf * 12) : 0;
    var alOn = neuf && p.al, AL = alOn ? HYP.alMontant : 0, rA = HYP.alTaux / 1200, nA = HYP.alDuree * 12;
    var pA = AL > 0 ? (rA > 0 ? AL * rA / (1 - Math.pow(1 + rA, -nA)) : AL / nA) : 0;
    var WA = pA * A(Math.min(nA, n));
    var s = {};
    var solve = function (P) {
      var pm = P > 0 ? P / mm : 0;
      var cap = Math.max(0, (M * A(n) - pm * W - WA) / (1 + a * A(n)));
      var total = cap + P + AL + p.app;
      s = { P: P, pm: pm, cap: cap, total: total, prix: total / (1 + not + gr) };
    };
    var info = { eligible: false, reason: '', tier: -1, quotite: 0, plafond: 0 };
    if (neuf && p.rp && p.primo) {
      var T = ptzTables(p.zone), np = p.nbp;
      var KR = [1, 1.5, 1.8, 2.1, 2.4, 2.7, 3, 3.3][np - 1], KF = [1, 1.5, 1.8, 2.1, 2.4, 2.4, 2.4, 2.4][np - 1];
      var Q = [0.5, 0.4, 0.4, 0.2], plaf = T.PL[Math.min(np, 5) - 1], rfr = p.rev * 12;
      info.plafond = T.RB * KR;
      var tier = function () {
        var rr = Math.max(rfr, s.prix / 9);
        if (rr > T.RB * KR) { return -1; }
        var ra = rr / KF;
        for (var j = 0; j < 4; j++) { if (ra <= T.TH[j]) { return j; } }
        return -1;
      };
      var Pc = 0, t = -1;
      for (var i = 0; i < 80; i++) {
        solve(Pc); t = tier();
        var Pn = t < 0 ? 0 : Math.min(Q[t] * Math.min(s.prix, plaf), t === 0 ? 1.25 * (s.cap + AL) : s.cap + AL);
        if (Math.abs(Pn - Pc) < 1) { break; }
        Pc += (Pn - Pc) * 0.6;
      }
      var P = Math.floor(Pc / 100) * 100; solve(P); t = tier();
      if (t < 0) { P = 0; solve(0); }
      info.tier = t;
      if (P > 0) { info.eligible = true; info.quotite = Q[t]; }
      else if (t < 0) { info.reason = 'ressources'; }
      else { info.reason = 'capacite'; }
    } else {
      solve(0);
      info.reason = !neuf ? 'ancien' : (!p.rp ? 'rp' : 'primo');
    }
    s.M = M; s.n = n; s.AL = AL; s.pA = pA; s.alOn = alOn; s.app = p.app; s.not = not; s.gr = gr;
    s.frais = s.prix * not; s.gar = s.prix * gr; s.ptz = info; s.pd = pd; s.pf = pf;
    return s;
  }

  /* ===== Parcours en écrans ===== */
  var steps = form.querySelectorAll('.estim-step');
  var count = $('cap-count'), status = $('cap-status'), cur = 0;
  var field = function (n) { return form.elements[n]; };
  var digits = function (v) { return parseInt(String(v || '').replace(/\D/g, ''), 10) || 0; };

  var verdict = function () {
    var p = readParams(), box = $('cap-verdict');
    box.textContent = '';
    var mk = function (cls, title, text) {
      var d = document.createElement('div'); d.className = 'aide ' + cls;
      var h = document.createElement('h3'); h.textContent = title; d.appendChild(h);
      var q = document.createElement('p'); q.textContent = text; d.appendChild(q);
      box.appendChild(d); return d;
    };
    var e = engine(p, HYP.dureeDefaut, true), z = e.ptz;
    if (z.eligible) {
      mk('ok', 'Vous semblez éligible au prêt à taux zéro', 'Dans le neuf, le PTZ peut financer jusqu’à ' + Math.round(z.quotite * 100) + ' % du coût retenu de l’opération, sans intérêts. Nous l’ajoutons à votre simulation.');
    } else {
      var why = {
        ressources: 'Vos revenus dépassent le plafond de ressources pour ' + p.nbp + (p.nbp > 1 ? ' personnes' : ' personne') + ' dans cette zone (environ ' + eur(z.plafond) + ' de revenu fiscal de référence).',
        capacite: 'Avec vos charges actuelles, il ne reste pas de capacité de remboursement pour un prêt principal, or le PTZ ne peut pas le dépasser.',
        rp: 'Le PTZ finance uniquement une résidence principale.',
        primo: 'Le PTZ est réservé aux primo-accédants : vous ne devez pas avoir été propriétaire de votre résidence principale ces deux dernières années.'
      }[z.reason];
      mk('no', 'Pas de PTZ dans votre cas', why + ' La comparaison neuf et ancien reste possible.');
    }
    if (p.al) { mk('ok', 'Le prêt Action Logement peut s’ajouter', 'Travailler dans une entreprise privée de 10 salariés ou plus ouvre droit à ce prêt complémentaire à taux réduit, sous conditions. Nous l’ajoutons à votre simulation du neuf.'); }
    else { mk('no', p.alRaw === 'nsp' ? 'Action Logement : à vérifier' : 'Pas de prêt Action Logement', p.alRaw === 'nsp' ? 'Il est réservé aux salariés d’entreprises privées de 10 salariés ou plus. Demandez à votre employeur : si vous y avez droit, votre capacité sera encore plus élevée.' : 'Il est réservé aux salariés d’entreprises privées de 10 salariés ou plus.'); }
  };

  var show = function (i) {
    cur = i;
    steps.forEach(function (st, k) { st.classList.toggle('is-active', k === i); });
    count.textContent = 'Étape ' + (i + 1) + ' sur ' + steps.length;
    form.style.setProperty('--sp', i + 1);
    status.textContent = '';
    if (steps[i].dataset.step === '4') { verdict(); }
    var first = steps[i].querySelector('input[type="text"],input[type="email"]');
    if (first && window.matchMedia('(min-width: 800px)').matches) { first.focus(); }
  };

  var rules = {
    rev: function (v) { var n = digits(v); return n >= 500 && n <= 100000 ? '' : 'Indiquez vos revenus nets mensuels (entre 500 et 100 000 €).'; },
    cha: function (v) { return digits(v) <= 50000 ? '' : 'Montant trop élevé : vérifiez la saisie.'; },
    app: function (v) { return digits(v) <= 5000000 ? '' : 'Montant trop élevé : vérifiez la saisie.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Adresse e-mail invalide. Format attendu : prenom.nom@exemple.fr'; },
    telephone: function (v) {
      var s = v.replace(/[\s.\-()]/g, '');
      return (/^(?:\+33|0033|0)[1-9]\d{8}$/.test(s) || /^\+(?!33)\d{8,14}$/.test(s)) ? '' : 'Numéro invalide. Format attendu : 06 12 34 56 78 ou +33 6 12 34 56 78';
    }
  };
  var errBox = function (el) {
    var box = el.closest('.field'); if (!box) { return null; }
    var m = box.querySelector('.field-err');
    if (!m) { m = document.createElement('small'); m.className = 'field-err'; m.setAttribute('role', 'alert'); box.appendChild(m); }
    return m;
  };
  form.addEventListener('input', function (e) { var f = e.target.closest && e.target.closest('.field'); var m = f && f.querySelector('.field-err'); if (m) { m.textContent = ''; } });
  var validStep = function (i) {
    var ok = true;
    steps[i].querySelectorAll('input,select').forEach(function (el) {
      if (el.type === 'hidden' || el.disabled || !ok) { return; }
      var box = el.closest('.field') || el.closest('.opts'), v = (el.value || '').trim(), msg = '';
      if (el.type !== 'radio' && el.type !== 'checkbox' && rules[el.name] && (v || el.required)) { msg = rules[el.name](v); }
      var bad = !!msg || !el.checkValidity();
      if (box) { box.classList.toggle('invalid', bad); }
      if (!bad) { return; }
      ok = false;
      if (msg) { var eb = errBox(el); if (eb) { eb.textContent = msg; } el.focus(); }
      else if (el.type === 'radio') { status.textContent = 'Merci de choisir une réponse.'; status.className = 'form-status err'; }
      else { el.reportValidity(); }
    });
    return ok;
  };
  form.querySelectorAll('[data-next]').forEach(function (b) { b.addEventListener('click', function () { if (validStep(cur)) { show(cur + 1); } }); });
  form.querySelectorAll('[data-prev]').forEach(function (b) { b.addEventListener('click', function () { show(cur - 1); }); });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && cur < steps.length - 1) { e.preventDefault(); if (validStep(cur)) { show(cur + 1); } }
  });
  /* Montants : chiffres uniquement, espaces de milliers */
  ['rev', 'cha', 'app'].forEach(function (n) {
    field(n).addEventListener('input', function (e) {
      var d = e.target.value.replace(/\D/g, '').slice(0, 8);
      e.target.value = d ? fmt.format(parseInt(d, 10)).replace(/[  ]/g, ' ') : '';
    });
  });

  var readParams = function () {
    var rp = form.querySelector('input[name="rp"]:checked'), pr = form.querySelector('input[name="primo"]:checked'), al = form.querySelector('input[name="al"]:checked');
    var np = form.querySelector('input[name="nbp"]:checked');
    return {
      rev: digits(field('rev').value), cha: digits(field('cha').value), app: digits(field('app').value),
      dep: field('dep').value, zone: ZONE[field('dep').value] || 'B1', nbp: np ? parseInt(np.value, 10) : 2,
      rp: !rp || rp.value === 'Oui', primo: !pr || pr.value === 'Oui', al: !!al && al.value === 'oui', alRaw: al ? al.value : 'non'
    };
  };

  /* ===== Écran d'attente : cycliste ===== */
  var waitBox = $('cap-wait'), waitRaf = 0, waitTimer = 0;
  var legPts = function (hx, hy, px, py) {
    var L1 = 46, L2 = 46, dx = px - hx, dy = py - hy, d = Math.min(Math.sqrt(dx * dx + dy * dy), L1 + L2 - 0.5);
    var a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    var ux = dx / d, uy = dy / d, mx = hx + a * ux, my = hy + a * uy;
    return hx + ',' + hy + ' ' + (mx + hh * uy).toFixed(1) + ',' + (my - hh * ux).toFixed(1) + ' ' + px.toFixed(1) + ',' + py.toFixed(1);
  };
  var startWait = function () {
    form.hidden = true; waitBox.hidden = false;
    var l1 = $('w-leg1'), l2 = $('w-leg2'), msg = $('wait-msg');
    var draw = function (t) {
      var an = t / 1000 * 5;
      l1.setAttribute('points', legPts(136, 98, 152 + 17 * Math.cos(an), 150 + 17 * Math.sin(an)));
      l2.setAttribute('points', legPts(136, 98, 152 + 17 * Math.cos(an + Math.PI), 150 + 17 * Math.sin(an + Math.PI)));
    };
    if (reduce) { draw(0); } else { var loop = function (t) { draw(t); waitRaf = requestAnimationFrame(loop); }; waitRaf = requestAnimationFrame(loop); }
    var msgs = ['Nous calculons votre capacité d’emprunt…', 'Nous comparons le neuf et l’ancien…', 'Nous vérifions vos aides (PTZ, Action Logement)…', 'Nous préparons votre résultat…'], i = 0;
    msg.textContent = msgs[0];
    waitTimer = setInterval(function () { i = (i + 1) % msgs.length; msg.classList.add('fade'); setTimeout(function () { msg.textContent = msgs[i]; msg.classList.remove('fade'); }, 250); }, 1500);
  };
  var stopWait = function () { waitBox.hidden = true; cancelAnimationFrame(waitRaf); clearInterval(waitTimer); };

  /* ===== Résultat ===== */
  var params = null, slider = $('cap-dur'), shown = {}, built = false;
  var SEGS = [['app', 'Apport', 'seg-app'], ['cap', 'Prêt principal', 'seg-cap'], ['P', 'Prêt à taux zéro', 'seg-ptz'], ['AL', 'Action Logement', 'seg-al']];

  var tween = function (el, to) {
    var from = shown[el.id] || 0; shown[el.id] = to;
    if (reduce || from === to) { el.textContent = eur(to); return; }
    var t0 = null, dur = 420;
    var step = function (t) {
      if (t0 === null) { t0 = t; }
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = eur(from + (to - from) * e);
      if (k < 1) { requestAnimationFrame(step); }
    };
    requestAnimationFrame(step);
  };
  var row = function (parent, label, value, cls) {
    var dt = document.createElement('dt'); dt.textContent = label; parent.appendChild(dt);
    var dd = document.createElement('dd'); dd.textContent = value; if (cls) { dd.className = cls; } parent.appendChild(dd);
  };
  var fillDetail = function (id, e, neuf) {
    var dl = $(id); dl.textContent = '';
    row(dl, 'Prix du bien', eur(e.prix), 'strong');
    row(dl, 'Frais de notaire (' + (neuf ? HYP.notaireNeuf : HYP.notaireAncien).toString().replace('.', ',') + ' %)', eur(e.frais));
    row(dl, 'Garantie bancaire (' + HYP.garantie.toString().replace('.', ',') + ' %)', eur(e.gar));
    row(dl, 'Budget total, frais inclus', eur(e.total), 'strong');
    row(dl, 'Votre apport', eur(e.app));
    row(dl, 'Prêt principal', eur(e.cap));
    if (neuf) {
      if (e.P > 0) { row(dl, 'Prêt à taux zéro', eur(e.P)); row(dl, 'Remboursement du PTZ', eur(e.pm) + ' / mois dès l’année ' + (e.pf + 1)); }
      if (e.alOn) { row(dl, 'Prêt Action Logement', eur(e.AL) + ' (' + eur(e.pA) + ' / mois)'); }
    }
  };
  var render = function () {
    var dur = parseInt(slider.value, 10);
    $('cap-dur-out').textContent = dur + ' ans';
    slider.style.setProperty('--pct', ((dur - slider.min) / (slider.max - slider.min) * 100) + '%');
    slider.setAttribute('aria-valuetext', dur + ' ans');
    var en = engine(params, dur, true), ea = engine(params, dur, false);
    var scale = Math.max(en.total, ea.total, 1);
    [['neuf', en, true], ['ancien', ea, false]].forEach(function (x) {
      var k = x[0], e = x[1];
      tween($('cap-prix-' + k), e.prix);
      $('cap-budget-' + k).textContent = 'Budget total, frais inclus : ' + eur(e.total);
      var leg = $('cap-leg-' + k); leg.textContent = '';
      SEGS.forEach(function (sg) {
        var v = e[sg[0]] || 0, seg = $('seg-' + k + '-' + sg[0]);
        if (seg) { seg.style.width = (v / scale * 100) + '%'; seg.hidden = false; }
        if (v > 0.5) {
          var li = document.createElement('li'); var b = document.createElement('b'); b.className = sg[2]; li.appendChild(b);
          li.appendChild(document.createTextNode(sg[1] + ' ' + eur(v))); leg.appendChild(li);
        }
      });
      fillDetail('cap-detail-' + k, e, x[2]);
    });
    var gain = en.prix - ea.prix;
    var why = [];
    if (en.ptz.eligible) { why.push('au prêt à taux zéro'); }
    if (en.alOn) { why.push('au prêt Action Logement'); }
    why.push('aux frais de notaire d’environ 2,5 % au lieu de 7,5 %');
    var whyTxt = why.length > 1 ? why.slice(0, -1).join(', ') + ' et ' + why[why.length - 1] : why[0];
    var gb = $('cap-gain');
    if (en.M <= 0) {
      gb.hidden = false; $('cap-gain-big').textContent = 'Charges élevées';
      $('cap-gain-txt').textContent = 'Vos charges actuelles atteignent le taux d’endettement maximal : aucune mensualité n’est disponible pour un nouveau prêt. Un conseiller peut étudier avec vous les pistes possibles.';
    } else if (gain > 500) {
      gb.hidden = false; $('cap-gain-big').textContent = '+ ' + eur(roundK(gain));
      $('cap-gain-txt').textContent = 'de pouvoir d’achat dans le neuf, grâce ' + whyTxt + '.';
    } else {
      gb.hidden = false; $('cap-gain-big').textContent = 'Comparaison';
      $('cap-gain-txt').textContent = 'Avec vos données, le neuf et l’ancien sont proches. Parlons-en pour trouver la meilleure option.';
    }
    $('cap-mens').textContent = 'Mensualité maximale : ' + eur(en.M) + ' par mois (' + HYP.endettement + ' % de vos revenus' + (params.cha > 0 ? ', moins vos crédits en cours' : '') + ', assurance comprise).';
    $('cap-ptz-note').textContent = en.ptz.eligible
      ? 'Dans le neuf, votre prêt à taux zéro de ' + eur(en.P) + ' est inclus : il se rembourse sans intérêts, après un différé.'
      : (params.rp && params.primo ? 'Le PTZ n’est pas retenu dans cette simulation (voir les conditions ci-dessous).' : '');
    $('cap-ptz-note').hidden = !$('cap-ptz-note').textContent;
    $('cap-neuf-tag').textContent = en.ptz.eligible ? 'Avec PTZ' + (en.alOn ? ' et Action Logement' : '') : (en.alOn ? 'Avec Action Logement' : 'Sans aide');
    $('cap-sub').textContent = 'Simulation du ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · prêt sur ' + dur + ' ans';
  };
  slider.addEventListener('input', render);

  var showResult = function (p) {
    params = p; stopWait();
    $('cap-hero').hidden = true; var res = $('cap-result'); res.hidden = false;
    slider.value = HYP.dureeDefaut; shown = {};
    $('cap-hyp').textContent = 'taux de ' + HYP.taux.toString().replace('.', ',') + ' % hors assurance, assurance de ' + HYP.assurance.toFixed(2).replace('.', ',') + ' % par an, endettement maximal de ' + HYP.endettement + ' %';
    /* barres : on part de zéro puis on anime */
    res.querySelectorAll('.seg').forEach(function (s) { s.style.width = '0%'; });
    window.scrollTo(0, 0);
    requestAnimationFrame(function () { requestAnimationFrame(render); });
    res.setAttribute('tabindex', '-1'); res.focus({ preventScroll: true });
  };
  $('cap-edit').addEventListener('click', function () {
    $('cap-result').hidden = true; $('cap-hero').hidden = false; form.hidden = false; show(0); window.scrollTo(0, 0);
  });

  /* ===== Envoi (HubSpot) puis résultat ===== */
  var consent = function () {
    try {
      var c = JSON.parse(localStorage.getItem('immodrim_consent') || 'null');
      return c && c.expires && Date.now() < c.expires ? { audience: !!c.audience, ads: !!c.ads } : { audience: false, ads: false };
    } catch (x) { return { audience: false, ads: false }; }
  };
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (field('website').value) { return; }
    if (!validStep(cur)) { return; }
    var btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
    var p = readParams(), g = function (n) { var el = field(n); return el ? (el.value || '').trim() : ''; };
    var en = engine(p, HYP.dureeDefaut, true), ea = engine(p, HYP.dureeDefaut, false);
    var lines = [
      'SIMULATION DE CAPACITÉ D’EMPRUNT',
      'Revenus nets mensuels du foyer : ' + p.rev + ' € · Crédits en cours : ' + p.cha + ' €/mois · Apport : ' + p.app + ' €',
      'Département : ' + g('dep') + ' · Personnes dans le logement : ' + p.nbp,
      'Résidence principale : ' + (p.rp ? 'oui' : 'non') + ' · Primo-accédant : ' + (p.primo ? 'oui' : 'non') + ' · Action Logement : ' + ({ oui: 'oui (salarié du privé, 10 salariés et +)', non: 'non', nsp: 'ne sait pas' }[p.alRaw]),
      'Résultat sur ' + HYP.dureeDefaut + ' ans : neuf ' + eur(en.prix) + ' (PTZ : ' + (en.ptz.eligible ? eur(en.P) : 'non') + ', Action Logement : ' + (en.alOn ? 'oui' : 'non') + ') · ancien ' + eur(ea.prix),
      'Civilité : ' + (form.querySelector('input[name="civilite"]:checked') ? form.querySelector('input[name="civilite"]:checked').value : 'non précisée')
    ];
    var payload = { fields: [{ name: 'firstname', value: g('prenom') }, { name: 'lastname', value: g('nom') }, { name: 'email', value: g('email') }, { name: 'phone', value: g('telephone') }, { name: 'message', value: lines.join('\n') }], context: { pageUri: location.href, pageName: document.title } };
    startWait();
    var hubP = fetch(HUBSPOT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) { throw new Error('http ' + r.status); } return true; });
    var guard = new Promise(function (res) { setTimeout(function () { res('lent'); }, 12000); });
    var minWait = new Promise(function (res) { setTimeout(res, reduce ? 600 : 2600); });
    Promise.all([Promise.race([hubP, guard]), minWait]).then(function () {
      if (window.fbq && consent().ads) { window.fbq('track', 'Lead'); }
      if (window.gtag && consent().audience) { window.gtag('event', 'generate_lead', { form: 'capacite-emprunt' }); }
      showResult(p);
    }).catch(function () {
      stopWait(); form.hidden = false;
      status.textContent = 'L’envoi a échoué. Merci de réessayer dans un instant.'; status.className = 'form-status err';
    }).then(function () { btn.disabled = false; });
  });

  show(0);
})();
