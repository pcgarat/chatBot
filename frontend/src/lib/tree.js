import { messagesInWindow } from "./messageWindow.js";

export function mapApiMessage(m) {
  return {
    role: m.role,
    content: m.content,
    id: m.id || null,
    parent_id: m.parent_id || null,
    debug_request: m.debug_request || null,
    debug_response: m.debug_response || null,
    ephemeral_debug: !!m.ephemeral_debug,
  };
}

export function pathFromMessages(list, leafId) {
  if (!leafId) return [];
  const byId = new Map();
  list.forEach((m) => {
    if (m.id) byId.set(m.id, m);
  });
  const path = [];
  let current = byId.get(leafId);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    path.push(current);
    seen.add(current.id);
    current = current.parent_id ? byId.get(current.parent_id) : null;
  }
  path.reverse();
  return path;
}

export function effectiveLeafId(allMessages, activeLeafId) {
  if (activeLeafId && allMessages.some((m) => m.id === activeLeafId && !m.inherited)) {
    return activeLeafId;
  }
  for (let i = allMessages.length - 1; i >= 0; i--) {
    if (allMessages[i].id && !allMessages[i].ephemeral_debug && !allMessages[i].inherited) {
      return allMessages[i].id;
    }
  }
  return null;
}

export function visibleMessages(allMessages, activeLeafId, ephemerals = []) {
  const inherited = allMessages.filter((m) => m.inherited && !m.ephemeral_debug);
  const own = allMessages.filter((m) => !m.inherited && !m.ephemeral_debug);
  return inherited.concat(pathFromMessages(own, effectiveLeafId(allMessages, activeLeafId))).concat(ephemerals);
}

/** Hoja más reciente del subárbol que empieza en rootId (solo mensajes propios del path SQL). */
export function latestLeafInSubtree(messages, rootId) {
  if (!rootId) return null;
  const list = (messages || []).filter((m) => m && m.id && !m.ephemeral_debug);
  const byId = new Map(list.map((m) => [m.id, m]));
  const root = byId.get(rootId);
  if (!root) return null;
  const childrenByParent = new Map();
  list.forEach((m) => {
    const pid = m.parent_id || null;
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(m);
  });
  const order = new Map(list.map((m, i) => [m.id, i]));
  const stack = [root];
  const nodes = [];
  while (stack.length) {
    const node = stack.pop();
    nodes.push(node);
    const kids = childrenByParent.get(node.id) || [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  const leaves = nodes.filter((n) => !(childrenByParent.get(n.id) || []).length);
  if (!leaves.length) return root;
  leaves.sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
  return leaves[leaves.length - 1];
}

export function applyConversationTree(conv) {
  const inherited = (conv.inherited_messages || []).map((m) => ({
    ...mapApiMessage(m),
    inherited: true,
  }));
  const own = (conv.messages || []).map(mapApiMessage);
  const allMessages = inherited.concat(own);
  const ownWithId = own.filter((m) => m.id);
  const activeLeafId =
    conv.active_leaf_message_id || (ownWithId.length ? ownWithId[ownWithId.length - 1].id : null);
  const messages = visibleMessages(allMessages, activeLeafId);
  return { allMessages, activeLeafId, messages };
}

/** Vista del panel: desde viewStartIndex hasta el final del camino (incluye lo generado tras entrar). */
export function messagesForDisplay(messages, viewStartIndex) {
  return messagesInWindow(messages, viewStartIndex);
}
