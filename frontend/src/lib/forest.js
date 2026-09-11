export const CONV_GROUP_LABELS = { hoy: "Hoy", ayer: "Ayer", semana: "Semana", anteriores: "Antes" };

export function getConversationGroup(lastActivityAt) {
  const d = lastActivityAt ? new Date(lastActivityAt) : new Date(0);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekAgoStart = new Date(todayStart);
  weekAgoStart.setDate(weekAgoStart.getDate() - 7);
  if (d >= todayStart) return "hoy";
  if (d >= yesterdayStart) return "ayer";
  if (d >= weekAgoStart) return "semana";
  return "anteriores";
}

export function conversationActivityTs(c, childrenByParent) {
  let t = new Date(c.last_message_at || c.updated_at || 0).getTime();
  (childrenByParent.get(c.id) || []).forEach((ch) => {
    t = Math.max(t, conversationActivityTs(ch, childrenByParent));
  });
  return t;
}

export function conversationWhenIso(c, sort) {
  if (sort === "created_at") return c.created_at;
  return c.last_message_at || c.updated_at;
}

export function conversationGroupTs(c, childrenByParent, sort) {
  if (sort === "created_at") return new Date(c.created_at || 0).getTime();
  return conversationActivityTs(c, childrenByParent);
}

export function buildConversationForest(list, sort) {
  const byId = new Map(list.map((c) => [c.id, c]));
  const childrenByParent = new Map();
  list.forEach((c) => {
    const pid = c.forked_from_conversation_id;
    if (pid && byId.has(pid)) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid).push(c);
    }
  });
  childrenByParent.forEach((kids) => {
    kids.sort(
      (a, b) => conversationGroupTs(b, childrenByParent, sort) - conversationGroupTs(a, childrenByParent, sort)
    );
  });
  const roots = list.filter(
    (c) => !c.forked_from_conversation_id || !byId.has(c.forked_from_conversation_id)
  );
  return { roots, childrenByParent };
}
