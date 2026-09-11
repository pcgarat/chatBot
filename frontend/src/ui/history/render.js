import { CONV_GROUP_LABELS } from "../../lib/forest.js";
import {
  buildConversationForest,
  getConversationGroup,
  conversationGroupTs,
  conversationWhenIso,
} from "../../lib/forest.js";
import { formatDate, formatDateTime } from "../../lib/dates.js";
import { escapeHtml } from "../../lib/html.js";

export function renderConversationsList(list, currentConversationId, sort) {
  const { roots, childrenByParent } = buildConversationForest(list || [], sort);
  const groups = { hoy: [], ayer: [], semana: [], anteriores: [] };
  roots.forEach((c) => {
    const g = getConversationGroup(new Date(conversationGroupTs(c, childrenByParent, sort)));
    groups[g].push(c);
  });
  const order = ["hoy", "ayer", "semana", "anteriores"];
  const renderItem = (c, depth) => {
    const when = formatDate(conversationWhenIso(c, sort));
    const meta = `${c.provider || "ollama"}/${c.model_id} · ${when}`;
    const kids = childrenByParent.get(c.id) || [];
    const item = `<div class="conversation-item ${c.id === currentConversationId ? "active" : ""} ${depth ? "conversation-item-fork" : ""}" data-id="${escapeHtml(c.id)}" data-depth="${depth}" title="${escapeHtml(meta)}" style="padding-left: ${8 + depth * 14}px">
                <div class="conv-row">
                  <span class="conv-title">${c.kind === "prompt_generator" ? '<span class="conv-kind-badge" title="Prompt generator">txt2img</span> ' : ""}${escapeHtml(c.title)}</span>
                  <span class="conv-when">${escapeHtml(when)}</span>
                </div>
              </div>`;
    return item + kids.map((ch) => renderItem(ch, depth + 1)).join("");
  };
  return order
    .filter((key) => groups[key].length > 0)
    .map((key) => {
      const header = `<div class="conv-group-label" aria-hidden="true">${escapeHtml(CONV_GROUP_LABELS[key])}</div>`;
      const items = groups[key].map((c) => renderItem(c, 0)).join("");
      return header + items;
    })
    .join("");
}

export function renderMessageHistoryList(list, consultaAssistantId, sort) {
  const items = list || [];
  const groups = { hoy: [], ayer: [], semana: [], anteriores: [] };
  items.forEach((item) => {
    const iso = sort === "image" && item.latest_image_at ? item.latest_image_at : item.created_at;
    groups[getConversationGroup(iso)].push(item);
  });
  const order = ["hoy", "ayer", "semana", "anteriores"];
  return order
    .filter((key) => groups[key].length > 0)
    .map((key) => {
      const header = `<div class="conv-group-label" aria-hidden="true">${escapeHtml(CONV_GROUP_LABELS[key])}</div>`;
      const rows = groups[key]
        .map((item) => {
          const created = formatDateTime(item.created_at);
          const preview = item.content_preview || "(sin texto)";
          const convTitle = item.conversation_title || "Conversación";
          const active = item.id === consultaAssistantId ? " active" : "";
          const createdAttr = item.created_at ? escapeHtml(item.created_at) : "";
          return `<div class="conversation-item message-history-item${active}" data-id="${escapeHtml(item.id)}" data-conversation-id="${escapeHtml(item.conversation_id)}" title="${escapeHtml(convTitle + " · " + created)}">
                <div class="conv-row">
                  <span class="conv-title">${escapeHtml(preview)}</span>
                </div>
                <time class="conv-meta message-history-created" datetime="${createdAttr}">${escapeHtml(created)}</time>
              </div>`;
        })
        .join("");
      return header + rows;
    })
    .join("");
}
