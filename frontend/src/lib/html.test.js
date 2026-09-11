import { beforeEach, describe, expect, it } from "vitest";
import { formatMessageHtml, wrapIllustrationMarkup } from "./html.js";
import { layoutStore } from "../store/layout.js";

describe("ilustraciones en el HTML del mensaje", () => {
  beforeEach(() => {
    layoutStore.set({ ...layoutStore.get(), renderMarkdown: false });
  });

  it("envuelve el img.chat-illustration en el marco que respeta el tamaño de preferencias", () => {
    const html = formatMessageHtml(
      '<img class="chat-illustration" src="/static/illustrated-images/a.jpg" alt="escena 1" />',
      0,
      { markdown: false }
    );
    expect(html).toContain("chat-illustration-frame");
    expect(html).toMatch(
      /<span class="chat-illustration-frame">\s*<img class="chat-illustration"/
    );
  });

  it("no duplica el marco si el img ya viene envuelto", () => {
    const wrapped = wrapIllustrationMarkup(
      '<span class="chat-illustration-frame"><img class="chat-illustration" src="/x.jpg" /></span>'
    );
    expect(wrapped.match(/chat-illustration-frame/g)).toHaveLength(1);
  });
});

describe("markdown en formatMessageHtml", () => {
  it("con markdown activo interpreta títulos y negrita", () => {
    const html = formatMessageHtml("### **Capítulo**\n\nHola **mundo**", 0, { markdown: true });
    expect(html).toContain("message-md");
    expect(html).toContain("<h3");
    expect(html).toContain("<strong>Capítulo</strong>");
    expect(html).toContain("<strong>mundo</strong>");
  });

  it("con markdown desactivado deja las marcas literales", () => {
    const html = formatMessageHtml("### **Capítulo**", 0, { markdown: false });
    expect(html).not.toContain("<h3");
    expect(html).toContain("### **Capítulo**");
  });
});
