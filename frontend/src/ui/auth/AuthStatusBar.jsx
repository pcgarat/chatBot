import { useEffect, useRef, useState } from "react";
import { authStore, changePassword, logout } from "../../store/auth.js";

export function AuthStatusBar() {
  const [user, setUser] = useState(authStore.get().user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");
  const rootRef = useRef(null);

  useEffect(() => authStore.subscribe(() => setUser(authStore.get().user)), []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!user) return null;

  function openPasswordModal() {
    setMenuOpen(false);
    setPwdOpen(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFormError("");
    setFormOk("");
  }

  function closePasswordModal() {
    if (busy) return;
    setPwdOpen(false);
    setFormError("");
    setFormOk("");
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setFormError("");
    setFormOk("");
    if (newPassword.length < 6) {
      setFormError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("La confirmación no coincide");
      return;
    }
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setFormOk("Contraseña actualizada");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setPwdOpen(false);
        setFormOk("");
      }, 900);
    } catch (err) {
      setFormError(err.message || "No se pudo cambiar la contraseña");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="status-bar-auth" ref={rootRef}>
        <button
          type="button"
          className="status-bar-user-btn"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="user-account-menu"
          onClick={() => setMenuOpen((o) => !o)}
          title={user.username}
        >
          <span className="status-bar-auth-name">{user.username}</span>
          <span className="status-bar-user-caret" aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div
            id="user-account-menu"
            className="user-account-menu"
            role="menu"
            aria-label="Cuenta de usuario"
          >
            <div className="user-account-menu-header" role="presentation">
              {user.username}
              {user.is_admin ? <span className="user-account-badge">admin</span> : null}
            </div>
            <button
              type="button"
              className="user-account-menu-item"
              role="menuitem"
              onClick={openPasswordModal}
            >
              Cambiar contraseña
            </button>
            <button
              type="button"
              className="user-account-menu-item user-account-menu-item--danger"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
            >
              Cerrar sesión
            </button>
          </div>
        ) : null}
      </div>

      {pwdOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePasswordModal();
          }}
        >
          <form
            className="modal-content auth-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-password-title"
            onSubmit={onChangePassword}
          >
            <h2 id="auth-password-title" className="modal-title">
              Cambiar contraseña
            </h2>
            <label className="auth-field">
              <span>Contraseña actual</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
                autoFocus
              />
            </label>
            <label className="auth-field">
              <span>Nueva contraseña</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </label>
            <label className="auth-field">
              <span>Confirmar nueva contraseña</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </label>
            {formError ? (
              <p className="auth-error" role="alert">
                {formError}
              </p>
            ) : null}
            {formOk ? (
              <p className="auth-success" role="status">
                {formOk}
              </p>
            ) : null}
            <div className="auth-password-actions">
              <button type="button" className="btn btn-secondary" onClick={closePasswordModal} disabled={busy}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
