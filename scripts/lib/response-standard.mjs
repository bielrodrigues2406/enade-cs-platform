// Padrão de resposta das discursivas (DISC-1). O Inep publica um PDF por
// prova com um bloco "PADRÃO DE RESPOSTA" por discursiva; algumas edições
// repetem o enunciado antes do bloco, outras não. Aqui só se propõem caixas
// e itens de avaliação: quem confere ajusta na tela do importador.
import { contentWords, groupLines, lineHeader, lineText, pageBands } from "./question-extraction.mjs";

// O título do documento ("PADRÃO DE RESPOSTA DAS QUESTÕES DISCURSIVAS") não abre bloco.
const MARKER = /^PADR[ÃA]O DE RESPOSTA(?!S?\s+DAS?\s+QUEST)/i;
const PAD = 6;

/** Linhas de conteúdo de todas as páginas, em ordem de leitura (coluna única). */
function documentLines(pages) {
  return pages.flatMap((page, index) =>
    groupLines(contentWords(page, pageBands(page))).map((line) => ({ ...line, page: index + 1 })));
}

function boxesBetween(pages, start, end) {
  const boxes = [];
  for (let p = start.page; p <= end.page; p++) {
    const page = pages[p - 1];
    const from = p === start.page ? start.y : 0;
    const to = p === end.page ? end.y : page.height;
    const words = contentWords(page, pageBands(page)).filter((w) => w.yMin >= from - 1 && w.yMax <= to + 1);
    if (!words.length) continue;
    boxes.push({
      page: p,
      x0: Math.max(0, Math.min(...words.map((w) => w.xMin)) - PAD),
      y0: Math.max(0, Math.min(...words.map((w) => w.yMin)) - PAD),
      x1: Math.min(page.width, Math.max(...words.map((w) => w.xMax)) + PAD),
      y1: Math.min(page.height, Math.max(...words.map((w) => w.yMax)) + PAD),
    });
  }
  return boxes;
}

/**
 * Blocos de padrão de resposta, em ordem. Cada um vai do marcador até o
 * próximo cabeçalho de questão, o próximo marcador ou o fim do documento;
 * `number` é o da discursiva cujo cabeçalho veio antes, quando houver.
 */
export function standardBlocks(pages) {
  const blocks = [];
  let open = null;
  let heading = null;
  const close = (at) => {
    if (open) blocks.push({ number: open.number, boxes: boxesBetween(pages, open.start, at) });
    open = null;
  };
  for (const line of documentLines(pages)) {
    const header = lineHeader(line);
    const marker = MARKER.test(lineText(line.words).trim());
    if (header || marker) close({ page: line.page, y: line.yMin - 1 });
    if (header) heading = header.kind === "D" || header.discursive ? header.number : null;
    if (marker) open = { number: heading, start: { page: line.page, y: line.yMin } };
  }
  const last = pages.length;
  close({ page: last, y: pages[last - 1]?.height ?? 0 });
  return blocks.filter((block) => block.boxes.length);
}

/**
 * Liga os blocos às discursivas da prova: pelo número do cabeçalho quando
 * todos têm, senão pela ordem, e só se a contagem bater. O que não for ligado
 * fica sem caixa, para quem confere desenhar.
 */
export function matchStandards(blocks, discursiveNumbers) {
  const result = new Map();
  if (blocks.length && blocks.every((b) => b.number !== null)) {
    for (const block of blocks) if (discursiveNumbers.includes(block.number)) result.set(block.number, block.boxes);
  } else if (blocks.length === discursiveNumbers.length) {
    discursiveNumbers.forEach((number, index) => result.set(number, blocks[index].boxes));
  }
  return result;
}

const toPoints = (value) => Number(value.replace(",", "."));

/**
 * Itens de avaliação lidos do enunciado: "a) ... (valor: 5,0 pontos)". Sem
 * itens, a questão vale como um todo (10 pontos quando o valor não aparece).
 */
export function parseCriteria(prompt) {
  const items = [...prompt.matchAll(/(?:^|\n)\s*([a-e])\)[^]*?\(valor:\s*(\d{1,2}(?:,\d{1,2})?)\s*pontos?\)/gi)]
    .map(([, label, points]) => ({ label: label.toLowerCase(), points: toPoints(points) }));
  if (items.length) return items;
  const total = /\(valor:\s*(\d{1,2}(?:,\d{1,2})?)\s*pontos?\)/i.exec(prompt);
  return [{ label: null, points: total ? toPoints(total[1]) : 10 }];
}
