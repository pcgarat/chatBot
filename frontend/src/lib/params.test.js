import { describe, it, expect, beforeEach } from "vitest";
import { settingsStore } from "../store/settings.js";
import { sessionStore } from "../store/session.js";
import { buildModelParams, toggleParamExcluded } from "./params.js";

describe("buildModelParams", () => {
  beforeEach(() => {
    sessionStore.set({ conversationId: "c1" });
    settingsStore.set({
      paramsConfig: { provider: "ollama", params: { temperature: { default: 0.7 } } },
      paramsBaseline: { temperature: 0.7 },
      paramsValues: {},
      paramsSource: "default",
      paramsExcludedFromSendByConv: {},
    });
  });

  it("omite params iguales al baseline", () => {
    settingsStore.set({ paramsValues: { temperature: 0.7 } });
    expect(buildModelParams()).toEqual({});
  });

  it("incluye params distintos al baseline", () => {
    settingsStore.set({ paramsValues: { temperature: 0.2 }, paramsSource: "user" });
    expect(buildModelParams()).toEqual({ temperature: 0.2 });
  });

  it("exclude-from-send quita el param del payload", () => {
    settingsStore.set({ paramsValues: { temperature: 0.2 }, paramsSource: "user" });
    toggleParamExcluded("temperature", true);
    expect(buildModelParams()).toEqual({});
  });
});
