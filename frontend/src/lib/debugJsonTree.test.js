import { describe, expect, it } from "vitest";
import {
  parseDebugJson,
  jsonSectionHtml,
  encodeJsonPath,
  decodeJsonPath,
} from "./debugJsonTree.js";

describe("parseDebugJson", () => {
  it("deja pasar objetos y arrays", () => {
    const obj = { a: 1 };
    expect(parseDebugJson(obj)).toBe(obj);
    expect(parseDebugJson([1, 2])).toEqual([1, 2]);
  });

  it("parsea un string JSON (también pretty-printed)", () => {
    expect(parseDebugJson('{"model":"planner"}')).toEqual({ model: "planner" });
    expect(parseDebugJson('{\n  "stream": false\n}')).toEqual({ stream: false });
  });

  it("parsea NDJSON como array de objetos", () => {
    const raw = '{"debug_request":true}\n{"done":true}';
    expect(parseDebugJson(raw)).toEqual([{ debug_request: true }, { done: true }]);
  });

  it("deja el texto plano como string", () => {
    expect(parseDebugJson("hola mundo")).toBe("hola mundo");
    expect(parseDebugJson("")).toBe("");
    expect(parseDebugJson(null)).toBe(null);
  });
});

describe("jsonSectionHtml un nivel por expansión", () => {
  const request = {
    model: "planner",
    stream: false,
    messages: [
      { role: "system", content: "sé breve" },
      { role: "user", content: "ilustra" },
    ],
    options: { temperature: 0.2, num_ctx: 8192 },
  };

  it("muestra el primer nivel y no vuelca propiedades anidadas", () => {
    const html = jsonSectionHtml({
      label: "Request",
      value: JSON.stringify(request, null, 2),
      path: ["request"],
      isExpanded: (parts) => parts.length === 1,
    });
    expect(html).toContain("json-tree");
    expect(html).toContain("Request");
    expect(html).toContain(">model<");
    expect(html).toContain("planner");
    expect(html).toContain(">messages<");
    expect(html).toContain("Array(2)");
    expect(html).toContain(">options<");
    expect(html).not.toContain(">role<");
    expect(html).not.toContain(">temperature<");
    expect(html).not.toContain("num_ctx");
  });

  it("al expandir messages solo aparece el siguiente nivel (índices), no el contenido", () => {
    const html = jsonSectionHtml({
      label: "Request",
      value: request,
      path: ["request"],
      isExpanded: (parts) =>
        parts.length === 1 || (parts[0] === "request" && parts[1] === "messages" && parts.length === 2),
    });
    expect(html).toContain(">0<");
    expect(html).toContain(">1<");
    expect(html).toContain("{2}");
    expect(html).not.toContain(">role<");
    expect(html).not.toContain("sé breve");
  });

  it("al expandir messages.0 aparecen role y content, no más", () => {
    const html = jsonSectionHtml({
      label: "Request",
      value: request,
      path: ["request"],
      isExpanded: (parts) =>
        JSON.stringify(parts) === JSON.stringify(["request"]) ||
        JSON.stringify(parts) === JSON.stringify(["request", "messages"]) ||
        JSON.stringify(parts) === JSON.stringify(["request", "messages", 0]),
    });
    expect(html).toContain(">role<");
    expect(html).toContain("system");
    expect(html).toContain(">content<");
    expect(html).not.toContain("ilustra");
  });

  it("escapa HTML en claves y valores", () => {
    const html = jsonSectionHtml({
      label: "Request",
      value: { "<script>": "<img>" },
      path: ["request"],
      isExpanded: (parts) => parts.length === 1,
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img&gt;");
  });

  it("trunca strings largas hasta que se expanden", () => {
    const long = "x".repeat(200);
    const collapsed = jsonSectionHtml({
      label: "Response",
      value: { content: long },
      path: ["response"],
      isExpanded: (parts) => parts.length === 1,
    });
    expect(collapsed).toContain("…");
    expect(collapsed).not.toContain(long);

    const expanded = jsonSectionHtml({
      label: "Response",
      value: { content: long },
      path: ["response"],
      isExpanded: (parts) =>
        parts.length === 1 || JSON.stringify(parts) === JSON.stringify(["response", "content"]),
    });
    expect(expanded).toContain(long);
  });
});

describe("json path encoding", () => {
  it("roundtrip con claves que contienen puntos", () => {
    const parts = ["request", "foo.bar", 0];
    expect(decodeJsonPath(encodeJsonPath(parts))).toEqual(parts);
  });
});
