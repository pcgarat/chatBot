import { historyStore, CONV_GROUP_LABELS, isMessagesHistoryMode } from "../../store/history.js";
import { sessionStore } from "../../store/session.js";
import { useStore } from "../../hooks/useStore.js";
import { getConversationGroup } from "../../lib/forest.js";
import { formatDateTime } from "../../lib/dates.js";
import {
  loadMessageTreeRoots,
  toggleMessageTreeNode,
  restoreConversationFromTrash,
  permanentlyDeleteFromTrash,
  emptyTrash,
  onLeftHistorySortChange,
  onMessageHistorySearchInput,
  setLeftHistoryMode,
} from "../../app/historyActions.js";
import { newConversation, newPromptGeneratorConversation, openMessageTreeNode } from "../../app/sessionActions.js";
import { setLeftCollapsed } from "../layout/LayoutEffects.jsx";

function MessageTreeNodeRow({ node, depth }) {
  const expanded = useStore(historyStore, (s) => !!(s.treeExpandedIds || {})[node.id]);
  const childrenMap = useStore(historyStore, (s) => s.treeChildrenByParent || {});
  const selectedId = useStore(historyStore, (s) => s.treeSelectedMessageId);
  const focusId = useStore(sessionStore, (s) => s.focusMessageId || s.consultaAssistantId);
  const activeId = selectedId || focusId;
  const kids = childrenMap[node.id] || [];
  const when = formatDateTime(node.created_at);
  const preview = node.content_preview || "(sin texto)";
  const title = node.conversation_title || "Conversación";

  return (
    <>
      <div
        className={`conversation-item message-tree-item${node.id === activeId ? " active" : ""}${
          node.is_fork_edge ? " conversation-item-fork message-tree-item-fork" : ""
        }`}
        data-id={node.id}
        data-conversation-id={node.conversation_id}
        data-depth={depth}
        title={`${title} · ${when}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <div className="conv-row">
          {node.has_children ? (
            <button
              type="button"
              className="message-tree-expand"
              aria-expanded={expanded ? "true" : "false"}
              aria-label={expanded ? "Colapsar" : "Expandir"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMessageTreeNode(node.id);
              }}
            >
              {expanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="message-tree-expand message-tree-expand-spacer" aria-hidden="true" />
          )}
          <button
            type="button"
            className="message-tree-open"
            onClick={() => openMessageTreeNode(node.conversation_id, node.id)}
          >
            <span className="conv-title">
              {node.is_fork_edge ? <span className="conv-kind-badge" title="Fork">fork</span> : null}
              {node.is_fork_edge ? " " : null}
              {preview}
            </span>
          </button>
        </div>
        <time className="conv-meta message-history-created" dateTime={node.created_at || ""}>
          {when}
        </time>
      </div>
      {expanded
        ? kids.map((ch) => <MessageTreeNodeRow key={ch.id} node={ch} depth={depth + 1} />)
        : null}
    </>
  );
}

function groupRootsByConversation(roots) {
  const byConv = new Map();
  (roots || []).forEach((n) => {
    const key = n.conversation_id;
    if (!byConv.has(key)) {
      byConv.set(key, {
        conversation_id: key,
        conversation_title: n.conversation_title || "Conversación",
        created_at: n.created_at,
        nodes: [],
      });
    }
    const g = byConv.get(key);
    g.nodes.push(n);
    if (n.created_at && (!g.created_at || n.created_at > g.created_at)) g.created_at = n.created_at;
  });
  return Array.from(byConv.values()).map((g) => {
    g.nodes.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")) || String(a.id).localeCompare(String(b.id)));
    return g;
  });
}

export function ConversationsList() {
  const roots = useStore(historyStore, (s) => s.treeRoots);
  const total = useStore(historyStore, (s) => s.treeRootsTotal);
  const deleted = useStore(historyStore, (s) => s.deletedConversations);

  const groups = { hoy: [], ayer: [], semana: [], anteriores: [] };
  groupRootsByConversation(roots).forEach((g) => {
    groups[getConversationGroup(g.created_at)].push(g);
  });
  const order = ["hoy", "ayer", "semana", "anteriores"].filter((k) => groups[k].length);

  return (
    <>
      <div className="conversations-list" id="conversations-list">
        {!roots.length ? <p className="conv-group-label">No hay respuestas todavía.</p> : null}
        {order.map((key) => (
          <div key={key}>
            <div className="conv-group-label" aria-hidden="true">
              {CONV_GROUP_LABELS[key]}
            </div>
            {groups[key].map((g) => (
              <div key={g.conversation_id} className="message-tree-conv-group">
                <div className="message-tree-conv-title" title={g.conversation_title}>
                  {g.conversation_title}
                </div>
                {g.nodes.map((n) => (
                  <MessageTreeNodeRow key={n.id} node={n} depth={0} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      {roots.length < total ? (
        <div className="message-history-pager" id="message-tree-pager">
          <span className="message-history-page-meta">
            {roots.length} / {total}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-small message-history-load-more"
            onClick={() => loadMessageTreeRoots({ append: true })}
          >
            Cargar más
          </button>
        </div>
      ) : null}
      <div className="conversations-trash" id="conversations-trash" hidden={!deleted.length}>
        <div className="conversations-trash-header">
          <div className="conv-group-label" id="conversations-trash-label">
            Papelera
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            id="conversations-trash-empty"
            onClick={() => emptyTrash()}
          >
            Vaciar
          </button>
        </div>
        <div className="conversations-trash-list" id="conversations-trash-list">
          {deleted.map((c) => (
            <div key={c.id} className="conversation-item" data-id={c.id}>
              <div className="conv-row">
                <span className="conv-title">{c.title}</span>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => restoreConversationFromTrash(c.id)}>
                  Restaurar
                </button>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => permanentlyDeleteFromTrash(c.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function HistorySortSelect() {
  return null;
}

export { setLeftHistoryMode, newConversation, newPromptGeneratorConversation, onMessageHistorySearchInput, setLeftCollapsed, onLeftHistorySortChange };

// compat: modo mensajes ya no se usa como vista
void isMessagesHistoryMode;
