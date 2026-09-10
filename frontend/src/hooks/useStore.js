import { useEffect, useRef, useState } from "react";

/**
 * Suscripción a un store ligero. El selector debe devolver un valor estable
 * (primitivo o la misma referencia) o el componente re-renderiza en cada set.
 */
export function useStore(store, selector = (s) => s) {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const [snapshot, setSnapshot] = useState(() => selector(store.get()));

  useEffect(() => {
    setSnapshot(selectorRef.current(store.get()));
    return store.subscribe((state) => {
      const next = selectorRef.current(state);
      setSnapshot((prev) => (Object.is(prev, next) ? prev : next));
    });
  }, [store]);

  return snapshot;
}
