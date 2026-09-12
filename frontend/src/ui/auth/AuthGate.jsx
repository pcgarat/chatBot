import { useEffect, useState } from "react";
import { authStore, fetchMe, login, register } from "../../store/auth.js";

export function AuthGate({ children }) {
  const [auth, setAuth] = useState(authStore.get());
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const unsub = authStore.subscribe(() => setAuth(authStore.get()));
    fetchMe();
    return unsub;
  }, []);

  if (!auth.ready) {
    return (
      <div className="auth-gate" role="status">
        <p className="auth-gate-loading">Cargando sesión…</p>
      </div>
    );
  }

  if (auth.user) {
    return children;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, email.trim() || undefined);
      }
    } catch (err) {
      setFormError(err.message || "Error de autenticación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-gate">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1 className="auth-title">ChatBot</h1>
        <p className="auth-subtitle">
          {mode === "login" ? "Inicia sesión para ver tu historial y preferencias." : "Crea una cuenta. El registro está abierto."}
        </p>
        <label className="auth-field">
          <span>Usuario</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={64}
          />
        </label>
        {mode === "register" ? (
          <label className="auth-field">
            <span>Email (opcional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
        ) : null}
        <label className="auth-field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
          />
        </label>
        {formError ? <p className="auth-error" role="alert">{formError}</p> : null}
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? "Espera…" : mode === "login" ? "Entrar" : "Registrarme"}
        </button>
        <button
          type="button"
          className="btn btn-secondary auth-switch"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setFormError("");
          }}
        >
          {mode === "login" ? "Crear cuenta" : "Ya tengo cuenta"}
        </button>
      </form>
    </div>
  );
}
