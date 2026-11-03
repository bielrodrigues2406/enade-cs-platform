import "@angular/compiler";
import { test } from "node:test";
import assert from "node:assert/strict";
import { EngagementService, type Engagement } from "../apps/web/src/engagement.service.js";

function snapshot(goal: number, today: number): Engagement {
  return { goal, today, streak: today ? 1 : 0, best: today ? 1 : 0, days: [], achievements: [] };
}
function delayedRequests() {
  const original = globalThis.fetch;
  const requests: { method: string; resolve: (body: Engagement) => void }[] = [];
  globalThis.fetch = (async (_url, init) => new Promise<Response>(resolve => {
    requests.push({ method: init?.method ?? "GET", resolve: body => resolve(Response.json(body)) });
  })) as typeof fetch;
  return { requests, restore: () => { globalThis.fetch = original; } };
}

test("engagement coalesces refreshes within one identity", async () => {
  const { requests, restore } = delayedRequests();
  try {
    const service = new EngagementService();
    const first = service.refresh();
    assert.equal(service.refresh(), first);
    assert.equal(requests.length, 1);
    const data = snapshot(5, 2);
    requests[0].resolve(data);
    await first;
    assert.deepEqual(service.state(), data);
  } finally { restore(); }
});

for (const oldFirst of [true, false]) {
  test(`changing identity ignores an old engagement response arriving ${oldFirst ? "before" : "after"} the new one`, async () => {
    const { requests, restore } = delayedRequests();
    try {
      const service = new EngagementService();
      const old = service.refresh();
      service.clear();
      const current = service.refresh();
      assert.notEqual(current, old);
      assert.equal(requests.length, 2, "a nova identidade inicia sua própria leitura");
      const oldData = snapshot(5, 0), currentData = snapshot(10, 3);
      if (oldFirst) {
        requests[0].resolve(oldData);
        await old;
        assert.equal(service.state(), null);
        assert.equal(service.refresh(), current, "o finally antigo não limpa o pedido atual");
        assert.equal(requests.length, 2);
        requests[1].resolve(currentData);
        await current;
      } else {
        requests[1].resolve(currentData);
        await current;
        requests[0].resolve(oldData);
        await old;
      }
      assert.deepEqual(service.state(), currentData);
    } finally { restore(); }
  });
}

test("a goal update from the previous identity cannot replace the current progress", async () => {
  const { requests, restore } = delayedRequests();
  try {
    const service = new EngagementService();
    const old = service.setGoal(30);
    assert.equal(requests[0].method, "PUT");
    service.clear();
    const current = service.refresh();
    const currentData = snapshot(5, 2);
    requests[1].resolve(currentData);
    await current;
    requests[0].resolve(snapshot(30, 0));
    await old;
    assert.deepEqual(service.state(), currentData);
  } finally { restore(); }
});
