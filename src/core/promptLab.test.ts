import { describe, expect, it } from "vitest";
import { createPromptLabState, evaluatePromptOutput, normalizePromptLabState } from "./promptLab";

describe("PromptLab evaluation", () => {
  it("passes output matching every rule", () => {
    expect(evaluatePromptOutput("Hello there, welcome!", { required: ["hello"], forbidden: ["guaranteed"], minWords: 2, maxWords: 8 }).passed).toBe(true);
  });

  it("reports missing, forbidden, and word-count failures", () => {
    const result = evaluatePromptOutput("Guaranteed.", { required: ["hello"], forbidden: ["guaranteed"], minWords: 2, maxWords: 3 });
    expect(result.passed).toBe(false);
    expect(result.findings).toHaveLength(3);
  });

  it("counts words without treating whitespace-only output as a word", () => {
    expect(evaluatePromptOutput(" \n ", { required: [], forbidden: [], minWords: null, maxWords: null }).wordCount).toBe(0);
  });

  it("creates an initial usable prompt, case, and version", () => {
    const state = createPromptLabState();
    expect(state.versions[0]?.prompt).toBe(state.draft);
    expect(state.cases).toHaveLength(1);
    expect(state.runs).toHaveLength(0);
  });

  it("rejects malformed imports and oversized collections", () => {
    expect(() => normalizePromptLabState(null)).toThrow("object");
    const state = createPromptLabState();
    expect(() => normalizePromptLabState({ ...state, runs: Array.from({ length: 501 }, (_, i) => ({ id: String(i) })) })).toThrow("limits");
  });
});
