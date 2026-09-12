import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "style.css");
const css = readFileSync(cssPath, "utf8");

function instrumentsBlock() {
  return css.slice(css.indexOf("Panel derecho: sistema de instrumentos"));
}

function remOf(token) {
  const match = instrumentsBlock().match(
    new RegExp(`${token}\\s*:\\s*calc\\((\\d+(?:\\.\\d+)?)rem`),
  );
  expect(match, `token ${token}`).toBeTruthy();
  return Number(match[1]);
}

describe("panel derecho: padding horizontal equilibrado", () => {
  it("define tokens asimétricos para compensar el aire del scroll", () => {
    const instruments = instrumentsBlock();
    expect(instruments).toMatch(/--rp-pad-x-start\s*:\s*8px/);
    expect(instruments).toMatch(/--rp-pad-x-end\s*:\s*16px/);
  });

  it("aplica más padding a la derecha que a la izquierda en el acordeón abierto", () => {
    expect(instrumentsBlock()).toMatch(
      /\.column-right \.sidebar-tab-panel > \.accordion-list > \.accordion-section\.is-open > \.accordion-content\s*\{[^}]*padding\s*:\s*var\(--rp-space-1\)\s+var\(--rp-pad-x-end\)\s+var\(--rp-pad-y\)\s+var\(--rp-pad-x-start\)/,
    );
  });
});

describe("panel derecho: jerarquía tipográfica de acordeones", () => {
  it("mantiene título de sección por encima de labels y body", () => {
    expect(remOf("--rp-title")).toBeGreaterThan(remOf("--rp-label"));
    expect(remOf("--rp-title")).toBeGreaterThan(remOf("--rp-body"));
    expect(remOf("--rp-label")).toBeGreaterThanOrEqual(remOf("--rp-caption"));
    expect(remOf("--rp-label")).toBeGreaterThanOrEqual(remOf("--rp-hint"));
  });

  it("alinea labels de controles al token --rp-label, no al de título", () => {
    const instruments = instrumentsBlock();
    expect(instruments).toMatch(
      /\.column-right \.pref-row-label\s*\{[^}]*font-size\s*:\s*var\(--rp-label\)/,
    );
    expect(instruments).toMatch(
      /\.column-right \.param-label[\s\S]*?font-size\s*:\s*var\(--rp-label\)/,
    );
    expect(instruments).toMatch(
      /\.column-right \.accordion-title[\s\S]*?font-size\s*:\s*var\(--rp-title\)/,
    );
  });

  it("no deja subtítulos de sección más pequeños que los labels", () => {
    expect(instrumentsBlock()).toMatch(
      /\.column-right \.panel-section-title\s*\{[^}]*font-size\s*:\s*var\(--rp-label\)/,
    );
  });
});
