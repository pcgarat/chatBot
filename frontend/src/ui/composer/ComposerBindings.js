import { sessionStore } from "../../store/session.js";
import { layoutStore } from "../../store/layout.js";
import { settingsStore } from "../../store/settings.js";
import { useStore } from "../../hooks/useStore.js";
import { onComposerPrimaryClick, sendPromptGeneratorTurn } from "../../app/sendMessage.js";
import { setComposerCollapsed } from "../layout/LayoutEffects.jsx";
import { applyModelRecipe } from "../../app/settingsActions.js";

export function ComposerBindings() {
  const draft = useStore(sessionStore, (s) => s.composerDraft);
  const instruction = useStore(sessionStore, (s) => s.instructionOverride);
  const kind = useStore(sessionStore, (s) => s.conversationKind);
  const abort = useStore(sessionStore, (s) => s.abortController);
  const collapsed = useStore(layoutStore, (s) => s.composerCollapsed);
  const contract = useStore(settingsStore, (s) => s.contract);
  const recipes = (contract && contract.recipes) || [];
  const isPg = kind === "prompt_generator";
  return {
    draft,
    instruction,
    kind,
    abort,
    collapsed,
    recipes,
    isPg,
    setDraft: (v) => sessionStore.set({ composerDraft: v }),
    setInstruction: (v) => sessionStore.set({ instructionOverride: v }),
    onSend: onComposerPrimaryClick,
    onGenerate: () => sendPromptGeneratorTurn({ force: true }),
    collapse: () => setComposerCollapsed(true),
    expand: () => setComposerCollapsed(false),
    applyRecipe: applyModelRecipe,
  };
}
