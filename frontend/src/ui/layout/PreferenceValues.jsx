import { useStore } from "../../hooks/useStore.js";
import { layoutStore, formatFontSizeLabel } from "../../store/layout.js";
import { debugStore } from "../../store/debug.js";

export function PrefPercentValue({ id, field }) {
  const value = useStore(layoutStore, (s) => s[field]);
  return (
    <span id={id} className="pref-font-value" aria-live="polite">
      {formatFontSizeLabel(value)}
    </span>
  );
}

export function PrefDebugLogValue({ id = "pref-debug-log-value" }) {
  const size = useStore(debugStore, (s) => s.logSize);
  return (
    <span id={id} className="pref-font-value" aria-live="polite">
      {String(size)}
    </span>
  );
}
