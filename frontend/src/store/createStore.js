/**
 * Observable mínimo por agregado. Sin Context en #root: cada isla se suscribe
 * con selector. set() acepta parche plano o función (prev => next).
 */
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  function get() {
    return state;
  }

  function set(patch) {
    const next = typeof patch === "function" ? patch(state) : { ...state, ...patch };
    if (next === state) return state;
    state = next;
    listeners.forEach((fn) => fn(state));
    return state;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { get, set, subscribe };
}
