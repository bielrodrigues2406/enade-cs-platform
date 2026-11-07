// Formas de responder do ENADE (docs/ENADE-ITEM-FORMATS.md). Nos itens e na
// asserção-razão as alternativas seguem o molde fixo da prova: o arquivo diz só
// o que é verdadeiro, e a letra é calculada aqui. Assim o tamanho da alternativa
// não denuncia a resposta e não há letra trocada à mão.

export const LETTERS = ["A", "B", "C", "D", "E"] as const;
export type Letter = (typeof LETTERS)[number];
export const FORMATS = ["SIMPLES", "ITENS3", "ITENS4", "ASSERCAO", "ORDEM", "CALCULO", "CODIGO_OPCOES", "ASSOCIACAO"] as const;
export type Format = (typeof FORMATS)[number];
export const STIMULI = ["TEXTO_BASE", "CENARIO", "CODIGO", "TABELA", "FIGURA", "GRAFICO", "DOIS_TEXTOS", "CHARGE"] as const;
/** Formatos cujas alternativas saem do molde, sem `options` nem `answer` no arquivo. */
export const TEMPLATED: readonly Format[] = ["ITENS3", "ITENS4", "ASSERCAO"];

const ROMAN = ["I", "II", "III", "IV"] as const;
type Roman = (typeof ROMAN)[number];

/** Conjunto mais usado de 2014 a 2021 para três afirmações. */
export const DEFAULT_ITENS3: Roman[][] = [["I"], ["II"], ["I", "III"], ["II", "III"], ["I", "II", "III"]];

/** "I, apenas." · "I e III, apenas." · "I, II e III." (todas, sem "apenas"). */
export function comboText(combo: readonly Roman[], total: number) {
  const list = combo.length === 1 ? combo[0] : `${combo.slice(0, -1).join(", ")} e ${combo[combo.length - 1]}`;
  return combo.length === total ? `${list}.` : `${list}, apenas.`;
}

const rank = (item: Roman) => ROMAN.indexOf(item);
/** Ordem da prova: das combinações menores para as maiores; no mesmo tamanho, pela numeração. */
function compareCombos(a: readonly Roman[], b: readonly Roman[]) {
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return rank(a[i]) - rank(b[i]);
  return 0;
}

function parseCombo(value: unknown, total: number, where: string): Roman[] {
  if (!Array.isArray(value) || !value.length) throw new Error(`${where}: combinação vazia.`);
  const items = value.map(String) as Roman[];
  const allowed = ROMAN.slice(0, total) as readonly string[];
  if (items.some((item) => !allowed.includes(item)) || new Set(items).size !== items.length)
    throw new Error(`${where}: combinação com item inválido.`);
  return [...items].sort((x, y) => rank(x) - rank(y));
}

/** Itens I, II, III (e IV): opções no molde e letra da combinação verdadeira. */
export function itemsOptions(data: any, format: "ITENS3" | "ITENS4", where: string) {
  const total = format === "ITENS3" ? 3 : 4;
  const truth = parseCombo(data.truth, total, `${where}.truth`);
  if (data.combos === undefined && format === "ITENS4") throw new Error(`${where}: ITENS4 precisa de "combos".`);
  const raw = data.combos === undefined ? DEFAULT_ITENS3 : data.combos;
  if (!Array.isArray(raw) || raw.length !== 5) throw new Error(`${where}: são cinco combinações.`);
  const combos = raw.map((c: unknown, i: number) => parseCombo(c, total, `${where}.combos[${i}]`)).sort(compareCombos);
  const keys = combos.map((c: Roman[]) => c.join(","));
  if (new Set(keys).size !== 5) throw new Error(`${where}: combinações repetidas.`);
  const index = keys.indexOf(truth.join(","));
  if (index < 0) throw new Error(`${where}: a combinação verdadeira não está entre as alternativas.`);
  return { options: combos.map((c: Roman[]) => comboText(c, total)), answer: LETTERS[index], truth };
}

export const ASSERTION_OPTIONS = [
  "As asserções I e II são proposições verdadeiras, e a II é uma justificativa correta da I.",
  "As asserções I e II são proposições verdadeiras, mas a II não é uma justificativa correta da I.",
  "A asserção I é uma proposição verdadeira, e a II é uma proposição falsa.",
  "A asserção I é uma proposição falsa, e a II é uma proposição verdadeira.",
  "As asserções I e II são proposições falsas.",
] as const;

/** Asserção-razão: as cinco alternativas fixas e a letra pelo valor de cada asserção. */
export function assertionOptions(data: any, where: string) {
  const a = data.assertion;
  if (!a || typeof a.first !== "boolean" || typeof a.second !== "boolean")
    throw new Error(`${where}: "assertion" pede first e second (verdadeiro ou falso).`);
  if (a.first && a.second && typeof a.justifies !== "boolean")
    throw new Error(`${where}: com as duas verdadeiras, diga se a II justifica a I.`);
  if (!(a.first && a.second) && a.justifies !== undefined)
    throw new Error(`${where}: "justifies" só existe com as duas asserções verdadeiras.`);
  const index = a.first && a.second ? (a.justifies ? 0 : 1) : a.first ? 2 : a.second ? 3 : 4;
  return { options: [...ASSERTION_OPTIONS], answer: LETTERS[index] };
}

/** Sequência: as cinco alternativas são ordens diferentes dos mesmos passos. */
export function checkSequence(options: string[], where: string) {
  const steps = (option: string) => option.replace(/\.$/, "").split(/\s*(?:,|→)\s*|\s+e\s+(?=[^,]*$)/).map((s) => s.trim()).filter(Boolean);
  const base = steps(options[0]).sort().join("|");
  if (steps(options[0]).length < 3) throw new Error(`${where}: uma sequência tem pelo menos três passos.`);
  if (options.some((o) => steps(o).sort().join("|") !== base)) throw new Error(`${where}: as alternativas de ORDEM usam os mesmos passos.`);
}

/** Itens numerados que o enunciado precisa trazer para cada formato. */
export function checkPromptShape(prompt: string, format: Format, where: string) {
  const has = (roman: string) => new RegExp(`(^|\\n)${roman}\\. `).test(prompt);
  if (format === "ITENS3" && !(has("I") && has("II") && has("III") && !has("IV")))
    throw new Error(`${where}: ITENS3 traz exatamente as afirmações I., II. e III.`);
  if (format === "ITENS4" && !(has("I") && has("II") && has("III") && has("IV")))
    throw new Error(`${where}: ITENS4 traz as afirmações I. a IV.`);
  if (format === "ASSERCAO" && !(has("I") && has("II") && /\nPORQUE\n/.test(prompt)))
    throw new Error(`${where}: ASSERCAO traz "I.", uma linha "PORQUE" e "II.".`);
}
