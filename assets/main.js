/* Immodrim — scripts. Aucun traceur n'est chargé avant le consentement de l'utilisateur. */
(function () {
  'use strict';

  /* ===== À renseigner avant la mise en ligne ===== */
  var CONFIG = {
    ga4Id: '',          // ex. 'G-XXXXXXXXXX' (laisser vide = pas de mesure d'audience)
    metaPixelId: '',    // ex. '1234567890' (laisser vide = pas de pixel Meta)
    consentMonths: 6    // recommandation CNIL : renouveler le choix au plus tard tous les 6 mois
  };

  /* ===== Numéro de version (discret, pied de page) : à mettre à jour à chaque mise en ligne ===== */
  var VERSION = 'v1.3 · 10 oct. 2026';
  var note = document.querySelector('.legal-note');
  if (note) {
    var ver = document.createElement('span');
    ver.className = 'site-version';
    ver.textContent = ' ' + VERSION;
    note.appendChild(ver);
  }

  /* ===== Apparition douce au scroll (désactivée si l'utilisateur préfère moins d'animations) ===== */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduce) {
    document.documentElement.classList.add('js');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    document.querySelectorAll('.section-head, .why-head, .card, .steps li, .faq details, .panel').forEach(function (el) {
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  /* ===== Mouvement au scroll (accueil) : parallaxe, cartes empilées, ligne de temps, citation, compteurs ===== */
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var heroVideo = document.querySelector('.home .hero-video');
  var parallax = document.querySelectorAll('[data-parallax], [data-parallax-orb]');
  var timelines = document.querySelectorAll('[data-progress]');
  var quote = document.querySelector('[data-words]');
  var words = quote ? quote.querySelectorAll('.w') : [];
  var stack = document.querySelectorAll('.why-card');
  var counters = document.querySelectorAll('[data-count]');

  if (reduce) {
    document.querySelectorAll('.timeline').forEach(function (t) { t.style.setProperty('--p', 1); t.querySelectorAll('li').forEach(function (li) { li.classList.add('on'); }); });
  } else {
    if (quote) { quote.parentNode.classList.add('js-words'); }
    var ticking = false;
    var update = function () {
      ticking = false;
      var vh = window.innerHeight, y = window.scrollY;
      if (heroVideo && y < vh * 1.2) { heroVideo.style.setProperty('--hy', (y * 0.18).toFixed(1) + 'px'); }
      parallax.forEach(function (el) {
        var r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -150 || r.top > vh + 150) { return; }
        var c = (r.top + r.height / 2 - vh / 2);
        var k = el.hasAttribute('data-parallax-orb') ? 0.12 : 0.1;
        el.style.setProperty('--py', (-c * k).toFixed(1) + 'px');
      });
      timelines.forEach(function (sec) {
        var tl = sec.querySelector('.timeline'); if (!tl) { return; }
        var r = tl.getBoundingClientRect();
        tl.style.setProperty('--p', clamp((vh * 0.62 - r.top) / r.height, 0, 1).toFixed(3));
        tl.querySelectorAll('li').forEach(function (li) { li.classList.toggle('on', li.getBoundingClientRect().top < vh * 0.62); });
      });
      if (words.length) {
        var qr = quote.getBoundingClientRect();
        var p = clamp((vh * 0.8 - qr.top) / (qr.height + vh * 0.25), 0, 1);
        var n = Math.round(p * words.length);
        words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
      }
      stack.forEach(function (card, i) {
        var next = stack[i + 1];
        if (!next) { return; }
        var h = card.offsetHeight;
        var stuck = parseFloat(getComputedStyle(next).top) || 0;
        var t = clamp(1 - (next.getBoundingClientRect().top - stuck) / (h * 0.9), 0, 1);
        card.style.setProperty('--s', (1 - 0.045 * t).toFixed(3));
      });
    };
    var onScroll = function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    /* Compteurs : de 0 à la valeur finale quand la bande entre à l'écran */
    if ('IntersectionObserver' in window && counters.length) {
      var co = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) { return; }
          co.unobserve(en.target);
          var el = en.target, to = parseFloat(el.getAttribute('data-count')), dec = parseInt(el.getAttribute('data-dec') || '0', 10);
          var suf = (el.getAttribute('data-suffix') || '').replace(' ', '\u00a0'), t0 = null, dur = 1600;
          var step = function (ts) {
            if (t0 === null) { t0 = ts; }
            var k = clamp((ts - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
            el.textContent = (to * e).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
            if (k < 1) { window.requestAnimationFrame(step); }
          };
          window.requestAnimationFrame(step);
        });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { co.observe(el); });
    }
  }

  /* ===== Menu mobile ===== */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ===== Préremplissage du type de projet depuis les liens ===== */
  document.querySelectorAll('[data-projet]').forEach(function (el) {
    el.addEventListener('click', function () {
      var select = document.getElementById('projet');
      if (select) { select.value = el.getAttribute('data-projet'); }
    });
  });

  /* ===== Vidéo du hero : désactivée si l'utilisateur préfère moins d'animations ou économise des données ===== */
  var hv = document.querySelector('.hero-video');
  if (hv) {
    var conn = navigator.connection || {};
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || conn.saveData) {
      hv.removeAttribute('autoplay'); hv.pause();
    }
  }

  /* ===== Formulaire de contact ===== */
  var HUBSPOT_URL = 'https://api-eu1.hsforms.com/submissions/v3/integration/submit/149488423/6660e385-b2ea-47ee-ad42-4515968c87e8';
  var form = document.getElementById('contact-form');
  if (form) {
    var status = document.getElementById('form-status');
    var setStatus = function (msg, cls) {
      status.textContent = msg;
      status.className = 'form-status ' + cls;
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.querySelector('[name="website"]').value) { return; } // champ piège anti-spam
      if (!form.checkValidity()) {
        form.reportValidity();
        setStatus('Merci de compléter les champs obligatoires.', 'err');
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      setStatus('Envoi en cours…', '');
      var v = function (n) { return (form.elements[n] && form.elements[n].value || '').trim(); };
      var projet = form.elements.projet ? form.elements.projet.options[form.elements.projet.selectedIndex].text : '';
      var ville = form.getAttribute('data-ville');
      var msg = 'Projet : ' + projet + (ville ? '\nVille recherchée : ' + ville : '') + (v('message') ? '\n\n' + v('message') : '');
      var payload = {
        fields: [
          { name: 'firstname', value: v('prenom') },
          { name: 'lastname', value: v('nom') },
          { name: 'email', value: v('email') },
          { name: 'phone', value: v('telephone') },
          { name: 'message', value: msg }
        ],
        context: { pageUri: location.href, pageName: document.title }
      };
      fetch(HUBSPOT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) { throw new Error('http ' + r.status); }
        form.reset();
        setStatus('Merci, votre demande est bien envoyée. Nous revenons vers vous rapidement.', 'ok');
        if (window.fbq && getConsent().ads) { window.fbq('track', 'Lead'); }
      }).catch(function () {
        setStatus("L'envoi a échoué. Merci de réessayer dans un instant.", 'err');
      }).then(function () { btn.disabled = false; });
    });
  }

  /* ===== Simulateur d'estimation (formulaire en 3 étapes -> HubSpot) ===== */
  var est = document.getElementById('estim-form');
  if (est) {
    var steps = est.querySelectorAll('.estim-step');
    var dots = est.querySelectorAll('[data-step-dot]');
    var estStatus = document.getElementById('estim-status');
    var cur = 0;
    var show = function (i) {
      cur = i;
      steps.forEach(function (st, k) { st.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-current', k === i); d.classList.toggle('is-done', k < i); });
      estStatus.textContent = '';
      var first = steps[i].querySelector('input,select');
      if (first && window.matchMedia('(min-width: 800px)').matches) { first.focus(); }
    };
    var validStep = function (i) {
      var ok = true;
      steps[i].querySelectorAll('input,select').forEach(function (el) {
        var bad = !el.checkValidity();
        if (el.parentNode.classList) { el.parentNode.classList.toggle('invalid', bad); }
        if (bad && ok) { el.reportValidity(); ok = false; }
      });
      return ok;
    };
    est.querySelectorAll('[data-next]').forEach(function (b) { b.addEventListener('click', function () { if (validStep(cur)) { show(cur + 1); } }); });
    est.querySelectorAll('[data-prev]').forEach(function (b) { b.addEventListener('click', function () { show(cur - 1); }); });
    show(0);
    est.addEventListener('submit', function (e) {
      e.preventDefault();
      if (est.querySelector('[name="website"]').value) { return; }
      if (!validStep(cur)) { return; }
      var btn = est.querySelector('button[type="submit"]');
      btn.disabled = true;
      estStatus.textContent = 'Envoi en cours…'; estStatus.className = 'form-status';
      var g = function (n) { return (est.elements[n] && est.elements[n].value || '').trim(); };
      var lines = [
        'DEMANDE D\'ESTIMATION (simulateur)',
        'Type : ' + g('type'), 'Adresse : ' + g('adresse') + ', ' + g('cp') + ' ' + g('ville'),
        'Surface : ' + g('surface') + ' m²', 'Pièces : ' + g('pieces'), 'État : ' + g('etat'),
        'Construction : ' + (g('annee') || 'non précisé'), 'Étage : ' + (g('etage') || 'non précisé'),
        'Extérieur : ' + (g('exterieur') || 'aucun'), 'Projet de vente : ' + g('delai')
      ];
      var payload = {
        fields: [
          { name: 'firstname', value: g('prenom') }, { name: 'lastname', value: g('nom') },
          { name: 'email', value: g('email') }, { name: 'phone', value: g('telephone') },
          { name: 'message', value: lines.join('\n') }
        ],
        context: { pageUri: location.href, pageName: document.title }
      };
      fetch(HUBSPOT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) {
          if (!r.ok) { throw new Error('http ' + r.status); }
          est.hidden = true;
          var t = document.getElementById('estim-thanks');
          t.hidden = false; t.focus();
          if (window.fbq && getConsent().ads) { window.fbq('track', 'Lead'); }
          if (window.gtag && getConsent().audience) { window.gtag('event', 'generate_lead', { form: 'estimation' }); }
        })
        .catch(function () { estStatus.textContent = "L'envoi a échoué. Merci de réessayer dans un instant."; estStatus.className = 'form-status err'; })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ===== Consentement cookies (conforme CNIL : refuser aussi simple qu'accepter) ===== */
  var KEY = 'immodrim_consent';
  var banner = document.getElementById('cookie-banner');
  var prefs = document.getElementById('cookie-prefs');
  var chkAudience = document.getElementById('pref-audience');
  var chkAds = document.getElementById('pref-ads');

  function getConsent() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) { return { set: false, audience: false, ads: false }; }
      var c = JSON.parse(raw);
      if (!c.expires || Date.now() > c.expires) { localStorage.removeItem(KEY); return { set: false, audience: false, ads: false }; }
      return { set: true, audience: !!c.audience, ads: !!c.ads };
    } catch (err) { return { set: false, audience: false, ads: false }; }
  }
  function saveConsent(audience, ads) {
    var expires = Date.now() + CONFIG.consentMonths * 30 * 24 * 3600 * 1000;
    try { localStorage.setItem(KEY, JSON.stringify({ audience: audience, ads: ads, expires: expires })); } catch (err) { /* stockage indisponible */ }
    banner.hidden = true;
    applyConsent({ audience: audience, ads: ads });
  }
  function loadScript(src) {
    var s = document.createElement('script');
    s.src = src; s.async = true;
    document.head.appendChild(s);
  }
  var loaded = { ga: false, meta: false };
  function applyConsent(c) {
    if (c.audience && CONFIG.ga4Id && !loaded.ga) {
      loaded.ga = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', CONFIG.ga4Id, { anonymize_ip: true });
      loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.ga4Id));
    }
    if (c.ads && CONFIG.metaPixelId && !loaded.meta) {
      loaded.meta = true;
      (function (f, b, e, v, n, t, s) {
        if (f.fbq) { return; }
        n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) { f._fbq = n; }
        n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = true; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', CONFIG.metaPixelId);
      window.fbq('track', 'PageView');
    }
  }
  function openSettings() {
    var c = getConsent();
    chkAudience.checked = c.audience;
    chkAds.checked = c.ads;
    banner.hidden = false;
    var h = banner.querySelector('h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  }

  if (banner) {
    var current = getConsent();
    if (current.set) { applyConsent(current); } else { banner.hidden = false; }

    document.getElementById('cookie-accept').addEventListener('click', function () { saveConsent(true, true); });
    document.getElementById('cookie-refuse').addEventListener('click', function () { saveConsent(false, false); });
    document.getElementById('cookie-custom').addEventListener('click', function () {
      var hidden = prefs.hidden;
      prefs.hidden = !hidden;
      this.setAttribute('aria-expanded', String(hidden));
    });
    document.getElementById('cookie-save').addEventListener('click', function () {
      saveConsent(chkAudience.checked, chkAds.checked);
    });
    document.querySelectorAll('[data-cookie-settings]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); prefs.hidden = false; openSettings(); });
    });
  }
})();
