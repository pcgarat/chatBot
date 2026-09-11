import { useSyncExternalStore } from "react";

/**
 * Suscripción a un store ligero. El selector debe devolver un valor estable
 * (primitivo o la misma referencia) o el componente re-renderiza en cada set.
 */
export function useStore(store, selector = (s) => s) {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get())
  );
}
