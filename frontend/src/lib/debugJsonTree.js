import { escapeHtml } from "./html.js";

const STRING_PREVIEW_LEN = 80;

export function encodeJsonPath(parts) {
  return (parts || [])
    .map((part) => encodeURIComponent(String(part)))
    .join("/");
}

export function decodeJsonPath(encoded) {
  if (!encoded) return [];
  return String(encoded)
    .split("/")
    .filter((part) => part !== "")
    .map((part) => {
      const decoded = decodeURIComponent(part);
      if (/^\d+$/.test(decoded)) return Number(decoded);
      return decoded;
    });
}

export function parseDebugJson(value) {
  if (value == null || value === "") return value;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch (_) {}
  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) {
    const parsed = [];
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line));
      } catch (_) {
        return value;
      }
    }
    return parsed;
  }
  return value;
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isExpandable(value) {
  if (Array.isArray(value)) return true;
  if (isPlainObject(value)) return true;
  if (typeof value === "string" && value.length > STRING_PREVIEW_LEN) return true;
  return false;
}

function summaryFor(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (isPlainObject(value)) {
    const n = Object.keys(value).length;
    return `{${n}}`;
  }
  if (typeof value === "string") {
    if (value.length <= STRING_PREVIEW_LEN) return JSON.stringify(value);
    return JSON.stringify(value.slice(0, STRING_PREVIEW_LEN) + "…");
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function valueClass(value) {
  if (value === null) return "json-null";
  if (typeof value === "string") return "json-string";
  if (typeof value === "number") return "json-number";
  if (typeof value === "boolean") return "json-boolean";
  if (Array.isArray(value) || isPlainObject(value)) return "json-container";
  return "json-other";
}

function entriesOf(value) {
  if (Array.isArray(value)) {
    return value.map((item, index) => [index, item]);
  }
  if (isPlainObject(value)) {
    return Object.keys(value).map((key) => [key, value[key]]);
  }
  return [];
}

function renderNode(key, value, pathParts, isExpanded) {
  const path = encodeJsonPath(pathParts);
  const expandable = isExpandable(value);
  const open = expandable && isExpanded(pathParts);
  const keyHtml =
    key === null
      ? ""
      : `<span class="json-key">${escapeHtml(String(key))}</span><span class="json-colon">:</span> `;

  if (!expandable) {
    return (
      `<div class="json-node json-leaf" data-json-path="${escapeHtml(path)}">` +
      keyHtml +
      `<span class="json-value ${valueClass(value)}">${escapeHtml(summaryFor(value))}</span>` +
      `</div>`
    );
  }

  if (typeof value === "string") {
    const body = open
      ? `<pre class="json-string-full">${escapeHtml(value)}</pre>`
      : `<span class="json-value json-string">${escapeHtml(summaryFor(value))}</span>`;
    return (
      `<div class="json-node json-expandable${open ? " is-open" : ""}" data-json-path="${escapeHtml(path)}">` +
      `<button type="button" class="json-toggle" aria-expanded="${open ? "true" : "false"}" data-json-path="${escapeHtml(path)}">` +
      `<span class="json-chevron" aria-hidden="true"></span>` +
      keyHtml +
      (open ? "" : body) +
      `</button>` +
      (open ? `<div class="json-children">${body}</div>` : "") +
      `</div>`
    );
  }

  const children = open
    ? entriesOf(value)
        .map(([childKey, childValue]) =>
          renderNode(childKey, childValue, pathParts.concat([childKey]), isExpanded)
        )
        .join("")
    : "";

  return (
    `<div class="json-node json-expandable${open ? " is-open" : ""}" data-json-path="${escapeHtml(path)}">` +
    `<button type="button" class="json-toggle" aria-expanded="${open ? "true" : "false"}" data-json-path="${escapeHtml(path)}">` +
    `<span class="json-chevron" aria-hidden="true"></span>` +
    keyHtml +
    `<span class="json-value ${valueClass(value)}">${escapeHtml(summaryFor(value))}</span>` +
    `</button>` +
    (open ? `<div class="json-children">${children}</div>` : "") +
    `</div>`
  );
}

export function jsonSectionHtml({ label, value, path, isExpanded }) {
  if (value == null || value === "") return "";
  const parsed = parseDebugJson(value);
  const rootPath = Array.isArray(path) ? path : [path || "value"];
  const expanded = typeof isExpanded === "function" ? isExpanded : () => false;

  let body;
  if (Array.isArray(parsed) || isPlainObject(parsed)) {
    body = entriesOf(parsed)
      .map(([childKey, childValue]) =>
        renderNode(childKey, childValue, rootPath.concat([childKey]), expanded)
      )
      .join("");
  } else if (typeof parsed === "string" && parsed.length > STRING_PREVIEW_LEN) {
    body = renderNode(null, parsed, rootPath, expanded);
  } else if (
    typeof parsed === "string" ||
    typeof parsed === "number" ||
    typeof parsed === "boolean" ||
    parsed === null
  ) {
    body =
      `<div class="json-node json-leaf">` +
      `<span class="json-value ${valueClass(parsed)}">${escapeHtml(summaryFor(parsed))}</span>` +
      `</div>`;
  } else {
    body = `<pre class="json-fallback">${escapeHtml(String(parsed))}</pre>`;
  }

  return (
    `<section class="json-tree" data-json-root="${escapeHtml(encodeJsonPath(rootPath))}">` +
    `<h4 class="json-tree-label">${escapeHtml(label)}</h4>` +
    body +
    `</section>`
  );
}
