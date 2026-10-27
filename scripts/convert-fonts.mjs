// One-time converter: woff2 -> ttf for the PDF-embedded fonts.
// Source: roboto-fontface (pnpm). Output committed to src/assets/fonts/.
// Re-run: node scripts/convert-fonts.mjs
import { decompress } from "wawoff2";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "roboto-fontface", "fonts", "roboto");
const out = join(root, "src", "assets", "fonts");
mkdirSync(out, { recursive: true });

const fonts = ["Roboto-Regular", "Roboto-Bold", "Roboto-RegularItalic"];
for (const name of fonts) {
  const woff2 = readFileSync(join(src, `${name}.woff2`));
  const ttf = await decompress(woff2);
  writeFileSync(join(out, `${name}.ttf`), Buffer.from(ttf));
  console.log(`${name}.ttf`, ttf.length, "bytes");
}
