import { render } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App.jsx";

vi.mock("./app/boot.js", () => ({
  bootApp: vi.fn(),
}));

describe("shell React", () => {
  it("pinta el árbol principal con los IDs del contrato de UI", () => {
    render(<App />);
    expect(document.getElementById("app")).toBeInTheDocument();
    expect(document.getElementById("column-left")).toBeInTheDocument();
    expect(document.getElementById("column-right")).toBeInTheDocument();
    expect(document.getElementById("messages-container")).toBeInTheDocument();
    expect(document.getElementById("image-gallery-panel")).toBeInTheDocument();
    expect(document.getElementById("image-queue-panel")).toBeInTheDocument();
    expect(document.getElementById("btn-new-chat")).toBeInTheDocument();
    expect(document.getElementById("btn-center-chat")).toBeInTheDocument();
    expect(document.getElementById("btn-image-gallery")).toBeInTheDocument();
    expect(document.getElementById("btn-image-queue")).toBeInTheDocument();
    expect(document.getElementById("app-status-bar")).toBeInTheDocument();
  });
});
