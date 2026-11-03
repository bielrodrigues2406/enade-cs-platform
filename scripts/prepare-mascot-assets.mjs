/** Derivados WebP sem perdas; enquadramento e articulação ficam no CSS do componente. */
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "design/mascot/articulated");
const output = path.join(root, "apps/web/public/mascot/articulated");
const layers = ["body", "head", "left-wing", "right-wing", "open-eyes", "closed-eyes"];
const command = ["magick", "convert"].find(candidate => {
  try {
    return execFileSync(candidate, ["-version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).includes("ImageMagick");
  } catch { return false; }
});
if (!command) throw new Error("Instale ImageMagick 6 ou 7 para preparar os ativos do mascote.");

await mkdir(output, { recursive: true });
for (const layer of layers) {
  execFileSync(command, [
    path.join(source, `${layer}.png`),
    "-define", "webp:lossless=true", "-define", "webp:method=6",
    path.join(output, `${layer}.webp`),
  ], { stdio: "inherit" });
  console.log(`Mascote: ${layer}.webp`);
}
