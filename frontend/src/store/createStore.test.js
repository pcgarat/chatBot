import { describe, it, expect } from "vitest";
import { createStore } from "./createStore.js";

describe("createStore", () => {
  it("get, set y subscribe", () => {
    const store = createStore({ n: 1 });
    expect(store.get().n).toBe(1);
    const seen = [];
    const unsub = store.subscribe((s) => seen.push(s.n));
    store.set({ n: 2 });
    expect(store.get().n).toBe(2);
    expect(seen).toEqual([2]);
    unsub();
    store.set({ n: 3 });
    expect(seen).toEqual([2]);
  });

  it("acepta parche funcional", () => {
    const store = createStore({ n: 1 });
    store.set((s) => ({ ...s, n: s.n + 1 }));
    expect(store.get().n).toBe(2);
  });
});
