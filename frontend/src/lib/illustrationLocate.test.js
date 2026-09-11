import { describe, it, expect } from "vitest";
import {
  sceneIdFromFilename,
  illustrationNeedleInContent,
  contentHasExactFilename,
  findChatIllustration,
} from "./illustrationLocate.js";

describe("illustrationLocate", () => {
  it("saca el id de escena del filename de galería", () => {
    expect(sceneIdFromFilename("070ace44de6b45c5a7e78ca9e8454d11_s40.jpg")).toBe("s40");
    expect(sceneIdFromFilename("faro.png")).toBe("");
  });

  it("el HTML vivo marca la escena en alt, no en data-scene", () => {
    const html =
      '<img class="chat-illustration" data-filename="bbb_s40.jpg" alt="escena s40">';
    expect(illustrationNeedleInContent(html, "070ace_s40.jpg", "s40")).toBe(true);
    expect(illustrationNeedleInContent("sin foto", "070ace_s40.jpg", "s40")).toBe(false);
  });

  it("un filename _s40 no cuenta como la misma foto en otro relato", () => {
    const otherStory =
      '<img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40">';
    expect(contentHasExactFilename(otherStory, "070ace_s40.jpg")).toBe(false);
    expect(illustrationNeedleInContent(otherStory, "070ace_s40.jpg", "s40")).toBe(true);
  });

  it("encuentra la img por alt de escena si el filename de galería no coincide", () => {
    document.body.innerHTML = `
      <div id="root">
        <img class="chat-illustration" data-filename="aaa_s1.jpg" alt="escena s1" />
        <span class="chat-illustration-frame" id="target">
          <img class="chat-illustration" data-filename="bbb_s40.jpg" alt="escena s40" />
        </span>
      </div>
    `;
    const found = findChatIllustration(document.getElementById("root"), {
      filename: "070ace_s40.jpg",
      sceneId: "s40",
    });
    expect(found.frame.id).toBe("target");
  });

  it("si el scope es un mensaje, no toma el s40 de otro relato", () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="message-row" id="early">
          <span class="chat-illustration-frame" id="frame-early">
            <img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40" data-scene="s40" />
          </span>
        </div>
        <div class="message-row" id="target-row">
          <span class="chat-illustration-frame" id="frame-target">
            <img class="chat-illustration" data-filename="bbb_s40.jpg" alt="escena s40" data-scene="s40" />
          </span>
        </div>
      </div>
    `;
    const found = findChatIllustration(document.getElementById("root"), {
      filename: "070ace_s40.jpg",
      sceneId: "s40",
      scope: document.getElementById("target-row"),
    });
    expect(found.frame.id).toBe("frame-target");
  });

  it("con messageId de un mensaje que no está en el DOM no usa la escena de otro relato", () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="message-row" data-msg-id="m-early">
          <span class="chat-illustration-frame" id="frame-early">
            <img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40" data-scene="s40" />
          </span>
        </div>
      </div>
    `;
    const found = findChatIllustration(document.getElementById("root"), {
      filename: "070ace_s40.jpg",
      sceneId: "s40",
      messageId: "m-target",
    });
    expect(found).toBeNull();
  });
});
