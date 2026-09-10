import * as rulesApi from "../api/rules.js";
import { sessionStore } from "../store/session.js";
import { settingsStore } from "../store/settings.js";
import { showError, showNotice } from "../store/ui.js";

export async function loadLibraryRules() {
  try {
    const list = await rulesApi.listRules("chat");
    settingsStore.set({ libraryRules: Array.isArray(list) ? list : [] });
  } catch (_) {
    settingsStore.set({ libraryRules: [] });
  }
}

export async function loadPlannerLibraryRules() {
  try {
    const list = await rulesApi.listRules("planner");
    settingsStore.set({ plannerLibraryRules: Array.isArray(list) ? list : [] });
  } catch (_) {
    settingsStore.set({ plannerLibraryRules: [] });
  }
}

function serializeRules(rules) {
  return (rules || []).map((r) => ({
    rule_id: r.rule_id || r.id,
    title: r.title,
    content: r.content,
  }));
}

export function serializeRuleItems(rules) {
  return serializeRules(rules);
}

export function concatRuleContents(rules) {
  return (rules || [])
    .map((r) => (r && r.content ? String(r.content).trim() : ""))
    .filter(Boolean)
    .join(" ");
}

export function getPlannerRulesTextForSystem() {
  return concatRuleContents(sessionStore.get().plannerRules);
}

export function normalizePlannerRulesFromPrefs(value) {
  if (Array.isArray(value)) {
    return value.map((r) =>
      typeof r === "string" ? { id: "snap", title: "Planner", content: r } : r
    );
  }
  if (typeof value === "string" && value.trim()) {
    return [{ id: "snap", title: "Planner", content: value }];
  }
  return [];
}

export function hydratePlannerRulesFromLibrary() {
  const plannerLibraryRules = settingsStore.get().plannerLibraryRules || [];
  if (!Array.isArray(plannerLibraryRules) || !plannerLibraryRules.length) return false;
  let changed = false;
  const plannerRules = (sessionStore.get().plannerRules || []).map(function (item) {
    if (!item || !item.rule_id) return item;
    const lib = plannerLibraryRules.find(function (r) {
      return r.id === item.rule_id;
    });
    if (!lib) return item;
    const title = lib.title || "";
    const content = lib.content || "";
    if ((item.title || "") === title && (item.content || "") === content) return item;
    changed = true;
    return Object.assign({}, item, { title: title, content: content });
  });
  if (changed) sessionStore.set({ plannerRules });
  return changed;
}

export async function persistSessionRules() {
  const { conversationId, rules } = sessionStore.get();
  if (!conversationId) return;
  const { patchConversation } = await import("../api/conversations.js");
  patchConversation(conversationId, { rules: serializeRules(rules) }).catch(() => {});
}

export async function addLibraryRule(ruleId, scope = "chat") {
  const list = scope === "planner" ? settingsStore.get().plannerLibraryRules : settingsStore.get().libraryRules;
  const rule = list.find((r) => String(r.id) === String(ruleId));
  if (!rule) return;
  if (scope === "planner") {
    sessionStore.set((s) => ({ ...s, plannerRules: s.plannerRules.concat([rule]) }));
  } else {
    sessionStore.set((s) => ({ ...s, rules: s.rules.concat([rule]) }));
    persistSessionRules();
  }
}

export async function createAndAddRule({ title, content, scope = "chat" }) {
  try {
    const newRule = await rulesApi.createRule({ title, content, scope });
    if (scope === "planner") {
      sessionStore.set((s) => ({ ...s, plannerRules: s.plannerRules.concat([newRule]) }));
      await loadPlannerLibraryRules();
    } else {
      sessionStore.set((s) => ({ ...s, rules: s.rules.concat([newRule]) }));
      await loadLibraryRules();
      persistSessionRules();
    }
    showNotice("Regla creada.");
    return newRule;
  } catch (e) {
    showError("Error al crear regla: " + e.message);
    return null;
  }
}

export async function saveEditedRule(rule, { asNew = false } = {}) {
  try {
    if (asNew) {
      const created = await rulesApi.createRule({
        title: rule.title,
        content: rule.content,
        scope: rule.scope || "chat",
      });
      replaceRuleInSession(rule.id || rule.rule_id, created, rule.scope);
      showNotice("Nueva regla guardada.");
      return created;
    }
    const id = rule.rule_id || rule.id;
    const updated = await rulesApi.updateRule(id, { title: rule.title, content: rule.content });
    replaceRuleInSession(id, updated || { ...rule, id }, rule.scope);
    persistSessionRules();
    showNotice("Regla guardada.");
    return updated;
  } catch (e) {
    showError("Error al guardar regla: " + e.message);
    return null;
  }
}

function replaceRuleInSession(id, next, scope) {
  const key = scope === "planner" ? "plannerRules" : "rules";
  sessionStore.set((s) => ({
    ...s,
    [key]: s[key].map((r) => (String(r.id || r.rule_id) === String(id) ? { ...r, ...next } : r)),
  }));
}

export async function deleteRuleFromSession(rule, scope = "chat") {
  const id = rule.rule_id || rule.id;
  try {
    if (id && !String(id).startsWith("tmp-")) await rulesApi.deleteRule(id);
  } catch (_) {}
  const key = scope === "planner" ? "plannerRules" : "rules";
  sessionStore.set((s) => ({
    ...s,
    [key]: s[key].filter((r) => String(r.id || r.rule_id) !== String(id)),
  }));
  if (scope !== "planner") persistSessionRules();
  showNotice("Regla eliminada.");
}

export function removeActiveRule(id, scope = "chat") {
  const key = scope === "planner" ? "plannerRules" : "rules";
  sessionStore.set((s) => ({
    ...s,
    [key]: s[key].filter((r) => String(r.id || r.rule_id) !== String(id)),
  }));
  if (scope !== "planner") persistSessionRules();
}
