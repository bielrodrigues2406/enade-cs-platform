// Extração conservadora de questões a partir do texto de um PDF oficial do
// ENADE. Nada aqui publica nem grava no banco: o resultado é um relatório para
// curadoria humana. Na dúvida, a questão vai para revisão manual.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text) =>
  text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? match;
    const value =
      code[1].toLowerCase() === "x"
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
    return String.fromCodePoint(value);
  });

const LIGATURE_CHARS = {
  "\uFB00": "ff",
  "\uFB01": "fi",
  "\uFB02": "fl",
  "\uFB03": "ffi",
  "\uFB04": "ffl",
  "\uFB05": "st",
  "\uFB06": "st",
};
const expandLigatures = (text) =>
  text.replace(/[\uFB00-\uFB06]/g, (c) => LIGATURE_CHARS[c]);

/** Lê a saída de `pdftotext -bbox`: páginas com dimensões e palavras. */
export function parseBboxHtml(html) {
  const pages = [];
  const pageRe = /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g;
  const wordRe =
    /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/g;
  for (const [, width, height, body] of html.matchAll(pageRe)) {
    const words = [];
    for (const [, x0, y0, x1, y1, text] of body.matchAll(wordRe))
      words.push({
        text: expandLigatures(decode(text)),
        xMin: +x0,
        yMin: +y0,
        xMax: +x1,
        yMax: +y1,
      });
    pages.push({ width: +width, height: +height, words });
  }
  return pages;
}

// As letras das alternativas usam uma fonte de símbolos com caixa quase
// quadrada; um "A" de texto comum (como em "A partir") é bem mais estreito.
export const isOptionMarker = (word) =>
  /^[A-E]$/.test(word.text) &&
  word.xMax - word.xMin >= 0.8 * (word.yMax - word.yMin);

// Cabeçalho e rodapé variam entre edições; são localizados pelos elementos que
// sempre os compõem: código de barras "*R03201412*", título do curso no rodapé,
// marcas "enade" e texto com caracteres de controle (logotipos em fonte própria).
const BAND = 0.16;
const BARCODE = /^\*[A-Z]?\d+\*$/;
// O rodapé traz o curso em caixa alta; no texto das questões ele aparece em
// caixa normal, então a comparação diferencia maiúsculas.
// Texto ilegível (com caracteres de controle) não serve de âncora: aparece
// também em cabeçalhos de questão e alternativas de algumas edições.
const isHeaderNoise = (w) =>
  BARCODE.test(w.text) || /^enade\d{4}$/i.test(w.text);
// Rodapé: código de barras ou a linha "CIÊNCIA DA COMPUTAÇÃO" inteira na mesma
// altura; uma palavra isolada em caixa alta no texto não basta.
const isFooterNoise = (w, words) =>
  BARCODE.test(w.text) ||
  (w.text === "CIÊNCIA" &&
    words.some(
      (o) => o.text === "COMPUTAÇÃO" && Math.abs(o.yMin - w.yMin) < 2,
    ));
export function pageBands(page) {
  const H = page.height;
  const top = page.words.filter((w) => w.yMax <= H * BAND && isHeaderNoise(w));
  const bottom = page.words.filter(
    (w) => w.yMin >= H * (1 - BAND) && isFooterNoise(w, page.words),
  );
  let footer = bottom.length ? Math.min(...bottom.map((w) => w.yMin)) : H;
  // Número de página na mesma faixa do rodapé.
  for (const w of page.words)
    if (
      /^\d{1,2}$/.test(w.text) &&
      bottom.some((b) => Math.abs(b.yMin - w.yMin) < H * 0.02)
    )
      footer = Math.min(footer, w.yMin);
  const header = top.length ? Math.max(...top.map((w) => w.yMax)) : 0;
  return { top: header + 0.5, bottom: footer - 0.5 };
}
export function contentWords(page, bands = pageBands(page)) {
  return page.words.filter(
    (w) => w.yMin >= bands.top && w.yMax <= bands.bottom,
  );
}

// Ligaduras (fi, ti, fl...) são extraídas como palavras separadas: "afi rma".
// Junta só quando o fim é uma ligadura, a continuação começa em minúscula e o
// espaço é menor que um espaço normal; cada junção fica registrada.
const LIGATURE_END = /(fi|fl|ti|tt|ff|ft|ffi|ffl)$/;
export function mergeLigatures(words) {
  const out = [];
  const joins = [];
  for (const word of words) {
    const prev = out[out.length - 1];
    const height = word.yMax - word.yMin;
    if (
      prev &&
      LIGATURE_END.test(prev.text) &&
      /^[a-zà-ú]/.test(word.text) &&
      word.xMin - prev.xMax < 0.2 * height
    ) {
      joins.push(`${prev.text}|${word.text}`);
      out[out.length - 1] = {
        ...prev,
        text: prev.text + word.text,
        xMax: word.xMax,
      };
    } else out.push(word);
  }
  return { words: out, joins };
}

/** Agrupa palavras em linhas (mesma altura) e ordena da esquerda para a direita. */
export function groupLines(words) {
  const sorted = [...words].sort((a, b) => a.yMin - b.yMin || a.xMin - b.xMin);
  const lines = [];
  for (const word of sorted) {
    const mid = (word.yMin + word.yMax) / 2;
    const line = lines.find(
      (l) => Math.abs(l.mid - mid) < 0.45 * (word.yMax - word.yMin),
    );
    if (line) line.words.push(word);
    else lines.push({ mid, words: [word] });
  }
  return lines
    .map((line) => {
      const { words: ws, joins } = mergeLigatures(
        line.words.sort((a, b) => a.xMin - b.xMin),
      );
      return {
        words: ws,
        joins,
        yMin: Math.min(...ws.map((w) => w.yMin)),
        yMax: Math.max(...ws.map((w) => w.yMax)),
        xMin: ws[0].xMin,
        xMax: Math.max(...ws.map((w) => w.xMax)),
      };
    })
    .sort((a, b) => a.yMin - b.yMin);
}

/**
 * Texto da linha. Trocas de fonte no meio da frase (itálico, negrito) geram
 * palavras coladas sem espaço real entre elas: "Project" + ",".
 */
export function lineText(words) {
  let text = "";
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const tight = prev && w.xMin - prev.xMax < 0.06 * (w.yMax - w.yMin);
    text += (i === 0 || tight ? "" : " ") + w.text;
  });
  return text;
}

/** Cabeçalho "QUESTÃO 12" ou "QUESTÃO DISCURSIVA 03" no início da linha. */
export function lineHeader(line) {
  const [first, second, third] = line.words.map((w) => w.text);
  if (!first || !/^quest[ãa]o$/i.test(first)) return null;
  if (/^\d{1,2}$/.test(second ?? ""))
    return { kind: "Q", number: Number(second), size: 2 };
  if (/^discursiva$/i.test(second ?? "") && /^\d{1,2}$/.test(third ?? ""))
    return { kind: "D", number: Number(third), size: 3 };
  return null;
}

/**
 * Página em duas colunas: há palavras dos dois lados e nenhuma linha de texto
 * atravessa o meio da página.
 */
export function splitColumns(page, words) {
  const middle = page.width / 2;
  const left = words.filter((w) => w.xMax <= middle);
  const right = words.filter((w) => w.xMin >= middle);
  const crossing = words.length - left.length - right.length;
  if (left.length && right.length && crossing === 0)
    return [
      { x0: 0, x1: middle, words: left },
      { x0: middle, x1: page.width, words: right },
    ];
  return [{ x0: 0, x1: page.width, words }];
}

const NOISE = /^(área livre|rascunho|formação geral|componente específico)$/i;
// Depois das questões vem o questionário de percepção, com itens também
// chamados "QUESTÃO 1..9"; a extração termina ali.
const END_OF_EXAM = /question[áa]rio de percep/i;

/**
 * Percorre páginas → colunas → linhas e distribui as linhas pelas questões.
 * Cada questão guarda as regiões (página, coluna, faixa vertical) que ocupa,
 * usadas depois para atribuir figuras.
 */
export function segmentQuestions(pages) {
  const questions = [];
  let current = null;
  let ended = false;
  pages.forEach((page, pageIndex) => {
    if (ended) return;
    const bands = pageBands(page);
    const words = contentWords(page, bands);
    for (const column of splitColumns(page, words)) {
      if (ended) break;
      let region = null;
      const openRegion = (y) => {
        if (!current) return;
        region = {
          page: pageIndex + 1,
          x0: column.x0,
          x1: column.x1,
          y0: y,
          y1: y,
          lines: 0,
        };
        current.regions.push(region);
      };
      openRegion(bands.top);
      for (const line of groupLines(column.words)) {
        // A capa também cita o questionário; só vale depois das questões.
        if (
          questions.length >= 10 &&
          END_OF_EXAM.test(line.words.map((w) => w.text).join(" "))
        ) {
          ended = true;
          break;
        }
        const header = lineHeader(line);
        // O questionário de percepção recomeça a numeração em 1: a prova acabou.
        const lastObjective = [...questions]
          .reverse()
          .find((q) => q.kind === "OBJECTIVE");
        if (
          header?.kind === "Q" &&
          lastObjective &&
          header.number < lastObjective.number - 5 &&
          questions.length >= 10
        ) {
          ended = true;
          break;
        }
        if (header) {
          if (region) region.y1 = line.yMin;
          current = {
            key: `${header.kind}${header.number}`,
            kind: header.kind === "D" ? "DISCURSIVE" : "OBJECTIVE",
            number: header.number,
            lines: [],
            regions: [],
            joins: [],
          };
          questions.push(current);
          openRegion(line.yMin);
          const rest = line.words.slice(header.size);
          if (!rest.length) continue;
          line.words = rest;
        }
        if (!current) continue;
        const text = fixSmallCapsLabels(lineText(line.words));
        if (NOISE.test(text.trim())) continue;
        current.lines.push({
          text,
          yMin: line.yMin,
          yMax: line.yMax,
          xMax: line.xMax,
          marker: isOptionMarker(line.words[0]) ? line.words[0].text : null,
          page: pageIndex + 1,
        });
        current.joins.push(...line.joins);
        if (region) {
          region.y1 = line.yMax;
          region.lines++;
        }
      }
      if (region && !ended) region.y1 = bands.bottom;
    }
  });
  // Faixa sem nenhuma linha (topo da página antes do próximo cabeçalho) não
  // pertence de fato à questão anterior.
  for (const q of questions)
    q.regions = q.regions.filter((r) => r.lines || r.y1 - r.y0 > 120);
  return questions;
}

const LIST_ITEM = /^(?:[IVX]{1,4}[.)]|•|\d{1,2}[.)]|[a-e]\))\s/;
const OWN_LINE = /^(PORQUE|TEXTO [IVX]+)$/;
const CITATION = /^(Disponível em:|[A-ZÀ-Ú][A-ZÀ-Ú'-]+,\s+[A-ZÀ-Ú]\.)/;

/**
 * Junta linhas quebradas em parágrafos. Novo parágrafo em itens de lista,
 * "PORQUE", "TEXTO I", referências, espaço vertical maior ou quando a linha
 * anterior termina uma frase antes da margem direita.
 */
export function joinParagraphs(lines) {
  const right = new Map();
  for (const l of lines)
    right.set(l.page, Math.max(right.get(l.page) ?? 0, l.xMax ?? 0));
  const out = [];
  let previous = null;
  for (const line of lines) {
    const height = line.yMax - line.yMin;
    const samePage = previous && line.page === previous.page;
    const gap = samePage ? line.yMin - previous.yMax : 0;
    const prevShort =
      previous &&
      previous.xMax !== undefined &&
      /[.:!?)]$/.test(previous.text) &&
      previous.xMax < (right.get(previous.page) ?? 0) - 40;
    // Fim de item de lista seguido de frase nova ("É correto o que se afirma em").
    const afterListItem =
      out.length &&
      LIST_ITEM.test(out[out.length - 1]) &&
      /\.$/.test(previous.text) &&
      /^[A-ZÀ-Ú]/.test(line.text) &&
      !LIST_ITEM.test(line.text);
    if (
      !out.length ||
      afterListItem ||
      LIST_ITEM.test(line.text) ||
      OWN_LINE.test(line.text) ||
      OWN_LINE.test(previous.text) ||
      CITATION.test(line.text) ||
      (samePage && gap > 0.45 * height) ||
      prevShort
    )
      out.push(line.text);
    else out[out.length - 1] += " " + line.text;
    previous = line;
  }
  return out.join("\n");
}

/** Separa enunciado e alternativas; exige exatamente A–E nesta ordem. */
export function splitOptions(lines) {
  const markers = lines
    .map((line, index) => ({ letter: line.marker, index }))
    .filter((m) => m.letter);
  const letters = markers.map((m) => m.letter).join("");
  if (letters !== "ABCDE") return { prompt: lines, options: null, letters };
  const options = markers.map((m, i) => {
    const end = i + 1 < markers.length ? markers[i + 1].index : lines.length;
    const own = lines
      .slice(m.index, end)
      .map((line, j) =>
        j === 0 ? { ...line, text: line.text.replace(/^[A-E]\s*/, "") } : line,
      );
    return { letter: m.letter, lines: own };
  });
  return { prompt: lines.slice(0, markers[0].index), options, letters };
}

// Caracteres que aparecem quando símbolos lógicos/matemáticos de fontes do tipo
// Symbol são extraídos com o mapeamento errado (ex.: → vira ®, ∧ vira Ù).
const SYMBOL_MOJIBAKE = /[®©±ÙÚØÞßÐ¾¼½¹²³¬¤¦¨¯´¸×÷µ¶-�]/;
// Ponto e vírgula e "if/for" aparecem em prosa; só sinais típicos de código contam.
const CODE_LIKE =
  /[{}]|==|!=|\+\+|->|#include|\b(int|void|return|printf|public|static|def|elif|struct)\s+[\w(*]|\bwhile\s*\(|\w\[\w*\]/;
// Texto em que o PDF entrega números de glifo no lugar das letras (fontes sem
// mapa Unicode correto): "ĂƉĞŶĂƐ" no lugar de "apenas".
const ILLEGIBLE =
  /[\u0100-\u024F\u0250-\u02FF\u0370-\u03FF\u0000-\u0008\u000B-\u001F]/;

// Versalete extraído com caixa trocada: "tEXtO ii" é "TEXTO II".
export const fixSmallCapsLabels = (text) =>
  text.replace(
    /\bt[eE][xX]t[oO]\s+(i{1,3}|iv|v)\b/g,
    (_, n) => `TEXTO ${n.toUpperCase()}`,
  );
const MIXED_CASE = /\b[a-zà-ú]+[A-ZÀ-Ú][A-Za-zÀ-ú]*\b/;
const MENTIONS_FIGURE =
  /\b(figuras?|imagem|imagens|gráficos?|diagramas?|tabelas?|mapas?|charges?|esquemas?|ilustra(?:da|do|ção)?|tirinhas?|infográficos?)\b/i;

export function textFlags(text) {
  const flags = [];
  if (MENTIONS_FIGURE.test(text)) flags.push("mencao-a-figura");
  if (MIXED_CASE.test(text)) flags.push("versalete");
  // Títulos em versalete nas referências saem em minúsculas:
  // "TABAKMAN, R. a saúde na mídia" (original "A saúde na mídia").
  if (/^[A-ZÀ-Ú][A-ZÀ-Ú'-]+,\s+(?:[A-Z]\.\s*)+[a-zà-ú]/m.test(text))
    flags.push("referencia-versalete");
  if (ILLEGIBLE.test(text)) flags.push("texto-ilegivel");
  if (SYMBOL_MOJIBAKE.test(text)) flags.push("caracteres-suspeitos");
  if (CODE_LIKE.test(text)) flags.push("codigo");
  if (/[a-zà-ú]-$/m.test(text)) flags.push("hifenizacao");
  return flags;
}

/** Muitas linhas muito curtas seguidas indicam tabela ou fórmula desmontada. */
export function looksTabular(lines) {
  let run = 0;
  for (const line of lines) {
    run = line.text.trim().length <= 6 ? run + 1 : 0;
    if (run >= 5) return true;
  }
  return false;
}

/**
 * Gabarito: "QUESTÃO 12 B", "12 B", "12 - B", "13 ANULADA", discursivas "***".
 * Retorna mapa "Q12" → "B" | "ANULADA" e se o documento se declara definitivo.
 */
export function parseAnswerKey(text) {
  const answers = new Map();
  const re =
    /(?:QUEST[ÃA]O\s+)?(DISCURSIVA\s+)?\b(\d{1,2})\s*-?\s+([A-E]|ANULADA|\*{3})(?=\s|$)/gi;
  for (const [, discursive, number, value] of text.matchAll(re)) {
    const key = `${discursive ? "D" : "Q"}${Number(number)}`;
    if (!answers.has(key)) answers.set(key, value.toUpperCase());
  }
  return { answers, definitive: /DEFINITIV/i.test(text) };
}

/**
 * Componentes gráficos (desenhos, tabelas com borda, imagens) em uma página
 * renderizada em tons de cinza: tinta escura fora das caixas de palavras.
 * Linhas finas isoladas (separadores, sublinhados) são ignoradas.
 */
export function detectGraphics(
  { width, height, pixels, scale },
  wordBoxes,
  { top, bottom, pad = 0.6, dark = 200, minSize = 12 },
) {
  const mask = new Uint8Array(width * height);
  const y0 = Math.floor(top * scale);
  const y1 = Math.min(height, Math.ceil(bottom * scale));
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < width; x++)
      if (pixels[y * width + x] < dark) mask[y * width + x] = 1;
  for (const w of wordBoxes) {
    const ax = Math.max(0, Math.floor((w.xMin - pad) * scale));
    const bx = Math.min(width, Math.ceil((w.xMax + pad) * scale));
    const ay = Math.max(0, Math.floor((w.yMin - pad) * scale));
    const by = Math.min(height, Math.ceil((w.yMax + pad) * scale));
    for (let y = ay; y < by; y++) mask.fill(0, y * width + ax, y * width + bx);
  }
  const seen = new Uint8Array(width * height);
  const found = [];
  const stack = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % width,
        y = (i - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const n of [i - 1, i + 1, i - width, i + width]) {
        if (n < 0 || n >= mask.length || seen[n] || !mask[n]) continue;
        if ((n === i - 1 || n === i + 1) && Math.floor(n / width) !== y)
          continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    const box = {
      x0: minX / scale,
      y0: minY / scale,
      x1: (maxX + 1) / scale,
      y1: (maxY + 1) / scale,
    };
    if (box.x1 - box.x0 >= minSize && box.y1 - box.y0 >= minSize)
      found.push(box);
  }
  return found;
}

/** Lê um PGM binário (P5) gerado por `pdftoppm -gray`. */
export function parsePgm(buffer) {
  const header = buffer.subarray(0, 64).toString("latin1");
  const match = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(header);
  if (!match) throw new Error("PGM inválido.");
  const [whole, width, height, max] = match;
  if (Number(max) !== 255) throw new Error("PGM com profundidade inesperada.");
  return {
    width: Number(width),
    height: Number(height),
    pixels: buffer.subarray(whole.length),
  };
}

const overlaps = (box, region) => {
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  return (
    cx >= region.x0 && cx < region.x1 && cy >= region.y0 && cy <= region.y1
  );
};

/** Confere a extração contra o gabarito: itens ausentes ou repetidos. */
// Alguns gabaritos não listam as discursivas; elas só contam como repetição.
export function completeness(items, answers) {
  const keys = items.map((i) => i.key);
  return {
    missing: [...answers.keys()].filter(
      (k) => k.startsWith("Q") && !keys.includes(k),
    ),
    unexpected: keys.filter(
      (k, i) => keys.indexOf(k) !== i || (k.startsWith("Q") && !answers.has(k)),
    ),
  };
}

/**
 * Classifica cada questão. Só vira "rascunho" a objetiva sem nenhuma suspeita,
 * com gabarito definitivo e não anulada; o resto vai para filas próprias.
 */
export function classify(
  questions,
  { answers, definitive, graphicsByPage, symbolPages },
) {
  const seen = new Map();
  for (const q of questions) seen.set(q.key, (seen.get(q.key) ?? 0) + 1);
  return questions.map((q) => {
    const flags = new Set();
    if (seen.get(q.key) > 1) flags.add("numero-repetido");
    const pages = [...new Set(q.lines.map((l) => l.page))];
    for (const region of q.regions)
      if (
        (graphicsByPage.get(region.page) ?? []).some((b) => overlaps(b, region))
      )
        flags.add("figura");
    if (pages.some((p) => symbolPages.has(p))) flags.add("fonte-de-simbolos");
    const block =
      (q.kind === "DISCURSIVE" && q.number <= 2) ||
      (q.kind === "OBJECTIVE" && q.number <= 8)
        ? "FORMACAO_GERAL"
        : "COMPONENTE_ESPECIFICO";
    const base = {
      key: q.key,
      kind: q.kind,
      number: q.number,
      block,
      pages,
      ligatureJoins: q.joins ?? [],
    };
    if (q.kind === "DISCURSIVE") {
      for (const f of textFlags(q.lines.map((l) => l.text).join("\n")))
        flags.add(f);
      return {
        ...base,
        status: "discursiva",
        flags: [...flags],
        prompt: joinParagraphs(q.lines),
      };
    }
    const answer = answers.get(q.key) ?? null;
    const { prompt, options, letters } = splitOptions(q.lines);
    if (!options) flags.add("alternativas");
    if (looksTabular(q.lines)) flags.add("tabela");
    const promptText = joinParagraphs(prompt);
    const optionTexts = (options ?? []).map((o) => ({
      letter: o.letter,
      text: joinParagraphs(o.lines),
    }));
    for (const f of textFlags(
      [promptText, ...optionTexts.map((o) => o.text)].join("\n"),
    ))
      flags.add(f);
    let status = "rascunho";
    if (answer === "ANULADA") status = "anulada";
    else if (!answer || !/^[A-E]$/.test(answer) || !definitive)
      status = "sem-gabarito-definitivo";
    else if (flags.size) status = "revisao-manual";
    return {
      ...base,
      status,
      flags: [...flags],
      answer,
      prompt: promptText,
      options: optionTexts,
      ...(options ? {} : { optionLetters: letters }),
    };
  });
}
