import { describe, it, expect } from "vitest";
import { renderConversationsList, renderMessageHistoryList } from "./render.js";

describe("historial izquierdo", () => {
  it("lista vacía no pinta items", () => {
    expect(renderConversationsList([], null, "activity")).toBe("");
  });

  it("pinta bosque con fork", () => {
    const now = new Date().toISOString();
    const parent = { id: "p", title: "Padre", created_at: now, last_message_at: now, model_id: "m" };
    const child = {
      id: "c",
      title: "Hija",
      created_at: now,
      last_message_at: now,
      model_id: "m",
      forked_from_conversation_id: "p",
    };
    const html = renderConversationsList([parent, child], "p", "activity");
    expect(html).toContain("Padre");
    expect(html).toContain("Hija");
    expect(html).toContain("conversation-item-fork");
    expect(html).not.toContain("conv-meta");
    expect(html).not.toContain("conv-icon");
    expect(html).toContain("conv-when");
  });

  it("modo mensajes pinta fecha bajo el título", () => {
    const html = renderMessageHistoryList(
      [{ id: "a", conversation_id: "c", content_preview: "hola", created_at: new Date().toISOString() }],
      "a",
      "message"
    );
    expect(html).toContain("message-history-item");
    expect(html).toContain("message-history-created");
    expect(html).toContain("<time");
    expect(html).not.toContain("conv-when");
  });
});
