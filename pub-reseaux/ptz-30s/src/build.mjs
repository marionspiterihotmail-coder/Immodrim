// Génère les deux formats à partir du gabarit commun.
//   index.html  1080×1920 (9:16) : Reels, Stories, Facebook Reels
//   feed/index.html 1080×1350 (4:5)  : fil Instagram / Facebook
import { readFileSync, writeFileSync, mkdirSync, existsSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tpl = readFileSync(join(root, "src/ptz.template.html"), "utf8");
const formats = [
  { file: "index.html", W: 1080, H: 1920, RES: "portrait", TOP: 250, BOTTOM: 520, SIDE_R: 120, CLASS: "story" },
  { file: "feed/index.html", W: 1080, H: 1350, RES: "custom", TOP: 80, BOTTOM: 80, SIDE_R: 84, CLASS: "feed" },
];
// Le format 4:5 est un projet à part (une seule composition racine par dossier)
mkdirSync(join(root, "feed"), { recursive: true });
if (!existsSync(join(root, "feed/assets"))) symlinkSync("../assets", join(root, "feed/assets"));
for (const f of formats) {
  const out = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(f[k]));
  writeFileSync(join(root, f.file), out);
  console.log(`${f.file} ${f.W}x${f.H}`);
}
