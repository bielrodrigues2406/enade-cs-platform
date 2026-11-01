// Repetição espaçada com o FSRS-5 (Free Spaced Repetition Scheduler, de
// Jarrett Ye e colaboradores; fórmulas e parâmetros padrão do wiki oficial
// open-spaced-repetition/awesome-fsrs, "The Algorithm"). O modelo descreve a
// memória de cada cartão por três variáveis (DSR):
//   D, dificuldade (1 a 10);
//   S, estabilidade: dias até a chance de lembrar cair a 90%;
//   R, recuperabilidade: chance de lembrar agora.
// O próximo prazo é o dia em que R chega à retenção desejada (90%).
// Funções puras: o controlador só grava o resultado. Ver docs/FLASHCARDS.md.

/** 1 errei · 2 difícil · 3 bom · 4 fácil. */
export type Grade = 1 | 2 | 3 | 4;
export type CardMemory = { stability: number; difficulty: number };

/** Parâmetros padrão do FSRS-5, otimizados pelos autores em centenas de milhões de revisões. */
export const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
] as const;
export const DESIRED_RETENTION = 0.9;
/** Teto do intervalo: a plataforma prepara para uma prova; um ano basta. */
export const MAX_INTERVAL_DAYS = 365;
const DECAY = -0.5;
const FACTOR = 19 / 81;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Chance de lembrar depois de `days` dias com estabilidade S: R(t,S) = (1 + FACTOR·t/S)^DECAY. */
export function retrievability(days: number, stability: number) {
  return Math.pow(1 + (FACTOR * Math.max(0, days)) / stability, DECAY);
}

/** Dias até R cair à retenção desejada: I = S/FACTOR · (r^(1/DECAY) − 1). Arredonda, mínimo 1 dia. */
export function nextInterval(stability: number, retention = DESIRED_RETENTION) {
  const days = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, MAX_INTERVAL_DAYS);
}

/** D0(G) = w4 − e^(w5·(G−1)) + 1. */
export function initialDifficulty(grade: Grade) {
  return clamp(W[4] - Math.exp(W[5] * (grade - 1)) + 1, 1, 10);
}

/** Primeira vez: S0(G) = w[G−1]; D0(G). */
export function firstReview(grade: Grade): CardMemory {
  return { stability: W[grade - 1], difficulty: initialDifficulty(grade) };
}

/** Dificuldade com amortecimento linear e reversão à média, rumo a D0(4). */
export function nextDifficulty(difficulty: number, grade: Grade) {
  const delta = -W[6] * (grade - 3);
  const damped = difficulty + (delta * (10 - difficulty)) / 9;
  return clamp(W[7] * initialDifficulty(4) + (1 - W[7]) * damped, 1, 10);
}

/** Estabilidade depois de lembrar (G ≥ 2): cresce mais quando R estava baixo e o cartão é fácil. */
export function stabilityAfterRecall(memory: CardMemory, r: number, grade: Grade) {
  const hard = grade === 2 ? W[15] : 1;
  const easy = grade === 4 ? W[16] : 1;
  const growth = Math.exp(W[8]) * (11 - memory.difficulty) * Math.pow(memory.stability, -W[9]) *
    (Math.exp(W[10] * (1 - r)) - 1) * hard * easy;
  return memory.stability * (growth + 1);
}

/** Estabilidade depois de esquecer (G = 1); nunca maior que a anterior. */
export function stabilityAfterLapse(memory: CardMemory, r: number) {
  const s = W[11] * Math.pow(memory.difficulty, -W[12]) * (Math.pow(memory.stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(s, memory.stability);
}

/** Revisão no mesmo dia (FSRS-5): S' = S · e^(w17·(G−3+w18)). */
export function sameDayStability(stability: number, grade: Grade) {
  return stability * Math.exp(W[17] * (grade - 3 + W[18]));
}

/**
 * Novo estado depois de uma nota. `elapsedDays` é o tempo desde a última
 * revisão (null para cartão novo). Errar volta o cartão para daqui a 10
 * minutos, na mesma sessão; acertar marca o próximo prazo em dias.
 */
export function review(memory: CardMemory | null, elapsedDays: number | null, grade: Grade) {
  let next: CardMemory;
  if (!memory || elapsedDays === null) next = firstReview(grade);
  else {
    const difficulty = nextDifficulty(memory.difficulty, grade);
    let stability: number;
    if (elapsedDays < 1) stability = sameDayStability(memory.stability, grade);
    else {
      const r = retrievability(elapsedDays, memory.stability);
      stability = grade === 1 ? stabilityAfterLapse(memory, r) : stabilityAfterRecall(memory, r, grade);
    }
    next = { stability: clamp(stability, 0.01, 36500), difficulty };
  }
  const dueInMinutes = grade === 1 ? 10 : nextInterval(next.stability) * 24 * 60;
  return { ...next, dueInMinutes };
}

/** Prévia dos prazos de cada nota, para mostrar nos botões ("10 min", "3 d"…). */
export function preview(memory: CardMemory | null, elapsedDays: number | null) {
  return ([1, 2, 3, 4] as Grade[]).map((grade) => review(memory, elapsedDays, grade).dueInMinutes);
}
