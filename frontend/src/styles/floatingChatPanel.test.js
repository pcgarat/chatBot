import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "style.css");
const css = readFileSync(cssPath, "utf8");

function blockFor(selector) {
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\}`,
    "g",
  );
  const blocks = [];
  let match;
  while ((match = re.exec(css)) !== null) {
    blocks.push(match[1]);
  }
  return blocks.join("\n");
}

describe("layout: conversación flotante sobre lienzo unificado", () => {
  it("define tokens de lienzo e isla de conversación", () => {
    expect(css).toMatch(/--shell-canvas\s*:/);
    expect(css).toMatch(/--chat-island-radius\s*:/);
    expect(css).toMatch(/--chat-island-shadow\s*:/);
  });

  it("deja el chat-column como isla redondeada sin trazo de borde", () => {
    const island = blockFor(".column-center > .chat-column");
    expect(island).toMatch(/border-radius\s*:\s*var\(--chat-island-radius\)/);
    expect(island).toMatch(/border\s*:\s*none/);
    expect(island).toMatch(/box-shadow\s*:\s*none/);
    expect(island).toMatch(/background(?:-color)?\s*:\s*var\(--chat-island-bg/);
  });

  it("elimina los bordes que separan columnas del shell", () => {
    const section = css.slice(css.lastIndexOf("Layout: lienzo unificado"));
    expect(section).toMatch(/border(?:-left|-right)?\s*:\s*none\s*!important/);
    expect(section).toMatch(/\.column-left,\s*\n\.column-right\s*\{[\s\S]*?border-color\s*:\s*transparent/);
  });

  it("unifica el fondo del shell fuera de la isla de conversación", () => {
    expect(css).toMatch(/body\s*\{[\s\S]*?background\s*:\s*var\(--shell-canvas\)/);
    expect(css).toMatch(/\.column-center[\s\S]{0,220}background\s*:\s*var\(--shell-canvas\)/);
  });

  it("elimina bordes de secciones, acordeones y filas del shell", () => {
    const section = css.slice(css.lastIndexOf("Layout: lienzo unificado"));
    expect(section).toMatch(/\.accordion-section[\s\S]{0,120}border(?:-bottom)?\s*:\s*none/);
    expect(section).toMatch(/\.panel-section[\s\S]{0,120}border(?:-bottom)?\s*:\s*none/);
    expect(section).toMatch(/\.pref-row[\s\S]{0,120}border(?:-bottom)?\s*:\s*none/);
    expect(section).toMatch(/\.debug-accordion[\s\S]{0,160}border(?:-top)?\s*:\s*none/);
  });

  it("fuerza el mismo color de fondo en laterales y chrome fuera del centro", () => {
    const section = css.slice(css.lastIndexOf("Layout: lienzo unificado"));
    expect(section).toMatch(/\.accordion-header[\s\S]{0,120}background(?:-color)?\s*:\s*transparent/);
    expect(section).toMatch(/\.sidebar-tab-rail[\s\S]{0,120}background\s*:\s*transparent/);
    expect(section).toMatch(/\.column-left[\s\S]{0,200}background\s*:\s*var\(--shell-canvas\)/);
  });

  it("iguala settings-model-pin y column-center al lienzo plano sin gradientes", () => {
    const section = css.slice(css.lastIndexOf("Layout: lienzo unificado"));
    expect(section).toMatch(/\.settings-model-pin[\s\S]{0,160}background\s*:\s*var\(--shell-canvas\)\s*!important/);
    expect(section).toMatch(/\.column-center\.chat-area\.main-pane[\s\S]{0,160}background-image\s*:\s*none\s*!important/);
  });

  it("elimina trazos de borde en controles (inputs, botones, chips)", () => {
    const section = css.slice(css.lastIndexOf("Controles sin trazo"));
    expect(section.length).toBeGreaterThan(40);
    expect(section).toMatch(/input:not\(\[type="checkbox"\]\)[\s\S]{0,400}border\s*:\s*none\s*!important/);
    expect(section).toMatch(/\.icon-btn[\s\S]{0,200}border\s*:\s*none\s*!important/);
    expect(section).toMatch(/:focus-visible/);
  });

  it("deja las burbujas de mensaje en blanco y sin borde", () => {
    const section = css.slice(css.lastIndexOf("Mensajes: fondo blanco"));
    expect(section.length).toBeGreaterThan(40);
    expect(section).toMatch(/\.message-bubble[\s\S]{0,200}background(?:-color)?\s*:\s*#ffffff\s*!important/);
    expect(section).toMatch(/\.message-bubble[\s\S]{0,200}border\s*:\s*none\s*!important/);
  });

  it("deja los toggles centrales sin borde, fondo lienzo y texto muted/acento", () => {
    const section = css.slice(css.lastIndexOf("Toggles centrales"));
    expect(section).toMatch(/\.center-view-toggle[\s\S]{0,200}background\s*:\s*var\(--shell-canvas\)\s*!important/);
    expect(section).toMatch(/color\s*:\s*var\(--muted-foreground\)\s*!important/);
    expect(section).toMatch(/\[aria-pressed="true"\][\s\S]{0,120}color\s*:\s*var\(--accent\)\s*!important/);
    expect(section).toMatch(/\.chat-session-actions \.chat-delete-btn\.icon-btn-danger[\s\S]{0,200}color\s*:\s*var\(--muted-foreground\)\s*!important/);
    expect(section).toMatch(/#btn-new-chat[\s\S]{0,280}background\s*:\s*#0078d4\s*!important/);
    expect(section).toMatch(/#btn-new-chat[\s\S]{0,280}color\s*:\s*#ffffff\s*!important/);
    expect(section).toMatch(/#btn-prompt-generator[\s\S]{0,280}background\s*:\s*transparent\s*!important/);
    expect(section).toMatch(/#btn-prompt-generator[\s\S]{0,280}color\s*:\s*#0b5fa5\s*!important/);
    expect(section).toMatch(/#btn-new-chat,\s*\n?#btn-prompt-generator[\s\S]{0,200}border\s*:\s*none\s*!important/);
  });

  it("aplica padding y fade vertical al stream de mensajes", () => {
    const section = css.slice(css.lastIndexOf("Stream de mensajes: padding"));
    expect(section).toMatch(/--chat-stream-fade-top/);
    expect(section).toMatch(/--chat-stream-fade-bottom/);
    expect(section).toMatch(/linear-gradient/);
    expect(section).toMatch(/#messages-container[\s\S]{0,200}padding-top/);
    expect(section).toMatch(/padding-bottom/);
    expect(section).toMatch(/\.chat-stream-wrap::before/);
    expect(section).toMatch(/\.chat-stream-wrap::after/);
  });

  it("usa scrollbar más claro basado en el color del panel en el historial", () => {
    expect(css).toMatch(
      /--history-scroll-thumb\s*:\s*color-mix\(in srgb, var\(--shell-canvas\) 50%, #ffffff\)/
    );
    expect(css).toMatch(
      /\.column-left \.conversations-list-wrap\.is-scrollbar-visible[\s\S]{0,120}scrollbar-color\s*:\s*var\(--history-scroll-thumb\)/
    );
    expect(css).toMatch(
      /\.column-left \.conversations-list-wrap\.is-scrollbar-visible::-webkit-scrollbar-thumb[\s\S]{0,120}var\(--history-scroll-thumb\)/
    );
  });

  it("usa scrollbar suave sobre el fondo blanco del chat, revelado como el historial", () => {
    expect(css).toMatch(
      /--chat-scroll-thumb\s*:\s*color-mix\(in srgb, #000000 12%, transparent\)/
    );
    expect(css).toMatch(
      /#messages-container\.scroll-y-reveal\.is-scrollbar-visible[\s\S]{0,120}scrollbar-color\s*:\s*var\(--chat-scroll-thumb\)/
    );
  });

  it("usa el azul de sidebar-add-btn en switches y checks activos", () => {
    expect(css).toMatch(
      /\.fluent-switch-input:checked \+ \.fluent-switch-track\s*\{[^}]*accent-light-strong/
    );
    expect(css).toMatch(/\.checkbox-box\.checked[\s\S]{0,160}accent-light-strong/);
  });
});
