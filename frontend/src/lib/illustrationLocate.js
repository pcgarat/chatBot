const SCENE_FILE_RE = /(?:^|_)(s\d+)\.[a-z0-9]+$/i;

export function sceneIdFromFilename(filename) {
  const match = String(filename || "").match(SCENE_FILE_RE);
  return match ? match[1].toLowerCase() : "";
}

export function normalizeSceneId(sceneId) {
  const raw = String(sceneId || "").trim();
  if (!raw) return "";
  if (/^s\d+$/i.test(raw)) return raw.toLowerCase();
  if (/^\d+$/.test(raw)) return "s" + raw;
  return raw;
}

export function resolvedSceneId(filename, sceneId) {
  return normalizeSceneId(sceneId) || sceneIdFromFilename(filename);
}

export function contentHasExactFilename(content, filename) {
  const html = String(content || "");
  const name = String(filename || "");
  if (!name) return false;
  return html.includes('data-filename="' + name + '"') || html.includes("/" + name);
}

export function illustrationNeedleInContent(content, filename, sceneId) {
  const html = String(content || "");
  if (contentHasExactFilename(html, filename)) return true;
  const scene = resolvedSceneId(filename, sceneId);
  if (scene) {
    if (html.includes('data-scene="' + scene + '"')) return true;
    if (html.includes('data-scene-id="' + scene + '"')) return true;
    if (html.includes('alt="escena ' + scene + '"')) return true;
    if (html.toLowerCase().includes("_" + scene + ".")) return true;
  }
  return false;
}

function queryIllustration(scope, selector) {
  try {
    return scope.querySelector(selector);
  } catch (_) {
    return null;
  }
}

export function resolveIllustrationSearch(root, options = {}) {
  const filename = options.filename || "";
  let scope = options.scope || root;
  let allowScene = true;
  if (root && options.messageId) {
    const row = queryIllustration(
      root,
      '.message-row[data-msg-id="' + CSS.escape(String(options.messageId)) + '"]'
    );
    if (row) scope = row;
    else allowScene = false;
  }
  return {
    filename,
    sceneId: allowScene ? options.sceneId || "" : "",
    scope,
    allowScene,
  };
}

export function findChatIllustration(root, options = {}) {
  if (!root) return null;
  const search = resolveIllustrationSearch(root, options);
  const filename = search.filename;
  const scene = search.allowScene ? resolvedSceneId(filename, search.sceneId) : "";
  const scope = search.scope || root;
  let img = null;
  if (filename) {
    img = queryIllustration(
      scope,
      'img.chat-illustration[data-filename="' + CSS.escape(filename) + '"]'
    );
  }
  if (!img && filename) {
    const nodes = scope.querySelectorAll("img.chat-illustration");
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const src = node.getAttribute("src") || "";
      const data = node.getAttribute("data-filename") || "";
      if (data === filename || src.indexOf(filename) >= 0) {
        img = node;
        break;
      }
    }
  }
  if (!img && scene) {
    img = queryIllustration(
      scope,
      'img.chat-illustration[alt="escena ' + CSS.escape(scene) + '"]'
    );
  }
  if (!img && scene) {
    const marked = queryIllustration(scope, '[data-scene="' + CSS.escape(scene) + '"]');
    if (marked) {
      if (marked.matches("img.chat-illustration") || marked.matches("img")) img = marked;
      else img = marked.querySelector("img.chat-illustration") || marked.querySelector("img");
    }
  }
  if (!img && scene) {
    const suffix = "_" + scene + ".";
    const nodes = scope.querySelectorAll("img.chat-illustration");
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const data = (node.getAttribute("data-filename") || "").toLowerCase();
      const src = (node.getAttribute("src") || "").toLowerCase();
      if (data.indexOf(suffix) >= 0 || src.indexOf(suffix) >= 0) {
        img = node;
        break;
      }
    }
  }
  if (!img) return null;
  return { img, frame: img.closest(".chat-illustration-frame") || img };
}
