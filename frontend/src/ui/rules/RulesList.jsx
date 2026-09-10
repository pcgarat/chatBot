import { sessionStore } from "../../store/session.js";
import { useStore } from "../../hooks/useStore.js";
import { removeActiveRule } from "../../app/rulesActions.js";
import { ruleEditStore } from "./ruleEditStore.js";

export function RulesList({ scope = "chat" }) {
  const rules = useStore(sessionStore, (s) => (scope === "planner" ? s.plannerRules : s.rules));
  return (
    <div className="rules-list" role="list">
      {rules.map((r) => (
        <div key={r.id || r.rule_id} className="rule-tag" role="listitem">
          <button type="button" className="rule-tag-title" onClick={() => ruleEditStore.open({ ...r, scope })}>
            {r.title || "Regla"}
          </button>
          <button type="button" className="rule-tag-remove" aria-label="Quitar" onClick={() => removeActiveRule(r.id || r.rule_id, scope)}>×</button>
        </div>
      ))}
    </div>
  );
}

export function openRuleEditModal(rule) {
  ruleEditStore.open(rule);
}

export function renderRules() {}
