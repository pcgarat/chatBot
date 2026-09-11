import { useRef } from "react";
import { sessionStore } from "../../store/session.js";
import { useStore } from "../../hooks/useStore.js";
import { removeActiveRule, reorderActiveRules } from "../../app/rulesActions.js";
import { ruleEditStore } from "./ruleEditStore.js";

function ruleKey(rule) {
  return rule.id || rule.rule_id;
}

function clearDragOver(listEl) {
  listEl?.querySelectorAll(".rule-tag-drag-over").forEach((n) => n.classList.remove("rule-tag-drag-over"));
}

export function RulesList({ scope = "chat" }) {
  const rules = useStore(sessionStore, (s) => (scope === "planner" ? s.plannerRules : s.rules));
  const dragFromRef = useRef(-1);

  function onDragStart(e, index) {
    const handle = e.target.closest(".rule-tag-drag");
    if (!handle) return;
    const tag = handle.closest(".rule-tag");
    if (!tag) return;
    dragFromRef.current = index;
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    if (typeof e.dataTransfer.setDragImage === "function") {
      e.dataTransfer.setDragImage(tag, 0, 0);
    }
    tag.classList.add("rule-tag-dragging");
  }

  function onDragEnd(e) {
    dragFromRef.current = -1;
    e.currentTarget.closest(".rule-tag")?.classList.remove("rule-tag-dragging");
    clearDragOver(e.currentTarget.closest(".rules-list"));
  }

  function onDragOver(e) {
    const tag = e.target.closest(".rule-tag");
    if (!tag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    clearDragOver(e.currentTarget);
    tag.classList.add("rule-tag-drag-over");
  }

  function onDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) clearDragOver(e.currentTarget);
  }

  function onDrop(e) {
    const tag = e.target.closest(".rule-tag");
    if (!tag) return;
    e.preventDefault();
    tag.classList.remove("rule-tag-drag-over");
    const from =
      dragFromRef.current >= 0 ? dragFromRef.current : parseInt(e.dataTransfer.getData("text/plain"), 10);
    const to = parseInt(tag.getAttribute("data-rule-index"), 10);
    dragFromRef.current = -1;
    reorderActiveRules(from, to, scope);
  }

  return (
    <div
      className="rules-list"
      role="list"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {rules.map((r, index) => (
        <div key={`${ruleKey(r)}-${index}`} className="rule-tag" role="listitem" data-rule-index={index}>
          <span
            className="rule-tag-drag"
            draggable="true"
            role="button"
            title="Arrastrar para reordenar"
            aria-label="Arrastrar para reordenar"
            data-rule-index={index}
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnd={onDragEnd}
          />
          <button type="button" className="rule-tag-label" onClick={() => ruleEditStore.open({ ...r, scope })}>
            {r.title || "Regla"}
          </button>
          <button
            type="button"
            className="rule-tag-remove"
            aria-label="Quitar"
            onClick={() => removeActiveRule(ruleKey(r), scope)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function openRuleEditModal(rule) {
  ruleEditStore.open(rule);
}

export function renderRules() {}
