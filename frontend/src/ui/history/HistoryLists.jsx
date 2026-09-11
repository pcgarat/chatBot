import { historyStore, CONV_SORT_OPTIONS, MSG_SORT_OPTIONS, CONV_GROUP_LABELS, isMessagesHistoryMode } from "../../store/history.js";
import { sessionStore } from "../../store/session.js";
import { useStore } from "../../hooks/useStore.js";
import {
  buildConversationForest,
  getConversationGroup,
  conversationGroupTs,
  conversationWhenIso,
} from "../../lib/forest.js";
import { formatDate, formatDateTime } from "../../lib/dates.js";
import {
  setLeftHistoryMode,
  onLeftHistorySortChange,
  onMessageHistorySearchInput,
  loadMessageHistory,
  deleteConversationFromHistory,
  restoreConversationFromTrash,
  clearConversationHistory,
} from "../../app/historyActions.js";
import { newConversation, newPromptGeneratorConversation, openConversation, openConsultaTurn } from "../../app/sessionActions.js";
import { setLeftCollapsed } from "../layout/LayoutEffects.jsx";

const clearHistoryIconSvg = (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 20H7L3 16l10-10 4 4-6 6h9l4-4"/></svg>
);

function groupedConversations(list, sort, currentId) {
  const { roots, childrenByParent } = buildConversationForest(list || [], sort);
  const groups = { hoy: [], ayer: [], semana: [], anteriores: [] };
  roots.forEach((c) => {
    groups[getConversationGroup(new Date(conversationGroupTs(c, childrenByParent, sort)))].push(c);
  });
  return { groups, childrenByParent, currentId };
}

function ConversationItem({ c, depth, currentId, childrenByParent }) {
  const when = formatDate(conversationWhenIso(c, historyStore.get().conversationSort));
  const meta = `${c.provider || "ollama"}/${c.model_id} · ${when}`;
  const kids = childrenByParent.get(c.id) || [];
  return (
    <>
      <div
        className={`conversation-item ${c.id === currentId ? "active" : ""} ${depth ? "conversation-item-fork" : ""}`}
        data-id={c.id}
        data-depth={depth}
        title={meta}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => openConversation(c.id)}
      >
        <div className="conv-row">
          <span className="conv-title">
            {c.kind === "prompt_generator" ? <span className="conv-kind-badge" title="Prompt generator">txt2img</span> : null}
            {c.kind === "prompt_generator" ? " " : null}
            {c.title}
          </span>
          <span className="conv-when">{when}</span>
          {c.id === currentId ? (
            <button
              type="button"
              className="conv-clear-btn"
              data-id={c.id}
              title="Limpiar historial de mensajes"
              aria-label="Limpiar historial"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearConversationHistory(c.id);
              }}
            >
              {clearHistoryIconSvg}
            </button>
          ) : null}
        </div>
      </div>
      {kids.map((ch) => (
        <ConversationItem key={ch.id} c={ch} depth={depth + 1} currentId={currentId} childrenByParent={childrenByParent} />
      ))}
    </>
  );
}

export function ConversationsList() {
  const conversations = useStore(historyStore, (s) => s.conversations);
  const deleted = useStore(historyStore, (s) => s.deletedConversations);
  const mode = useStore(historyStore, (s) => s.mode);
  const sort = useStore(historyStore, (s) => s.conversationSort);
  const currentId = useStore(sessionStore, (s) => s.conversationId);
  const msgItems = useStore(historyStore, (s) => s.messageHistoryItems);
  const msgTotal = useStore(historyStore, (s) => s.messageHistoryTotal);
  const msgQuery = useStore(historyStore, (s) => s.messageHistoryQuery);
  const searchIn = useStore(historyStore, (s) => s.messageHistorySearchIn);
  const consultaId = useStore(sessionStore, (s) => s.consultaAssistantId);
  const msgSort = useStore(historyStore, (s) => s.messageSort);

  if (mode === "messages") {
    const q = (msgQuery || "").trim();
    if (!msgItems.length) {
      return (
        <>
          <div className="conversations-list" id="conversations-list">
            <p className="conv-group-label">{q ? "Sin resultados." : "No hay respuestas todavía."}</p>
          </div>
          <MessagePager loaded={0} total={msgTotal} q={q} searchIn={searchIn} />
        </>
      );
    }
    const groups = { hoy: [], ayer: [], semana: [], anteriores: [] };
    msgItems.forEach((item) => {
      const iso = msgSort === "image" && item.latest_image_at ? item.latest_image_at : item.created_at;
      groups[getConversationGroup(iso)].push(item);
    });
    return (
      <>
        <div className="conversations-list" id="conversations-list">
          {["hoy", "ayer", "semana", "anteriores"].filter((k) => groups[k].length).map((key) => (
            <div key={key}>
              <div className="conv-group-label" aria-hidden="true">{CONV_GROUP_LABELS[key]}</div>
              {groups[key].map((item) => {
                const created = formatDateTime(item.created_at);
                const preview = item.content_preview || "(sin texto)";
                const convTitle = item.conversation_title || "Conversación";
                return (
                  <div
                    key={item.id}
                    className={`conversation-item message-history-item${item.id === consultaId ? " active" : ""}`}
                    data-id={item.id}
                    data-conversation-id={item.conversation_id}
                    title={`${convTitle} · ${created}`}
                    onClick={() => openConsultaTurn(item.conversation_id, item.id)}
                  >
                    <div className="conv-row">
                      <span className="conv-title">{preview}</span>
                    </div>
                    <time className="conv-meta message-history-created" dateTime={item.created_at || ""}>{created}</time>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <MessagePager loaded={msgItems.length} total={msgTotal} q={q} searchIn={searchIn} />
      </>
    );
  }

  const { groups, childrenByParent } = groupedConversations(conversations, sort, currentId);
  const order = ["hoy", "ayer", "semana", "anteriores"].filter((k) => groups[k].length);
  return (
    <>
      <div className="conversations-list" id="conversations-list">
        {order.map((key) => (
          <div key={key}>
            <div className="conv-group-label" aria-hidden="true">{CONV_GROUP_LABELS[key]}</div>
            {groups[key].map((c) => (
              <ConversationItem key={c.id} c={c} depth={0} currentId={currentId} childrenByParent={childrenByParent} />
            ))}
          </div>
        ))}
      </div>
      <div className="conversations-trash" id="conversations-trash" hidden={!deleted.length}>
        <div className="conv-group-label" id="conversations-trash-label">Papelera</div>
        <div className="conversations-trash-list" id="conversations-trash-list">
          {deleted.map((c) => (
            <div key={c.id} className="conversation-item" data-id={c.id}>
              <div className="conv-row">
                <span className="conv-title">{c.title}</span>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => restoreConversationFromTrash(c.id)}>Restaurar</button>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => deleteConversationFromHistory(c.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MessagePager({ loaded, total, q, searchIn }) {
  const hidden = !isMessagesHistoryMode();
  return (
    <div className="message-history-pager" id="message-history-pager" hidden={hidden || (!loaded && !q)}>
      {q && searchIn === "content" && loaded > 0 ? (
        <p className="message-history-search-hint">Sin coincidencias en el título; resultados en el texto.</p>
      ) : null}
      {loaded > 0 ? <span className="message-history-page-meta">{loaded} / {total}</span> : null}
      {loaded < total ? (
        <button type="button" className="btn btn-secondary btn-small message-history-load-more" id="message-history-load-more" onClick={() => loadMessageHistory({ append: true })}>
          Cargar más
        </button>
      ) : null}
    </div>
  );
}

export function HistorySortSelect() {
  const mode = useStore(historyStore, (s) => s.mode);
  const convSort = useStore(historyStore, (s) => s.conversationSort);
  const msgSort = useStore(historyStore, (s) => s.messageSort);
  const options = mode === "messages" ? MSG_SORT_OPTIONS : CONV_SORT_OPTIONS;
  const value = mode === "messages" ? msgSort : convSort;
  return (
    <select
      id="left-history-sort-select"
      className="param-control left-history-sort-select"
      aria-label="Ordenar historial"
      value={value}
      onChange={(e) => onLeftHistorySortChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export { setLeftHistoryMode, newConversation, newPromptGeneratorConversation, onMessageHistorySearchInput, setLeftCollapsed };
