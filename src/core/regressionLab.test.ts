import { describe, expect, it } from "vitest";
import { compareSnapshots } from "./regressionLab";

describe("compareSnapshots", () => {
  it("returns an unchanged diff for identical snapshots", () => {
    const result = compareSnapshots("one\ntwo", "one\ntwo");
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.unchanged).toBe(2);
  });

  it("reports additions and removals with line numbers", () => {
    const result = compareSnapshots("alpha\nold\nomega", "alpha\nnew\nomega");
    expect(result.removed).toBe(1);
    expect(result.added).toBe(1);
    expect(result.lines.find((line) => line.kind === "removed")?.text).toBe("old");
    expect(result.lines.find((line) => line.kind === "added")?.newLine).toBe(2);
  });

  it("can ignore whitespace-only differences", () => {
    const result = compareSnapshots("  alpha   beta  ", "alpha beta", { ignoreWhitespace: true });
    expect(result.added + result.removed).toBe(0);
  });

  it("caps line comparisons and marks truncated snapshots", () => {
    const result = compareSnapshots("a\nb\nc", "a\nb\nc", { maxLines: 2 });
    expect(result.truncated).toBe(true);
    expect(result.unchanged).toBe(2);
  });
});
