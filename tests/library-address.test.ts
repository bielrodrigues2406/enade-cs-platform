import { test } from "node:test";
import assert from "node:assert/strict";
import { destinationFromPath, libraryPath, parseLibraryPath, sectionPathOf } from "../apps/web/src/study-navigation.js";

// Endereços da Biblioteca (revisão do Codex, R9): área, lição e ficha no caminho.

test("library paths round-trip area, lesson and sheet", () => {
  for (const path of ["/biblioteca", "/biblioteca/algoritmos", "/biblioteca/sistemas-operacionais/so-deadlock", "/biblioteca/fichas/grafos"])
    assert.equal(libraryPath(parseLibraryPath(path)!), path);
  assert.deepEqual(parseLibraryPath("/biblioteca/algoritmos/alg-busca"), { area: "algoritmos", lesson: "alg-busca", sheet: null });
  assert.deepEqual(parseLibraryPath("/biblioteca/fichas/grafos"), { area: null, lesson: null, sheet: "grafos" });
});

test("malformed library paths are rejected and do not count as the library", () => {
  for (const path of ["/biblioteca/fichas", "/biblioteca/a/b/c", "/biblioteca/Algoritmos", "/biblioteca/a--b", "/biblioteca/../admin", "/bibliotecas", `/biblioteca/${"a".repeat(200)}`])
    assert.equal(parseLibraryPath(path), null, path);
  assert.equal(sectionPathOf("/biblioteca/a/b/c"), "/biblioteca/a/b/c");
  assert.equal(destinationFromPath("/biblioteca/a/b/c"), "questoes");
});

test("library subpaths belong to the library section", () => {
  assert.equal(sectionPathOf("/biblioteca/algoritmos/alg-busca"), "/biblioteca");
  assert.equal(destinationFromPath("/biblioteca/fichas/grafos"), "biblioteca");
  assert.equal(destinationFromPath("/flashcards"), "flashcards");
});
