import { existsSync } from "node:fs";
import path from "node:path";

// Figuras e ilustrações citadas no conteúdo (questões geradas, lições) precisam
// existir onde a tela as busca. Na imagem Docker o front compilado fica em
// WEB_DIST e a árvore de fontes não existe; no checkout, ficam em
// apps/web/public. Procurar só na fonte quebrava a produção (revisão do Codex,
// R1, docs/reviews/2026-11-07-claude-review.md).

/** Pastas onde os arquivos públicos podem estar, na ordem de preferência. */
export function publicRoots(): string[] {
  return [process.env.WEB_DIST, path.resolve("apps/web/public")].filter((dir): dir is string => Boolean(dir));
}

/** true se `src` (como "/figures/x.svg") existe em alguma das pastas servidas. */
export function publicAssetExists(src: string, roots = publicRoots()) {
  return roots.some((root) => existsSync(path.join(root, src.replace(/^\/+/, ""))));
}
