import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthStatusBar } from "./AuthStatusBar.jsx";
import { authStore } from "../../store/auth.js";

vi.mock("../../store/auth.js", async () => {
  const { createStore } = await import("../../store/createStore.js");
  const authStore = createStore({
    ready: true,
    user: { id: "u1", username: "tester", is_admin: false },
    error: null,
  });
  return {
    authStore,
    logout: vi.fn(),
    changePassword: vi.fn(async () => {}),
  };
});

import { changePassword, logout } from "../../store/auth.js";

describe("AuthStatusBar menú de usuario", () => {
  beforeEach(() => {
    authStore.set({
      ready: true,
      user: { id: "u1", username: "tester", is_admin: false },
      error: null,
    });
    logout.mockClear();
    changePassword.mockClear();
  });

  it("abre el menú y permite cerrar sesión", () => {
    render(<AuthStatusBar />);
    fireEvent.click(screen.getByRole("button", { name: /tester/i }));
    expect(screen.getByRole("menu", { name: /cuenta de usuario/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /cerrar sesión/i }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("cambia la contraseña desde el modal", async () => {
    render(<AuthStatusBar />);
    fireEvent.click(screen.getByRole("button", { name: /tester/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /cambiar contraseña/i }));

    fireEvent.change(screen.getByLabelText(/contraseña actual/i), {
      target: { value: "antigua1" },
    });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), {
      target: { value: "nueva123" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contraseña/i), {
      target: { value: "nueva123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith("antigua1", "nueva123");
    });
  });

  it("muestra error si la confirmación no coincide", async () => {
    render(<AuthStatusBar />);
    fireEvent.click(screen.getByRole("button", { name: /tester/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /cambiar contraseña/i }));

    fireEvent.change(screen.getByLabelText(/contraseña actual/i), {
      target: { value: "antigua1" },
    });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), {
      target: { value: "nueva123" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contraseña/i), {
      target: { value: "otra" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/confirmación no coincide/i);
    expect(changePassword).not.toHaveBeenCalled();
  });
});
