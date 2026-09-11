import { createStore } from "./createStore.js";

export const settingsStore = createStore({
  providers: [],
  models: [],
  currentProvider: "ollama",
  currentModel: "",
  paramsConfig: { provider: "", params: {} },
  paramsSource: "default",
  paramsBaseline: {},
  paramsValues: {},
  paramsExcludedFromSendByConv: {},
  contract: null,
  libraryRules: [],
  plannerLibraryRules: [],
  plannerRulePresets: [],
  modelSelectQuery: "",
  modelSelectOpen: false,
  saveToChromadb: "user",
  historyTurns: 20,
});
