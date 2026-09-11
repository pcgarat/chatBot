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

export function messagesForDisplay(messages, consultaAssistantId) {
  if (!consultaAssistantId) return messages;
  const assistant = messages.find((m) => m.id === consultaAssistantId);
  if (!assistant) return messages;
  const parent = assistant.parent_id ? messages.find((m) => m.id === assistant.parent_id) : null;
  return parent ? [parent, assistant] : [assistant];
}
