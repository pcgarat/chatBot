import { createStore } from "../../store/createStore.js";

export const ruleEditStore = createStore({ rule: null });

ruleEditStore.open = function open(rule) {
  ruleEditStore.set({ rule });
};

ruleEditStore.close = function close() {
  ruleEditStore.set({ rule: null });
};
