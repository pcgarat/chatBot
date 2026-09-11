import { describe, expect, it } from "vitest";
import { renderMarkdownHtml } from "./markdown.js";

describe("renderMarkdownHtml", () => {
  it("pinta títulos, énfasis, hr y escapa HTML crudo", () => {
    const html = renderMarkdownHtml(
      "**La Novia y el Espejo**\n\n---\n\n### **I. La Mentira**\n\n*\"No es para eso\"*, me dije. <script>x</script>"
    );
    expect(html).toContain("<strong>La Novia y el Espejo</strong>");
    expect(html).toContain('<hr class="md-hr" />');
    expect(html).toContain('<h3 class="md-h md-h3"><strong>I. La Mentira</strong></h3>');
    expect(html).toContain("<em");
    expect(html).toContain("No es para eso");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renderiza listas y código en línea", () => {
    const html = renderMarkdownHtml("- uno\n- dos\n\nUsa `foo` aquí.");
    expect(html).toContain('<ul class="md-list md-list-ul">');
    expect(html).toContain("<li>uno</li>");
    expect(html).toContain("<li>dos</li>");
    expect(html).toContain('<code class="md-code">foo</code>');
  });
});
