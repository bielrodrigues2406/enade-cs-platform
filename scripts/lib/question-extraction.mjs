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

/** Confere fontes exclusivas dos marcadores a partir do XML do próprio PDF.
 * A forma da caixa não distingue todos os glifos circulares antigos de um A
 * de prosa. Não confiar no nome da fonte: exigir só letras, o alfabeto completo,
 * ocorrências repetidas e tamanho compatível com o texto do documento. */
export function annotatePdfOptionFonts(pages, xml, expectedLetters = "ABCDE") {
  const attrs = (text) => Object.fromEntries(
    [...text.matchAll(/([A-Za-z]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]),
  );
  const fonts = new Map();
  for (const [, raw] of xml.matchAll(/<fontspec\s+([^>]+)\/>/g)) {
    const item = attrs(raw), size = Number(item.size);
    if (!item.id || !item.family || !Number.isFinite(size) || size <= 0) continue;
    const old = fonts.get(item.id);
    if (old && (old.family !== item.family || old.size !== size))
      throw new Error("Identificador de fonte PDF contraditório.");
    fonts.set(item.id, { id: item.id, family: item.family, size, texts: [] });
  }
  const xmlPages = [];
  const weightedSizes = new Map();
  for (const [, rawAttrs, body] of xml.matchAll(/<page\s+([^>]+)>([\s\S]*?)<\/page>/g)) {
    const item = attrs(rawAttrs), number = Number(item.number);
    const width = Number(item.width), height = Number(item.height);
    if (!Number.isInteger(number) || number < 1 || !pages[number - 1] ||
      !(width > 0 && height > 0)) throw new Error("Página XML incompatível com o PDF.");
    const texts = [];
    for (const [, raw, bodyText] of body.matchAll(/<text\s+([^>]+)>([\s\S]*?)<\/text>/g)) {
      const a = attrs(raw), font = fonts.get(a.font);
      const text = decode(bodyText.replace(/<[^>]+>/g, "")).trim();
      if (!text || !font) continue;
      font.texts.push(text);
      weightedSizes.set(font.size, (weightedSizes.get(font.size) ?? 0) + text.length);
      const [left, top, w, h] = [a.left, a.top, a.width, a.height].map(Number);
      if (![left, top, w, h].every(Number.isFinite) || left < 0 || top < 0 || w <= 0 || h <= 0)
        continue;
      texts.push({ text, font: a.font, xMin: left * pages[number - 1].width / width,
        yMin: top * pages[number - 1].height / height,
        xMax: (left + w) * pages[number - 1].width / width,
        yMax: (top + h) * pages[number - 1].height / height });
    }
    xmlPages.push({ number, texts });
  }
  if (xmlPages.length !== pages.length || new Set(xmlPages.map((p) => p.number)).size !== pages.length)
    throw new Error("A cobertura de páginas XML não corresponde ao PDF.");
  const weights = [...weightedSizes].sort((a, b) => a[0] - b[0]);
  const totalWeight = weights.reduce((sum, [, count]) => sum + count, 0);
  let accumulated = 0, bodySize = weights[0]?.[0] ?? 0;
  for (const [size, weight] of weights) {
    accumulated += weight;
    if (accumulated >= totalWeight / 2) { bodySize = size; break; }
  }
  const dedicated = [...fonts.values()].filter((font) =>
    font.size >= bodySize * 0.8 && font.texts.length >= expectedLetters.length * 3 &&
    font.texts.every((text) => text.length === 1 && expectedLetters.includes(text)) &&
    [...expectedLetters].every((letter) => font.texts.filter((text) => text === letter).length >= 3),
  );
  const fontIds = new Set(dedicated.map((font) => font.id));
  if (!fontIds.size) return { pages: pages.map((page) => ({ ...page,
    words: page.words.map((word) => ({ ...word, pdfOptionFontChecked: true, pdfOptionFontMarker: false })),
  })), fonts: [], markers: 0, unmatched: 0 };
  const xmlByPage = new Map(xmlPages.map((p) => [p.number, p.texts.filter((t) => fontIds.has(t.font))]));
  let markers = 0, unmatched = 0;
  const annotated = pages.map((page, index) => {
    const candidates = xmlByPage.get(index + 1) ?? [], used = new Set();
    const words = page.words.map((word) => {
      const matches = candidates.map((candidate, i) => ({ candidate, i })).filter(({ candidate }) =>
        candidate.text === word.text && Math.abs(candidate.xMin - word.xMin) <= 1.5 &&
        Math.abs(candidate.yMin - word.yMin) <= 2 && candidate.xMax >= word.xMax - 1.5,
      );
      const verified = matches.length === 1;
      if (verified) { markers++; used.add(matches[0].i); }
      return { ...word, pdfOptionFontChecked: true, pdfOptionFontMarker: verified };
    });
    unmatched += candidates.length - used.size;
    return { ...page, words };
  });
  if (!markers) throw new Error("Fonte de alternativas identificada, mas nenhuma posição foi confirmada.");
  return { pages: annotated, fonts: dedicated.map(({ id, family, size, texts }) =>
    ({ id, family, size, occurrences: texts.length })), markers, unmatched };
}

// As letras das alternativas usam uma fonte de símbolos com caixa quase
// quadrada; um "A" de texto comum (como em "A partir") é bem mais estreito.
export const isOptionMarker = (word) =>
  /^[A-E]$/.test(word.text) &&
  (word.ocrConfidence !== undefined ? word.pdfOptionMarker === true :
    word.pdfOptionFontChecked ? word.pdfOptionFontMarker === true :
      word.xMax - word.xMin >= 0.7 * (word.yMax - word.yMin));

/** Preserva A–E da camada PDF quando OCR lê os marcadores circulares como O.
 * Não infere letras pela ordem: usa somente glifos A–E e coordenadas do PDF. */
export function restorePdfOptionMarkers(ocrPage, nativePage) {
  const markers = nativePage.words.filter(isOptionMarker);
  const words = ocrPage.words.filter((word) => !markers.some((marker) => {
    const x = (word.xMin + word.xMax) / 2, y = (word.yMin + word.yMax) / 2;
    return word.xMin >= marker.xMin - 1 && word.xMax <= marker.xMax + 1 &&
      x >= marker.xMin - 1 && x <= marker.xMax + 1 &&
      y >= marker.yMin - 1 && y <= marker.yMax + 1;
  }));
  for (const marker of markers)
    words.push({ ...marker, ocrConfidence: 0, pdfOptionMarker: true });
  return { ...ocrPage, words };
}

/** TSV do Tesseract, convertido de pixels para pontos PDF, sem corrigir texto. */
export function parseOcrTsv(tsv, width, height, dpi) {
  if (!(width > 0 && height > 0 && dpi >= 72 && dpi <= 600))
    throw new Error("Dimensões de OCR inválidas.");
  const scale = 72 / dpi;
  const words = [];
  for (const line of tsv.split(/\r?\n/).slice(1)) {
    const cells = line.split("\t");
    if (cells.length < 12 || cells[0] !== "5") continue;
    const [left, top, w, h, confidence] = cells.slice(6, 11).map(Number);
    const text = cells.slice(11).join("\t").trim();
    if (!text || ![left, top, w, h, confidence].every(Number.isFinite) ||
      left < 0 || top < 0 || w <= 0 || h <= 0 || confidence < 0 || confidence > 100)
      continue;
    words.push({ text, xMin: left * scale, yMin: top * scale,
      xMax: (left + w) * scale, yMax: (top + h) * scale,
      ocrConfidence: confidence });
  }
  return { width, height, words };
}

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
  (w.text === "COMPUTAÇÃO" && words.some((o) => /^Área:$/i.test(o.text) && Math.abs(o.yMin - w.yMin) < 2)) ||
  (w.text === "CIÊNCIA" &&
    words.some(
      (o) => o.text === "COMPUTAÇÃO" && Math.abs(o.yMin - w.yMin) < 2,
    ));
export function pageBands(page) {
  const H = page.height;
  const top = page.words.filter((w) => w.yMax <= H * BAND && isHeaderNoise(w));
  const bottom = page.words.filter(
    (w) => w.yMin >= H * (1 - BAND) &&
      (isFooterNoise(w, page.words) ||
        (w.text === "COMPUTAÇÃO" && w.yMin > H * 0.94)),
  );
  let footer = bottom.length ? Math.min(...bottom.map((w) => w.yMin)) : H;
  // Número de página na mesma faixa do rodapé.
  for (const w of page.words)
    if (
      /^\d{1,2}$/.test(w.text) &&
      bottom.some((b) => Math.abs(b.yMin - w.yMin) < H * 0.02)
    )
      footer = Math.min(footer, w.yMin);
  let header = top.length ? Math.max(...top.map((w) => w.yMax)) : 0;
  // 2011 imprime o nome do exame no cabeçalho, sem o barcode no topo.
  for (const line of groupLines(page.words.filter((w) => w.yMax <= H * BAND)))
    if (/^EXAME NACIONAL DE DESEMPENHO DOS ESTUDANTES$/i.test(lineText(line.words)))
      header = Math.max(header, line.yMax);
  return { top: header + 0.5, bottom: footer - 0.5 };
}
export function contentWords(page, bands = pageBands(page)) {
  return page.words.filter(
    (w) => w.yMin >= bands.top && w.yMax <= bands.bottom &&
      !(/^(?:PND|PMD)\d{4}/.test(w.text) && w.text.length > 30),
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
  const ws = line.words;
  // 2005: "Q U ES T Ã O 1 1" e "D IS C U R S IV A" são glifos separados.
  let joined = "", i = 0;
  while (i < ws.length && joined.length < 7) joined += ws[i++].text;
  if (!/^quest[ãa]o$/i.test(joined)) return null;
  if (/^discursiva$/i.test(ws[i]?.text ?? "") && /^\d{1,3}$/.test(ws[i + 1]?.text ?? ""))
    return { kind: "D", number: Number(ws[i + 1].text), size: i + 2 };
  if (!/^\d{1,3}$/.test(ws[i]?.text ?? "")) return null;
  let number = ws[i++].text;
  // Só juntar os dígitos que fazem parte do cabeçalho em fonte espaçada.
  while (number.length < 3 && /^\d$/.test(ws[i]?.text ?? "") &&
    ws[i].xMin - ws[i - 1].xMax < (ws[i].yMax - ws[i].yMin) * 0.4)
    number += ws[i++].text;
  const tail = ws.slice(i).map((w) => w.text).join("").replace(/^[–—-]/, "");
  const discursive = /^discursiva/i.test(tail);
  // A chave continua Qn nos anos em que discursivas usam a numeração comum.
  if (discursive) {
    if (/^[–—-]$/.test(ws[i]?.text ?? "")) i++;
    let label = "";
    while (i < ws.length && label.length < 10) label += ws[i++].text;
  }
  return { kind: "Q", number: Number(number), size: i, discursive };
}

/**
 * Página em duas colunas: há palavras dos dois lados e nenhuma linha de texto
 * atravessa o meio da página.
 */
export function splitColumns(page, words) {
  let middle = page.width / 2;
  // Algumas edições deslocam o cabeçalho da coluna direita à esquerda do
  // centro geométrico. Localize-o antes de cortar as palavras "Q U EST Ã O".
  const anchors = words.filter((word) => {
    if (!/^(?:quest[ãa]o|q)$/i.test(word.text) || word.xMin < page.width * 0.43)
      return false;
    const line = { words: words.filter((w) => w.xMin >= word.xMin &&
      Math.abs((w.yMin + w.yMax - word.yMin - word.yMax) / 2) < (word.yMax - word.yMin) * 0.45)
      .sort((a, b) => a.xMin - b.xMin) };
    return !!lineHeader(line);
  });
  if (anchors.length) middle = Math.min(middle, ...anchors.map((w) => w.xMin - 1));
  const left = words.filter((w) => w.xMax <= middle);
  const right = words.filter((w) => w.xMin >= middle);
  const crossing = words.length - left.length - right.length;
  const rightHeader = groupLines(right).some((line) => lineHeader(line));
  let columns = left.length && right.length && (crossing === 0 || rightHeader);
  const initialColumns = !!columns;
  const initialMiddle = middle;
  if (words.some((word) => word.pdfOptionFontChecked)) {
    // Os cabeçalhos antigos são indentados em relação ao corpo: não cortar
    // a primeira letra da coluna direita só porque ela precede "QUESTÃO".
    // Procure o corredor de menor cruzamento no miolo, sem instruções que
    // antecedem os cabeçalhos da página. Letras provadas pela fonte ajudam
    // a distinguir uma continuação em duas colunas de um texto corrido.
    const headerTops = words.filter((w) => /^(?:quest[ãa]o|q)$/i.test(w.text)).filter((w) =>
      lineHeader({ words: words.filter((o) => o.xMin >= w.xMin &&
        Math.abs((o.yMin + o.yMax - w.yMin - w.yMax) / 2) < (w.yMax - w.yMin) * 0.45)
        .sort((a, b) => a.xMin - b.xMin) }),
    ).map((w) => w.yMin);
    const floor = headerTops.length ? Math.min(...headerTops) - 1 : -Infinity;
    const body = words.filter((w) => w.yMin >= floor);
    const low = page.width * 0.43;
    const high = anchors.length ? Math.min(page.width * 0.57, ...anchors.map((w) => w.xMin)) : page.width * 0.57;
    const edges = [...new Set([low, high, ...body.flatMap((w) => [w.xMin, w.xMax])
      .filter((x) => x > low && x < high)])].sort((a, b) => a - b);
    const intervals = edges.slice(1).map((end, index) => {
      const start = edges[index], x = (start + end) / 2;
      return { start, end, crossing: body.filter((w) => w.xMin < x && w.xMax > x).length };
    });
    const least = Math.min(...intervals.map((i) => i.crossing));
    const gaps = [];
    for (const interval of intervals.filter((i) => i.crossing === least)) {
      const last = gaps.at(-1);
      if (last && Math.abs(last.end - interval.start) < 0.01) last.end = interval.end;
      else gaps.push({ ...interval });
    }
    gaps.sort((a, b) => (b.end - b.start) - (a.end - a.start) ||
      Math.abs((a.start + a.end) / 2 - middle) - Math.abs((b.start + b.end) / 2 - middle));
    const gap = gaps[0];
    const vertical = new Map();
    for (const w of words.filter((w) => w.pdfOptionFontMarker && w.xMin >= low && w.xMin <= high)) {
      const key = [...vertical.keys()].find((x) => Math.abs(x - w.xMin) <= 1.5) ?? w.xMin;
      if (!vertical.has(key)) vertical.set(key, new Set());
      vertical.get(key).add(w.text);
    }
    const rightMarkers = [...vertical.values()].some((letters) => letters.has("A") && letters.size >= 3);
    if (gap && (columns || (gap.crossing === 0 && gap.end - gap.start >= 6 && rightMarkers))) {
      middle = (gap.start + gap.end) / 2;
      columns = words.filter((w) => w.xMax <= middle).length >= 2 &&
        words.filter((w) => w.xMin >= middle).length >= 2;
    }
  }
  if (columns)
    return [
      { x0: 0, x1: middle, words: words.filter((w) => w.xMin < middle), adjusted: !initialColumns || Math.abs(middle - initialMiddle) > 0.1 },
      { x0: middle, x1: page.width, words: words.filter((w) => w.xMin >= middle), adjusted: !initialColumns || Math.abs(middle - initialMiddle) > 0.1 },
    ];
  return [{ x0: 0, x1: page.width, words }];
}

const NOISE = /^(área livre|rascunho|formação geral|componente específico)$/i;
// Depois das questões vem o questionário de percepção, com itens também
// chamados "QUESTÃO 1..9"; a extração termina ali.
const END_OF_EXAM = /^question[áa]rio de percep[çc][aã]o(?: (?:da|sobre a) prova)?$/i;

/**
 * Percorre páginas → colunas → linhas e distribui as linhas pelas questões.
 * Cada questão guarda as regiões (página, coluna, faixa vertical) que ocupa,
 * usadas depois para atribuir figuras.
 */
export function segmentQuestions(pages, { unnumberedDiscursive = false } = {}) {
  const questions = [];
  let current = null;
  let ended = false;
  let shared = null;
  const contexts = new Map();
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
      const lines = groupLines(column.words).flatMap((line) => {
        const start = line.words.findIndex((w, i) => i > 0 &&
          /^QUEST[ÃA]O$/.test(w.text) && lineHeader({ words: line.words.slice(i) }));
        if (start < 0) return [line];
        // Diagramas e referências da questão anterior podem compartilhar a
        // altura do próximo cabeçalho (2008 Q38). Preserve os dois trechos.
        return [line.words.slice(0, start), line.words.slice(start)].map((words) => ({
          ...line, words, xMin: words[0].xMin,
          xMax: Math.max(...words.map((w) => w.xMax)),
        }));
      });
      for (const line of lines) {
        const rawText = lineText(line.words);
        const sharedLabel = /^Texto para (?:as )?quest[õo]es\s+(?:de\s+)?([\d\s,ea–-]+)/i.exec(rawText);
        if (sharedLabel) {
          const numbers = sharedLabel[1].match(/\d+/g)?.map(Number) ?? [];
          const targets = /\s+a\s+|[–-]/.test(sharedLabel[1]) && numbers.length === 2 ?
            Array.from({ length: Math.min(1000, numbers[1] - numbers[0] + 1) }, (_, i) => numbers[0] + i) : numbers;
          shared = { lines: [], regions: [], joins: [] };
          for (const number of targets) contexts.set(number, shared);
          if (region) region.y1 = line.yMin;
          current = null;
          region = null;
        }
        // A capa também cita o questionário; só vale depois das questões.
        if (
          questions.length >= 10 &&
          END_OF_EXAM.test(line.words.map((w) => w.text).join(" "))
        ) {
          ended = true;
          break;
        }
        const header = lineHeader(line) ?? (unnumberedDiscursive &&
          /^QUEST[ÃA]O DISCURSIVA\s*$/i.test(rawText) ?
          { kind: "D", number: 1, size: line.words.length, unnumbered: true } : null);
        if (shared && !header) {
          shared.lines.push({ text: rawText, yMin: line.yMin, yMax: line.yMax,
            xMax: line.xMax, marker: null, page: pageIndex + 1,
            ...(line.words.some((w) => w.ocrConfidence !== undefined) ? { ocr: true } : {}) });
          shared.regions.push({ page: pageIndex + 1, x0: column.x0, x1: column.x1,
            y0: line.yMin, y1: line.yMax, lines: 1 });
          shared.joins.push(...line.joins);
          continue;
        }
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
          shared = null;
          if (region) region.y1 = line.yMin;
          const context = header.kind === "Q" ? contexts.get(header.number) : null;
          current = {
            key: `${header.kind}${header.number}`,
            kind: header.kind === "D" || header.discursive ? "DISCURSIVE" : "OBJECTIVE",
            number: header.number,
            lines: context ? [...context.lines] : [],
            regions: context ? [...context.regions] : [],
            joins: context ? [...context.joins] : [],
            ...(context ? { sharedContext: true } : {}),
            ...(header.unnumbered ? { unnumbered: true } : {}),
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
          ...(line.words.some((w) => w.ocrConfidence !== undefined) ? { ocr: true } : {}),
          ...(line.words.some((w) => w.pdfOptionMarker) ? { pdfOptionMarker: true } : {}),
          ...(line.words.some((w) => w.pdfOptionFontChecked) ? {
            words: line.words,
            columnXMin: column.x0,
            columnXMax: column.x1,
            pdfOptionFontMarker: line.words.some((w) => w.pdfOptionFontMarker),
          } : {}),
          ...(column.adjusted ? { columnAdjusted: true } : {}),
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

// Alternativas horizontais e grades A/B/C + D/E são comuns nas provas antigas.
// Só reorganizar quando as letras vêm de uma fonte dedicada conferida no XML,
// cada letra ocorre uma vez e as colunas mantêm a ordem impressa do alfabeto.
// Nem letras de prosa, nem OCR sem marcador PDF, nem grupos repetidos servem.
function splitGeometricOptions(lines, expectedLetters) {
  const markers = [];
  lines.forEach((line, index) => (line.words ?? []).forEach((word, wordIndex) => {
    if (word.pdfOptionFontMarker && word.ocrConfidence === undefined && expectedLetters.includes(word.text))
      markers.push({ word, line, index, wordIndex, letter: word.text });
  }));
  if (markers.length !== expectedLetters.length ||
    new Set(markers.map((m) => m.letter)).size !== expectedLetters.length ||
    [...expectedLetters].some((letter) => !markers.some((m) => m.letter === letter))) return null;
  const first = markers[0];
  const region = (line) => `${line.page}/${line.columnXMin}/${line.columnXMax}`;
  if (new Set(markers.map((m) => region(m.line))).size !== 1 ||
    lines.slice(first.index).some((line) => !line.words || line.ocr || region(line) !== region(first.line)))
    return null;
  const columns = [];
  for (const marker of [...markers].sort((a, b) => a.word.xMin - b.word.xMin || a.index - b.index)) {
    let column = columns.find((c) => Math.abs(c.x - marker.word.xMin) <= 1.5);
    if (!column) { column = { x: marker.word.xMin, markers: [] }; columns.push(column); }
    column.markers.push(marker);
  }
  columns.sort((a, b) => a.x - b.x);
  for (const column of columns) column.markers.sort((a, b) => a.index - b.index || a.wordIndex - b.wordIndex);
  if (columns.flatMap((c) => c.markers).map((m) => m.letter).join("") !== expectedLetters &&
    markers.map((m) => m.letter).join("") !== expectedLetters)
    return null;
  const byLetter = new Map(markers.map((marker) => [marker.letter, new Map()]));
  let invalid = false;
  for (let index = first.index; index < lines.length; index++) {
    const line = lines[index];
    line.words.forEach((word, wordIndex) => {
      if (index === first.index && wordIndex < first.wordIndex) return;
      const columnIndex = columns.findLastIndex((column) => word.xMin >= column.x - 1.5);
      if (columnIndex < 0 || (columns[columnIndex + 1] && word.xMax > columns[columnIndex + 1].x - 0.5)) {
        invalid = true; return;
      }
      const column = columns[columnIndex];
      const marker = column.markers.findLast((candidate) => candidate.index < index ||
        (candidate.index === index && candidate.wordIndex <= wordIndex));
      if (!marker) { invalid = true; return; }
      if (word === marker.word) return;
      const own = byLetter.get(marker.letter);
      if (!own.has(index)) own.set(index, []);
      own.get(index).push(word);
    });
  }
  if (invalid) return null;
  const prompt = lines.slice(0, first.index);
  const prefix = first.line.words.slice(0, first.wordIndex);
  const fromWords = (line, words) => ({ ...line, words, marker: null,
    text: fixSmallCapsLabels(lineText(words)), xMax: Math.max(...words.map((w) => w.xMax)),
    yMin: Math.min(...words.map((w) => w.yMin)), yMax: Math.max(...words.map((w) => w.yMax)) });
  if (prefix.length) prompt.push(fromWords(first.line, prefix));
  return { prompt, options: [...expectedLetters].map((letter) => ({ letter,
    lines: [...byLetter.get(letter)].map(([index, words]) => fromWords(lines[index], words)),
  })), letters: expectedLetters, reconstructed: true };
}

/** Separa enunciado e alternativas; exige o alfabeto explícito da edição. */
export function splitOptions(lines, expectedLetters = "ABCDE") {
  const markers = lines
    .map((line, index) => ({ letter: line.marker, index }))
    .filter((m) => m.letter);
  const letters = markers.map((m) => m.letter).join("");
  const fontMarkers = lines.flatMap((line) => (line.words ?? []).filter((word) => word.pdfOptionFontMarker));
  if (fontMarkers.length && (fontMarkers.length !== expectedLetters.length ||
    new Set(fontMarkers.map((word) => word.text)).size !== expectedLetters.length))
    return { prompt: lines, options: null, letters: fontMarkers.map((word) => word.text).join("") };
  if (letters !== expectedLetters)
    return splitGeometricOptions(lines, expectedLetters) ?? { prompt: lines, options: null, letters };
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
    /(?:QUEST[ÃA]O[^\S\r\n]+)?(DISCURSIVA[^\S\r\n]+)?\b(\d{1,3})[^\S\r\n]*-?[^\S\r\n]+([A-E]|ANULADA|DISCURSIVA|\*{3})(?=[^\S\r\n]|$)/gim;
  for (const [, discursive, number, value] of text.matchAll(re)) {
    const key = `${discursive ? "D" : "Q"}${Number(number)}`;
    const answer = value.toUpperCase();
    if (answers.has(key) && answers.get(key) !== answer)
      throw new Error(`Gabarito contraditório para ${key}.`);
    answers.set(key, answer);
  }
  return { answers, definitive: /DEFINITIV/i.test(text) };
}

/** PND tem gabarito próprio por tipo; nunca substituir pela primeira variante. */
export function selectAnswerKey(documents, exam) {
  let candidates = documents.filter((d) => d.kind === "ANSWER_KEY" &&
    d.year === exam.year && d.modality === exam.modality && d.family === exam.family);
  if (exam.family === "PND") {
    const variant = /tipo\s+(\d+)\s*$/i.exec(exam.variant ?? "")?.[1];
    if (!variant) return null;
    candidates = candidates.filter((d) => /tipo\s+(\d+)\s*$/i.exec(d.variant ?? "")?.[1] === variant);
  }
  if (candidates.length > 1) throw new Error(`${exam.id}: mais de um gabarito compatível; conferir variante.`);
  return candidates[0] ?? null;
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

/**
 * Faixas verticais com texto de largura total numa página de duas colunas:
 * linhas com alguma palavra atravessando o corte entre as colunas. Faixas com
 * a instrução de um bloco de curso ("As questões de 11 a 40, a seguir, são
 * específicas para...") separam questões; as demais (tabela ou figura larga)
 * pertencem à questão daquela altura.
 */
const BLOCK_INTRO = /as quest[õo]es de \d+ a \d+|espec[íi]fic[ao]s? para os estudantes|^pare$|perfil do curso|n[úu]mero das quest[õo]es|quest[õo]es objetivas e discursivas distribu[íi]das/i;
function spanningBands(page, split, column) {
  const bands = [];
  for (const line of groupLines(contentWords(page))) {
    const text = line.words.map((w) => w.text).join(" ");
    const crosses = line.words.some((w) => w.xMin < split - 1 && w.xMax > split + 1);
    // Instrução de bloco só numa coluna (2008) também separa questões.
    const intro = BLOCK_INTRO.test(text) && line.words.some((w) =>
      w.xMin >= column.x0 - 2 && w.xMax <= column.x1 + 2);
    if (!crosses && !intro) continue;
    const last = bands.at(-1);
    if (last && line.yMin - last.bottom < 20) {
      last.bottom = Math.max(last.bottom, line.yMax + 4);
      last.intro ||= BLOCK_INTRO.test(text);
    } else bands.push({ top: line.yMin - 4, bottom: line.yMax + 4, intro: BLOCK_INTRO.test(text) });
  }
  return bands;
}

/**
 * Caixas de recorte de uma questão (CNT-C1, ADR-010), em pontos do PDF.
 * Junta regiões vizinhas da mesma coluna (texto compartilhado vem linha a
 * linha) e aperta cada uma à extensão das palavras e figuras que ela contém,
 * sem margens, códigos de barras, a coluna ao lado ou instruções de bloco.
 */
export function cropBoxes(question, pages, graphicsByPage = new Map(), pad = 6) {
  const merged = [];
  for (const r of question.regions) {
    const last = merged.at(-1);
    if (last && last.page === r.page && last.x0 === r.x0 && last.x1 === r.x1 &&
      r.y0 - last.y1 < 24) {
      last.y1 = Math.max(last.y1, r.y1);
      continue;
    }
    merged.push({ page: r.page, x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 });
  }
  return merged.flatMap((region) => {
    const page = pages[region.page - 1];
    const column = region.x1 - region.x0 < page.width * 0.75;
    const bands = column ? spanningBands(page, region.x0 > 0 ? region.x0 : region.x1, region) : [];
    const bandOf = (box) => bands.find((b) => (box.y0 + box.y1) / 2 >= b.top && (box.y0 + box.y1) / 2 <= b.bottom);
    const all = contentWords(page).map((w) => ({ x0: w.xMin, y0: w.yMin, x1: w.xMax, y1: w.yMax, text: w.text }));
    // "Área livre" e "Rascunho" fecham a questão na coluna; o fio ao lado
    // deles é decoração da prova, não figura da questão.
    const inColumn = all.filter((w) => overlaps(w, region));
    // Só fecha a questão quando começa a linha; a caixa "RASCUNHO" ao lado
    // do enunciado (2008) fica fora do recorte, mas não o encerra.
    const scratch = inColumn.filter((w) => /^rascunho$/i.test(w.text));
    const opensLine = (w) => w.x0 < region.x0 + (region.x1 - region.x0) * 0.4;
    let start = region.y0;
    let end = Math.min(region.y1, ...inColumn.filter((w) => opensLine(w) && (/^rascunho$/i.test(w.text) ||
      (/^área$/i.test(w.text) && inColumn.some((o) => /^livre$/i.test(o.text) &&
        Math.abs(o.y0 - w.y0) < 2)))).map((w) => w.y0 - 1));
    // Instrução de bloco seguida de texto da questão abre a coluna (o que
    // vem antes é cabeçalho de página); sem texto depois, ela fecha a questão.
    for (const band of bands.filter((b) => b.intro)) {
      if (band.bottom < start || band.top > end) continue;
      const after = inColumn.some((w) => w.y0 > band.bottom && (w.y0 + w.y1) / 2 <= end &&
        !bandOf(w) && !/^rascunho$/i.test(w.text));
      if (after) start = Math.max(start, band.bottom);
      else end = Math.min(end, band.top);
    }
    const vertical = (box) => (box.y0 + box.y1) / 2 >= start && (box.y0 + box.y1) / 2 <= end;
    const belongs = (box, figure) => {
      if (!vertical(box)) return false;
      // Figura da questão fica dentro da faixa dela; moldura da página, não.
      if (figure && (box.y0 < start - 8 || box.y1 > end + 8)) return false;
      if (!column) return overlaps(box, { ...region, y0: start, y1: end });
      const band = bandOf(box);
      if (band) return !band.intro;
      return box.x0 >= region.x0 - 2 && box.x1 <= region.x1 + 2;
    };
    const words = all.filter((w) => belongs(w, false) && !scratch.includes(w));
    const parts = [...words, ...(graphicsByPage.get(region.page) ?? []).filter((g) => belongs(g, true) &&
      !scratch.some((w) => overlaps(w, g)))];
    if (!parts.length) return [];
    const box = {
      page: region.page,
      x0: Math.max(0, Math.min(...parts.map((b) => b.x0)) - pad),
      y0: Math.max(0, Math.min(...parts.map((b) => b.y0)) - pad),
      x1: Math.min(page.width, Math.max(...parts.map((b) => b.x1)) + pad),
      y1: Math.min(page.height, Math.max(...parts.map((b) => b.y1)) + pad),
    };
    // Fragmento pequeno sem texto: logotipo ou fio de página, não questão.
    if (!words.length && box.y1 - box.y0 < 80) return [];
    return [box];
  });
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
      (k, i) => keys.indexOf(k) !== i ||
        (k.startsWith("Q") && items[i].kind !== "DISCURSIVE" && !answers.has(k)),
    ),
  };
}

/**
 * Classifica cada questão. Só vira "rascunho" a objetiva sem nenhuma suspeita,
 * com gabarito definitivo e não anulada; o resto vai para filas próprias.
 */
export function classify(
  questions,
  { answers, definitive, graphicsByPage, symbolPages, generalObjectiveThrough = 8,
    generalDiscursiveThrough = 2, sharedBooklet = false, courseScopeFor,
    expectedOptionLetters = "ABCDE", keyAvailable = true },
) {
  const seen = new Map();
  for (const q of questions) seen.set(q.key, (seen.get(q.key) ?? 0) + 1);
  return questions.map((q) => {
    const flags = new Set();
    if (!keyAvailable) flags.add("gabarito-ausente");
    if (q.sharedContext) flags.add("texto-compartilhado");
    if (q.unnumbered) flags.add("discursiva-sem-numero");
    if (sharedBooklet) flags.add("caderno-compartilhado");
    const courseScope = courseScopeFor?.(q) ?? [];
    if (courseScope.length && !courseScope.includes("Ciência da Computação"))
      flags.add("fora-escopo-ciencia-computacao");
    if (seen.get(q.key) > 1) flags.add("numero-repetido");
    const pages = [...new Set(q.lines.map((l) => l.page))];
    if (q.lines.some((l) => l.ocr)) flags.add("revisao-ocr");
    if (q.lines.some((l) => l.pdfOptionMarker)) flags.add("marcador-recuperado-pdf");
    if (q.lines.some((l) => l.pdfOptionFontMarker)) flags.add("marcador-fonte-pdf");
    if (q.lines.some((l) => l.columnAdjusted)) flags.add("revisao-colunas-pdf");
    for (const region of q.regions)
      if (
        (graphicsByPage.get(region.page) ?? []).some((b) => overlaps(b, region))
      )
        flags.add("figura");
    if (pages.some((p) => symbolPages.has(p))) flags.add("fonte-de-simbolos");
    const block =
      (q.kind === "DISCURSIVE" && q.number <= generalDiscursiveThrough) ||
      (q.kind === "OBJECTIVE" && q.number <= generalObjectiveThrough)
        ? "FORMACAO_GERAL"
        : "COMPONENTE_ESPECIFICO";
    const base = {
      key: q.key,
      kind: q.kind,
      number: q.number,
      block,
      pages,
      ligatureJoins: q.joins ?? [],
      ...(courseScope.length ? { courseScope } : {}),
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
    const { prompt, options, letters, reconstructed } = splitOptions(q.lines, expectedOptionLetters);
    if (reconstructed) flags.add("alternativas-reconstruidas-layout");
    if (!options) flags.add("alternativas");
    if (looksTabular(q.lines)) flags.add("tabela");
    const promptText = joinParagraphs(prompt);
    const optionTexts = (options ?? []).map((o) => ({
      letter: o.letter,
      text: joinParagraphs(o.lines),
    }));
    if (!promptText.trim()) flags.add("enunciado-ausente");
    if (options && optionTexts.some((option) => !option.text.trim()))
      flags.add("alternativa-vazia");
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
