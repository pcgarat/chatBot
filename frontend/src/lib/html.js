import { layoutStore } from "../store/layout.js";
import { renderMarkdownHtml } from "./markdown.js";

export function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function wantsMarkdown(options) {
  if (options && typeof options.markdown === "boolean") return options.markdown;
  try {
    return !!layoutStore.get().renderMarkdown;
  } catch (_) {
    return true;
  }
}

/** Escapa texto pero conserva img/placeholder/error de ilustración y marcadores. */
export function formatMessageHtml(content, paragraphStart, options) {
  const startIndex = paragraphStart == null ? 0 : paragraphStart;
  const markdown = wantsMarkdown(options);
  const raw = content == null ? "" : String(content);
  const tokens = [];
  const pattern =
    /(<img\b[^>]*class="[^"]*chat-illustration[^"]*"[^>]*>|<span\b[^>]*class="[^"]*chat-illustration-(?:error|placeholder)[^"]*"[^>]*>[\s\S]*?<\/span>|⟦img:[^⟧]+⟧)/gi;
  let last = 0;
  let m;
  while ((m = pattern.exec(raw)) !== null) {
    if (m.index > last) tokens.push({ t: "text", v: raw.slice(last, m.index) });
    const piece = m[0];
    if (piece.startsWith("⟦img:")) {
      tokens.push({
        t: "html",
        v: `<span class="chat-illustration-placeholder">Generando imagen…\n\n${escapeHtml(piece)}</span>`,
      });
    } else {
      tokens.push({ t: "html", v: piece });
    }
    last = m.index + piece.length;
  }
  if (last < raw.length) tokens.push({ t: "text", v: raw.slice(last) });
  trimIllustrationAdjacentWhitespace(tokens);
  if (!tokens.some((tok) => tok.t === "html")) {
    const plain = tokens.map((tok) => tok.v).join("");
    return wrapNarrativeParagraphs(plain, startIndex, markdown);
  }
  return layoutIllustratedHtml(tokens, startIndex, markdown);
}

export function stripIllustrationArtifactsClient(text) {
  return String(text || "")
    .replace(/<img\b[^>]*class="[^"]*chat-illustration[^"]*"[^>]*>/gi, "")
    .replace(
      /<span\b[^>]*class="[^"]*chat-illustration-(?:error|placeholder)[^"]*"[^>]*>[\s\S]*?<\/span>/gi,
      ""
    )
    .replace(/⟦img:[^⟧]+⟧/g, "");
}

export function countNarrativeParagraphs(content) {
  return splitIllustrationParagraphs(stripIllustrationArtifactsClient(content)).length;
}

export function narrativeParagraphHtml(text, index, className, markdown = false) {
  const inner = markdown
    ? renderMarkdownHtml(text)
    : escapeHtml(text).replace(/\n/g, "<br>");
  const mdClass = markdown ? " message-md" : "";
  return (
    `<div class="${className} chat-paragraph${mdClass}" data-paragraph-index="${index}">` +
    `${inner}</div>`
  );
}

export function wrapNarrativeParagraphs(text, startIndex, markdown = false) {
  const paras = splitIllustrationParagraphs(text);
  if (!paras.length) {
    const raw = String(text || "");
    if (!raw.trim()) return "";
    return narrativeParagraphHtml(raw, startIndex, "illustration-lead", markdown);
  }
  return paras
    .map((p, i) => narrativeParagraphHtml(p, startIndex + i, "illustration-lead", markdown))
    .join("");
}

export function splitIllustrationParagraphs(text) {
  return String(text || "")
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function wrapIllustrationMarkup(html) {
  const s = String(html || "");
  if (s.includes("chat-illustration-frame")) return s;
  if (/<img\b[^>]*chat-illustration/i.test(s)) {
    return `<span class="chat-illustration-frame">${s}</span>`;
  }
  return s;
}

export function isWrapIllustrationHtml(html) {
  const s = String(html || "");
  if (/chat-illustration-error/.test(s)) return false;
  return /chat-illustration/.test(s);
}

/**
 * Párrafo previo a cada imagen: fila completa.
 * Lo que sigue envuelve a la derecha; el previo a la siguiente imagen
 * queda fuera de esa unidad para no meterse en el hueco que sobre.
 */
export function layoutIllustratedHtml(tokens, paragraphStart, markdown = false) {
  const startIndex = paragraphStart == null ? 0 : paragraphStart;
  const items = [];
  tokens.forEach((tok) => {
    if (tok.t === "html") {
      items.push({
        kind: isWrapIllustrationHtml(tok.v) ? "illust" : "html",
        v: tok.v,
      });
      return;
    }
    splitIllustrationParagraphs(tok.v).forEach((p) => {
      items.push({ kind: "para", v: p });
    });
  });

  const out = [];
  let i = 0;
  let paraIndex = startIndex;
  while (i < items.length) {
    const item = items[i];
    if (item.kind === "para") {
      out.push(narrativeParagraphHtml(item.v, paraIndex, "illustration-lead", markdown));
      paraIndex += 1;
      i += 1;
      continue;
    }
    if (item.kind === "html") {
      out.push(item.v);
      i += 1;
      continue;
    }

    let nextIllust = -1;
    for (let k = i + 1; k < items.length; k++) {
      if (items[k].kind === "illust") {
        nextIllust = k;
        break;
      }
    }
    const hasNext = nextIllust !== -1;
    const limit = hasNext ? nextIllust : items.length;
    const following = [];
    for (let j = i + 1; j < limit; j++) {
      if (items[j].kind !== "para") break;
      following.push(items[j]);
    }
    let wrapParas = following;
    if (hasNext && following.length) {
      wrapParas = following.slice(0, -1);
    }
    const ownerIndex = paraIndex > 0 ? paraIndex - 1 : Math.max(0, startIndex - 1);
    const wrapHtml = wrapParas
      .map((p) => {
        const html = narrativeParagraphHtml(p.v, paraIndex, "illustration-wrap", markdown);
        paraIndex += 1;
        return html;
      })
      .join("");
    out.push(
      `<div class="illustration-unit" data-owner-paragraph-index="${ownerIndex}">${wrapIllustrationMarkup(item.v)}${wrapHtml}</div>`
    );
    i += 1 + wrapParas.length;
  }
  return out.join("");
}

/** Sin esto, los \n junto al <img> se vuelven <br> y dejan el hueco del float vacío. */
export function trimIllustrationAdjacentWhitespace(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].t !== "html") continue;
    if (i > 0 && tokens[i - 1].t === "text") {
      tokens[i - 1].v = tokens[i - 1].v.replace(/(\n[ \t]*)+$/, "\n");
    }
    if (i + 1 < tokens.length && tokens[i + 1].t === "text") {
      tokens[i + 1].v = tokens[i + 1].v.replace(/^[ \t]*\n+/, "");
    }
  }
}

/**
 * Separa el primer párrafo del resto.
 * Prioriza bloques separados por línea en blanco; si no hay, usa el primer salto
 * de línea cuando el resto aporta contenido relevante.
 */
export function splitFirstParagraph(content) {
  const raw = content == null ? "" : String(content);
  const blank = raw.match(/^([\s\S]*?)(\n\s*\n+)([\s\S]+)$/);
  if (blank && blank[3].trim()) {
    return { first: blank[1], rest: blank[2] + blank[3], collapsible: true };
  }
  const single = raw.match(/^([^\n]+)(\n+)([\s\S]+)$/);
  if (single && single[3].trim()) {
    const restTrim = single[3].trim();
    if (restTrim.length >= 80 || /\n/.test(restTrim)) {
      return { first: single[1], rest: single[2] + single[3], collapsible: true };
    }
  }
  return { first: raw, rest: "", collapsible: false };
}

export function messageCollapseKey(m, idx) {
  return m && m.id ? String(m.id) : `idx:${idx}`;
}

export function buildCollapsibleMessageHtml(content, key, collapsed, options) {
  const parts = splitFirstParagraph(content);
  if (!parts.collapsible) {
    return `<div class="message-content">${formatMessageHtml(content || "", 0, options)}</div>`;
  }
  const toggleLabel = collapsed ? "Show more" : "Show less";
  const restOffset = countNarrativeParagraphs(parts.first);
  return `<div class="message-body-collapsible${collapsed ? " is-collapsed" : ""}" data-collapse-key="${escapeHtml(key)}">
    <div class="message-content-preview">${formatMessageHtml(parts.first, 0, options)}</div>
    <div class="message-content-rest">${formatMessageHtml(parts.rest, restOffset, options)}</div>
    <button type="button" class="msg-collapse-toggle" aria-expanded="${collapsed ? "false" : "true"}">${toggleLabel}</button>
  </div>`;
}

export { saveLastConversationId } from "../store/session.js";

export function enhanceIllustrationFrames(root) {
  if (!root) return;
  root.querySelectorAll("img.chat-illustration").forEach(function (img) {
    let frame = img.closest(".chat-illustration-frame");
    if (!frame) {
      const parent = img.parentNode;
      if (!parent) return;
      frame = document.createElement("span");
      frame.className = "chat-illustration-frame";
      parent.insertBefore(frame, img);
      frame.appendChild(img);
    }
    if (frame.getAttribute("data-enhanced") === "1") return;
    frame.setAttribute("data-enhanced", "1");
    img.addEventListener("error", function () {
      frame.classList.add("chat-illustration-missing");
    });
    if (img.complete && img.naturalWidth === 0) {
      frame.classList.add("chat-illustration-missing");
    }
  });
}

export function kickLazyIllustrations(root) {
  if (!root) return;
  root.querySelectorAll("img.chat-illustration").forEach(function (img) {
    if (img.naturalWidth > 0) return;
    try {
      img.loading = "eager";
    } catch (_) {}
    const src = img.getAttribute("src");
    if (src) img.src = src;
  });
  enhanceIllustrationFrames(root);
}

export function revealLazyIllustrations(root) {
  kickLazyIllustrations(root);
}

