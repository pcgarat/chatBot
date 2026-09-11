import * as rulesApi from "../api/rules.js";
import { sessionStore } from "../store/session.js";
import { settingsStore } from "../store/settings.js";
import { showError, showNotice } from "../store/ui.js";

let persistPlannerRulesFn = () => {};

export function registerPlannerRulesPersister(fn) {
  persistPlannerRulesFn = typeof fn === "function" ? fn : () => {};
}

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

function ruleRefId(rule) {
  return rule && (rule.rule_id || rule.id);
}

function libraryRulesForScope(scope) {
  const settings = settingsStore.get();
  return scope === "planner" ? settings.plannerLibraryRules || [] : settings.libraryRules || [];
}

export function resolveRuleContent(rule, scope = "chat") {
  const own = rule && rule.content ? String(rule.content).trim() : "";
  if (own) return own;
  const id = ruleRefId(rule);
  if (!id) return "";
  const lib = libraryRulesForScope(scope).find((r) => String(r.id) === String(id));
  return lib && lib.content ? String(lib.content).trim() : "";
}

export function concatRuleContents(rules, scope = "chat") {
  return (rules || [])
    .map((r) => resolveRuleContent(r, scope))
    .filter(Boolean)
    .join(" ");
}

export function getChatRulesTextForSystem() {
  return concatRuleContents(sessionStore.get().rules, "chat");
}

export function getPlannerRulesTextForSystem() {
  return concatRuleContents(sessionStore.get().plannerRules, "planner");
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

function hydrateRulesFromLibrary(scope) {
  const key = scope === "planner" ? "plannerRules" : "rules";
  const library = libraryRulesForScope(scope);
  if (!Array.isArray(library) || !library.length) return false;
  let changed = false;
  const next = (sessionStore.get()[key] || []).map(function (item) {
    const id = ruleRefId(item);
    if (!id) return item;
    const lib = library.find(function (r) {
      return String(r.id) === String(id);
    });
    if (!lib) return item;
    const title = lib.title || "";
    const content = lib.content || "";
    if ((item.title || "") === title && (item.content || "") === content) return item;
    changed = true;
    return Object.assign({}, item, { title: title, content: content });
  });
  if (changed) sessionStore.set({ [key]: next });
  return changed;
}

export function hydratePlannerRulesFromLibrary() {
  return hydrateRulesFromLibrary("planner");
}

export function hydrateChatRulesFromLibrary() {
  return hydrateRulesFromLibrary("chat");
}

export async function persistSessionRules() {
  const { conversationId, rules } = sessionStore.get();
  if (!conversationId) return;
  const { patchConversation } = await import("../api/conversations.js");
  patchConversation(conversationId, { system_instructions: serializeRules(rules) }).catch(() => {});
}

function persistActiveRules(scope) {
  if (scope === "planner") {
    persistPlannerRulesFn();
    return;
  }
  persistSessionRules();
}

export function moveRuleItem(list, from, to) {
  const fromIdx = Number(from);
  const toIdx = Number(to);
  if (
    !Array.isArray(list) ||
    !Number.isInteger(fromIdx) ||
    !Number.isInteger(toIdx) ||
    fromIdx === toIdx ||
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= list.length ||
    toIdx >= list.length
  ) {
    return list;
  }
  const next = list.slice();
  const [item] = next.splice(fromIdx, 1);
  next.splice(Math.min(toIdx, next.length), 0, item);
  return next;
}

export function reorderActiveRules(from, to, scope = "chat") {
  const key = scope === "planner" ? "plannerRules" : "rules";
  const current = sessionStore.get()[key];
  const next = moveRuleItem(current, from, to);
  if (next === current) return;
  sessionStore.set({ [key]: next });
  persistActiveRules(scope);
}

export async function addLibraryRule(ruleId, scope = "chat") {
  const list = scope === "planner" ? settingsStore.get().plannerLibraryRules : settingsStore.get().libraryRules;
  const rule = list.find((r) => String(r.id) === String(ruleId));
  if (!rule) return;
  if (scope === "planner") {
    sessionStore.set((s) => ({ ...s, plannerRules: s.plannerRules.concat([rule]) }));
  } else {
    sessionStore.set((s) => ({ ...s, rules: s.rules.concat([rule]) }));
  }
  persistActiveRules(scope);
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
    }
    persistActiveRules(scope);
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
      persistActiveRules(rule.scope || "chat");
      showNotice("Nueva regla guardada.");
      return created;
    }
    const id = rule.rule_id || rule.id;
    const updated = await rulesApi.updateRule(id, { title: rule.title, content: rule.content });
    replaceRuleInSession(id, updated || { ...rule, id }, rule.scope);
    persistActiveRules(rule.scope || "chat");
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
  persistActiveRules(scope);
  showNotice("Regla eliminada.");
}

export function removeActiveRule(id, scope = "chat") {
  const key = scope === "planner" ? "plannerRules" : "rules";
  sessionStore.set((s) => ({
    ...s,
    [key]: s[key].filter((r) => String(r.id || r.rule_id) !== String(id)),
  }));
  persistActiveRules(scope);
}
