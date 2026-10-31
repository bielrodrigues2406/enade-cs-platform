import { test } from "node:test";
import assert from "node:assert/strict";
import { matchStandards, parseCriteria } from "../scripts/lib/response-standard.mjs";

// Textos TEST ONLY no formato dos enunciados do Inep.
test("evaluation items are read from the prompt values, or the whole question counts as one item", () => {
  assert.deepEqual(parseCriteria("Faça o que se pede.\na) Explique X. (valor: 5,0 pontos)\nb) Proponha Y.\n(valor: 5,0 pontos)"), [
    { label: "a", points: 5 },
    { label: "b", points: 5 },
  ]);
  assert.deepEqual(parseCriteria("Discorra sobre TEST ONLY. (valor: 10,0 pontos)"), [{ label: null, points: 10 }]);
  assert.deepEqual(parseCriteria("Sem valor indicado"), [{ label: null, points: 10 }]);
});

test("response standard blocks match by heading number, else by order only when the count agrees", () => {
  const box = (page: number) => [{ page, x0: 0, y0: 0, x1: 10, y1: 10 }];
  const numbered = [{ number: 4, boxes: box(1) }, { number: 3, boxes: box(2) }];
  assert.deepEqual([...matchStandards(numbered, [3, 4]).keys()].sort(), [3, 4]);
  const ordered = [{ number: null, boxes: box(1) }, { number: null, boxes: box(2) }];
  assert.equal(matchStandards(ordered, [1, 2]).get(2)![0].page, 2);
  assert.equal(matchStandards(ordered, [1, 2, 3]).size, 0); // contagem diferente: ninguém adivinha
});
