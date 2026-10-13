import { describe, expect, it } from "vitest";
import { createDefaultState, exportWorkbenchState, loadWorkbenchState, parseWorkbenchImport, saveWorkbenchState, WORKBENCH_STORAGE_KEY } from "./workbench";

describe("workbench state", () => {
  it("creates a usable first project", () => {
    const state = createDefaultState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0]?.manifestSource).toContain("manifest_version");
    expect(state.selectedProjectId).toBe(state.projects[0]?.id);
  });

  it("round-trips an export without losing project data", () => {
    const state = createDefaultState();
    state.projects[0]!.name = "Fixture project";
    const imported = parseWorkbenchImport(exportWorkbenchState(state));
    expect(imported.projects[0]?.name).toBe("Fixture project");
    expect(imported.settings.reportHistoryLimit).toBe(25);
  });

  it("rejects unrelated JSON and malformed JSON with useful errors", () => {
    expect(() => parseWorkbenchImport("{bad")).toThrow("valid JSON");
    expect(() => parseWorkbenchImport(JSON.stringify({ hello: "world" }))).toThrow("not a DevForge");
  });

  it("survives unavailable or malformed storage", () => {
    expect(loadWorkbenchState({ getItem: () => "broken" }).projects).toHaveLength(1);
    const state = createDefaultState();
    const memory = new Map<string, string>();
    expect(saveWorkbenchState(state, { setItem: (key, value) => { memory.set(key, value); } })).toBe(true);
    expect(memory.has(WORKBENCH_STORAGE_KEY)).toBe(true);
  });
});
