import { useStore } from "../../hooks/useStore.js";
import { ruleEditStore } from "./ruleEditStore.js";
import { saveEditedRule, deleteRuleFromSession } from "../../app/rulesActions.js";

export function RuleEditModal() {
  const rule = useStore(ruleEditStore, (s) => s.rule);
  if (!rule) {
    return (
      <div id="rule-edit-modal" className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rule-edit-modal-title" hidden>
        <div className="modal-content rule-edit-modal-content" />
      </div>
    );
  }
  return (
    <div id="rule-edit-modal" className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rule-edit-modal-title">
      <div className="modal-content rule-edit-modal-content">
        <h2 id="rule-edit-modal-title" className="modal-title">Editar regla</h2>
        <div className="rule-edit-form">
          <label className="rule-edit-label" htmlFor="rule-edit-title">Título</label>
          <input type="text" id="rule-edit-title" className="rule-edit-input" placeholder="Título" value={rule.title || ""} onChange={(e) => ruleEditStore.set({ rule: { ...rule, title: e.target.value } })} />
          <label className="rule-edit-label" htmlFor="rule-edit-content">Contenido</label>
          <textarea id="rule-edit-content" className="rule-edit-textarea" rows="4" placeholder="Contenido de la regla" value={rule.content || ""} onChange={(e) => ruleEditStore.set({ rule: { ...rule, content: e.target.value } })} />
        </div>
        <div className="rule-edit-actions">
          <button type="button" id="rule-edit-btn-delete" className="btn rule-edit-btn-delete" onClick={() => { deleteRuleFromSession(rule, rule.scope); ruleEditStore.close(); }}>Eliminar regla</button>
          <button type="button" id="rule-edit-btn-save" className="btn btn-primary" onClick={() => { saveEditedRule(rule); ruleEditStore.close(); }}>Guardar</button>
          <button type="button" id="rule-edit-btn-save-new" className="btn btn-secondary" onClick={() => { saveEditedRule(rule, { asNew: true }); ruleEditStore.close(); }}>Guardar nuevo</button>
        </div>
      </div>
    </div>
  );
}
