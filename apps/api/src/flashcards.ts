import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { preview, review, type Grade } from "./fsrs.js";
import { loadDecks, loadSheets } from "./study-content.js";

// Flashcards (FLASH-1) e biblioteca de fichas (LIB-1). O cartão vem do
// repositório; o que é da pessoa (estabilidade, dificuldade, prazo) fica no
// banco. A sessão traz primeiro os cartões vencidos e depois alguns novos,
// para não afogar a pessoa em cartões novos num dia só.

const NEW_PER_SESSION = 10;
const SESSION_MAX = 30;
const DAY_MS = 86_400_000;

type State = { card_id: string; stability: number; difficulty: number; reps: number; lapses: number; last_review: Date; due: Date };

async function states(owner: string): Promise<Map<string, State>> {
  return new Map((await db.query<State>(
    "SELECT card_id,stability,difficulty,reps,lapses,last_review,due FROM flashcard_state WHERE identity_id=$1", [owner],
  )).rows.map((row) => [row.card_id, row]));
}

const memoryOf = (state?: State) => (state ? { stability: state.stability, difficulty: state.difficulty } : null);
const elapsed = (state?: State, now = Date.now()) => (state ? (now - state.last_review.getTime()) / DAY_MS : null);

@Controller("api")
export class FlashcardsController {
  /** Baralhos com o que vence hoje, o que é novo e o que já está guardado (estabilidade ≥ 21 dias). */
  @Get("flashcards") async decks(@Req() req: any) {
    const user = await requireIdentity(req);
    const [all, mine] = await Promise.all([loadDecks(), states(user.id)]);
    const now = Date.now();
    const reviewedToday = (await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM flashcard_review WHERE identity_id=$1
       AND (reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date=(now() AT TIME ZONE 'America/Sao_Paulo')::date`, [user.id],
    )).rows[0].n;
    return {
      reviewedToday,
      decks: all.map((deck) => {
        const cards = deck.cards.map((card) => mine.get(card.id));
        return {
          deck: deck.deck, area: deck.area, title: deck.title, description: deck.description, total: deck.cards.length,
          due: cards.filter((s) => s && s.due.getTime() <= now).length,
          fresh: cards.filter((s) => !s).length,
          mastered: cards.filter((s) => s && s.stability >= 21).length,
        };
      }),
    };
  }

  /** Sessão de estudo de um baralho (ou de todos): vencidos primeiro, depois até 10 novos. */
  @Get("flashcards/session") async session(@Req() req: any, @Query("deck") deckId?: string) {
    const user = await requireIdentity(req);
    const [all, mine] = await Promise.all([loadDecks(), states(user.id)]);
    const chosen = deckId ? all.filter((d) => d.deck === deckId) : all;
    if (deckId && !chosen.length) fail("Baralho não encontrado.", 404);
    const now = Date.now();
    const cards = chosen.flatMap((deck) => deck.cards.map((card) => ({ ...card, deck: deck.deck, area: deck.area, state: mine.get(card.id) })));
    const due = cards.filter((c) => c.state && c.state.due.getTime() <= now)
      .sort((a, b) => a.state!.due.getTime() - b.state!.due.getTime());
    const fresh = cards.filter((c) => !c.state).slice(0, NEW_PER_SESSION);
    return {
      cards: [...due, ...fresh].slice(0, SESSION_MAX).map(({ state, ...card }) => ({
        ...card, isNew: !state, preview: preview(memoryOf(state), elapsed(state, now)),
      })),
    };
  }

  @Post("flashcards/:card/review") @HttpCode(200) async grade(@Req() req: any, @Param("card") cardId: string, @Body() body: any) {
    const user = await requireIdentity(req);
    const grade = Number(body?.grade);
    if (![1, 2, 3, 4].includes(grade)) fail("Escolha uma nota de 1 a 4.", 400);
    if (!(await loadDecks()).some((deck) => deck.cards.some((card) => card.id === cardId))) fail("Cartão não encontrado.", 404);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const state = (await client.query<State>(
        "SELECT card_id,stability,difficulty,reps,lapses,last_review,due FROM flashcard_state WHERE identity_id=$1 AND card_id=$2 FOR UPDATE",
        [user.id, cardId],
      )).rows[0];
      const next = review(memoryOf(state), elapsed(state), grade as Grade);
      await client.query(
        `INSERT INTO flashcard_state(identity_id,card_id,stability,difficulty,reps,lapses,last_review,due)
         VALUES($1,$2,$3,$4,1,$5,clock_timestamp(),clock_timestamp() + make_interval(mins => $6))
         ON CONFLICT(identity_id,card_id) DO UPDATE SET stability=$3,difficulty=$4,reps=flashcard_state.reps+1,
           lapses=flashcard_state.lapses+$5,last_review=clock_timestamp(),due=clock_timestamp() + make_interval(mins => $6)`,
        [user.id, cardId, next.stability, next.difficulty, grade === 1 && state ? 1 : 0, next.dueInMinutes],
      );
      await client.query("INSERT INTO flashcard_review(identity_id,card_id,grade) VALUES($1,$2,$3)", [user.id, cardId, grade]);
      await client.query("COMMIT");
      return { dueInMinutes: next.dueInMinutes, stability: next.stability, difficulty: next.difficulty };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  @Get("sheets") async sheets(@Req() req: any) {
    await requireIdentity(req);
    return (await loadSheets()).map(({ slug, area, title, summary }) => ({ slug, area, title, summary }));
  }

  @Get("sheets/:slug") async sheet(@Req() req: any, @Param("slug") slug: string) {
    await requireIdentity(req);
    return (await loadSheets()).find((s) => s.slug === slug) ?? fail("Ficha não encontrada.", 404);
  }
}
