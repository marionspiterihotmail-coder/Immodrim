# Pub vidéo « PTZ » — Facebook & Instagram (30 s)

Adaptation vidéo du carrousel *Carrousel_PTZ_Immodrim_Canva*, montée avec
[HyperFrames](https://hyperframes.heygen.com) dans la charte Immodrim (violet
`#4b3be0`, `#2e2394`, `#eef4ff`, accent `#7fd6ff`, police Figtree, motif maison).

## Fichiers à publier (`exports/`)

| Fichier | Format | Placements Meta |
|---|---|---|
| `ptz-immodrim-9x16.mp4` | 1080×1920, 30 s, H.264 + AAC | Reels Instagram/Facebook, Stories |
| `ptz-immodrim-4x5.mp4` | 1080×1350, 30 s, H.264 + AAC | Fil Instagram, fil Facebook |
| `couverture-*.jpg` | image « 50 % » | miniature / couverture |
| `ptz-immodrim-bande-son.wav` | voix + musique | référence d'écoute |

En 9:16, les textes restent hors des zones couvertes par l'interface Reels
(250 px en haut, 520 px en bas, 120 px à droite). Son mixé à environ −12 LUFS,
crête à −1 dBFS. Tous les messages sont aussi écrits à l'écran, donc la vidéo
reste lisible sans le son.

## Déroulé (120 BPM, coupes sur le temps)

| Temps | Scène | Voix off |
|---|---|---|
| 0 – 3 s | « Un prêt à **0 %**. Oui, ça existe. » | Un prêt à zéro pour cent ? Oui, ça existe ! |
| 3 – 8 s | Un prêt de l'État, sans intérêts + barre PTZ / prêt bancaire | C'est le PTZ : un prêt de l'État, sans intérêts, qui s'ajoute à votre prêt bancaire. |
| 8 – 11,5 s | Pour qui ? Les primo-accédants (2 conditions) | Il est réservé aux primo-accédants, sous conditions de revenus. |
| 11,5 – 14,5 s | NEUF / ANCIEN | Pour un logement neuf, partout. Ou dans l'ancien, avec travaux. |
| 14,5 – 18 s | Compteur 0 → **50 %** | Et il peut financer jusqu'à cinquante pour cent de votre achat ! |
| 18 – 20,5 s | Bon à savoir (3 points) | Attention : résidence principale uniquement. |
| 20,5 – 25,5 s | Vous êtes éligible ? (vidéo) + « Sans engagement » | Vous êtes éligible ? Un conseiller Immodrim étudie votre projet, sans engagement. |
| 25,5 – 30 s | Logo, « Parlons de votre projet. », Contactez-nous, mentions | Immodrim. Parlons de votre projet. |

## La voix

La voix actuelle est une **voix provisoire** générée en local par HyperFrames
(`npx hyperframes tts`, modèle Kokoro, voix française `ff_siwis`). Elle sert à
caler le rythme. Google Flow n'a pas pu être branché depuis l'environnement de
travail : il n'expose pas d'API et aucun compte Google n'y était connecté.

### Remplacer la voix par une voix Google

Google Flow sert surtout à générer des plans vidéo (Veo). Pour obtenir une voix
seule, le plus simple est **Google AI Studio → Generate speech** (Gemini TTS).

Consigne de style à coller dans la case « Style instructions » :

> Voix féminine française, chaleureuse et souriante, ton de publicité radio
> moderne : dynamique, enjouée et rassurante, débit soutenu mais très
> articulé. Petite montée d'enthousiasme sur « Oui, ça existe ! » et sur
> « cinquante pour cent ». Ton plus posé et bienveillant sur « sans
> engagement ».

Générez ensuite **une phrase à la fois** (texte de la colonne « Voix off »
ci-dessus) et respectez les durées maximales pour que chaque phrase tienne dans
sa scène :

| Fichier | Durée max |
|---|---|
| `assets/vo/l1.wav` | 2,5 s |
| `assets/vo/l2.wav` | 4,7 s |
| `assets/vo/l3.wav` | 3,3 s |
| `assets/vo/l4.wav` | 2,9 s |
| `assets/vo/l5.wav` | 3,3 s |
| `assets/vo/l6.wav` | 2,3 s |
| `assets/vo/l7.wav` | 4,7 s |
| `assets/vo/l8.wav` | 4,0 s |

Remplacez les fichiers `assets/vo/l1.wav` à `l8.wav`, puis refaites le mixage et
le rendu (voir plus bas).

## Musique et bruitages

La musique (pop électro à 120 BPM : kick, clap, basse, arpège) et les bruitages
(whoosh sur chaque coupe, impact sur « 0 % » et « 50 % », tic du compteur,
carillon final) sont **synthétisés par `audio/build_audio.py`**. Il n'y a donc
aucun droit musical à gérer. La musique baisse automatiquement sous la voix.

## Modifier et refaire le rendu

Prérequis : Node 22 ou plus, FFmpeg et Python 3 (`pip install numpy scipy soundfile pyloudnorm`).

```bash
cd pub-reseaux/ptz-30s
python3 audio/build_audio.py          # voix + musique → assets/audio/{vo,bed,mix}.wav
node src/build.mjs                    # gabarit → index.html (9:16) et feed/index.html (4:5)
npx hyperframes@0.8.156 lint .
npx hyperframes@0.8.156 render . -o exports/ptz-immodrim-9x16.mp4 -q high --video-bitrate 12M
npx hyperframes@0.8.156 render feed -o exports/ptz-immodrim-4x5.mp4 -q high --video-bitrate 10M
npx hyperframes@0.8.156 preview      # studio de prévisualisation dans le navigateur
```

Modifiez toujours `src/ptz.template.html` : `index.html` et `feed/index.html`
sont regénérés. Si une phrase change de durée, ajustez `VO_STARTS` dans
`audio/build_audio.py` et les temps de la timeline GSAP dans le gabarit.

## À valider avant diffusion

- **Mention légale crédit** : la carte de fin affiche « Un crédit vous engage et
  doit être remboursé. Vérifiez vos capacités de remboursement avant de vous
  engager. » Faites valider la formulation (et le statut IOBSP le cas échéant)
  par la personne en charge de la conformité.
- **Chiffres PTZ** : 50 %, zones B2/C et 25 % de travaux reprennent le carrousel.
  Vérifiez qu'ils sont toujours à jour au moment de diffuser.
- **Droits des visuels** : les photos (`card-*.webp`, `hero-salon`) et la vidéo
  Mixkit viennent du site. Vérifiez que leurs licences couvrent un usage
  publicitaire payant.
