# Immodrim

Site statique de immodrim.com (HTML/CSS/JS, sans framework ni dépendance).
Déploiement : Vercel, sans commande de build, dossier de sortie = racine du dépôt.
Configuration (URLs propres, en-têtes de sécurité, redirections) : `vercel.json`.

Formulaires : envoi direct vers HubSpot (portail 149488423, région EU).
Cookies : `assets/main.js` (CONFIG : ga4Id, metaPixelId) ; rien n'est chargé sans consentement.
