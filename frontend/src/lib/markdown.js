function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Subconjunto Markdown seguro: escapa HTML y luego aplica marcas.
 * Cubre lo habitual en respuestas de modelos (títulos, énfasis, listas, código, hr).
 */
export function renderMarkdownHtml(text) {
  const raw = text == null ? "" : String(text);
  if (!raw) return "";
  const fences = [];
  let body = raw.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const i = fences.length;
    fences.push(
      `<pre class="md-code-block"><code${lang.trim() ? ` data-lang="${escapeHtml(lang.trim())}"` : ""}>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`
    );
    return `\u0000FENCE${i}\u0000`;
  });
  const lines = body.split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^\u0000FENCE(\d+)\u0000$/);
    if (fenceMatch) {
      blocks.push(fences[Number(fenceMatch[1])]);
      i += 1;
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line) && line.replace(/\s/g, "").length >= 3) {
      blocks.push('<hr class="md-hr" />');
      i += 1;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level} class="md-h md-h${level}">${renderInlineMarkdown(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(`<blockquote class="md-quote">${renderMarkdownHtml(quote.join("\n"))}</blockquote>`);
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""));
        i += 1;
      }
      const tag = ordered ? "ol" : "ul";
      blocks.push(
        `<${tag} class="md-list md-list-${ordered ? "ol" : "ul"}">` +
          items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("") +
          `</${tag}>`
      );
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const para = [];
    while (i < lines.length) {
      const cur = lines[i];
      if (!cur.trim()) break;
      if (/^\u0000FENCE\d+\u0000$/.test(cur)) break;
      if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(cur) && cur.replace(/\s/g, "").length >= 3) break;
      if (/^#{1,6}\s+/.test(cur)) break;
      if (/^\s*>\s?/.test(cur)) break;
      if (/^\s*([-*+]|\d+\.)\s+/.test(cur)) break;
      para.push(cur);
      i += 1;
    }
    blocks.push(`<p class="md-p">${para.map(renderInlineMarkdown).join("<br>")}</p>`);
  }
  return blocks.join("");
}

export function renderInlineMarkdown(text) {
  let s = escapeHtml(text == null ? "" : String(text));
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, code) => {
    const i = codes.length;
    codes.push(`<code class="md-code">${code}</code>`);
    return `\u0000CODE${i}\u0000`;
  });
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => {
    return `<a class="md-link" href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  s = s.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return s;
}
