import { describe, it, expect } from "vitest";
import {
  indexOfMessage,
  initialViewStartIndex,
  clampViewStartIndex,
  messagesInWindow,
  canLoadOlderMessage,
  loadOlderViewStartIndex,
} from "./messageWindow.js";

const path = [
  { id: "u1", role: "user" },
  { id: "a1", role: "assistant" },
  { id: "u2", role: "user" },
  { id: "a2", role: "assistant" },
];

describe("messageWindow", () => {
  it("al abrir sin foco arranca en el último mensaje", () => {
    expect(initialViewStartIndex(path, null)).toBe(3);
    expect(messagesInWindow(path, initialViewStartIndex(path, null))).toEqual([path[3]]);
  });

  it("al abrir con foco (path recortado al leaf) arranca solo en ese mensaje", () => {
    const focused = path.slice(0, 2); // leaf = a1
    expect(initialViewStartIndex(focused, "a1")).toBe(1);
    expect(messagesInWindow(focused, 1)).toEqual([focused[1]]);
  });

  it("load older retrocede de uno en uno", () => {
    let start = initialViewStartIndex(path, "a2");
    expect(messagesInWindow(path, start)).toEqual([path[3]]);
    expect(canLoadOlderMessage(start)).toBe(true);
    start = loadOlderViewStartIndex(start);
    expect(messagesInWindow(path, start)).toEqual([path[2], path[3]]);
    start = loadOlderViewStartIndex(start);
    expect(messagesInWindow(path, start)).toEqual([path[1], path[2], path[3]]);
    start = loadOlderViewStartIndex(start);
    expect(messagesInWindow(path, start)).toEqual(path);
    expect(canLoadOlderMessage(start)).toBe(false);
    expect(loadOlderViewStartIndex(start)).toBe(0);
  });

  it("mensajes nuevos tras el ancla siguen visibles sin mover viewStart", () => {
    const start = initialViewStartIndex(path, "a2");
    const grown = path.concat([{ id: "u3", role: "user" }, { id: "a3", role: "assistant" }]);
    expect(messagesInWindow(grown, start).map((m) => m.id)).toEqual(["a2", "u3", "a3"]);
  });

  it("clamp y búsqueda toleran ids ausentes o índices fuera de rango", () => {
    expect(indexOfMessage(path, "nope")).toBe(-1);
    expect(initialViewStartIndex(path, "nope")).toBe(3);
    expect(clampViewStartIndex(path, -2)).toBe(0);
    expect(clampViewStartIndex(path, 99)).toBe(3);
    expect(messagesInWindow([], 0)).toEqual([]);
    expect(initialViewStartIndex([], null)).toBe(0);
  });
});
