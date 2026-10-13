export type DiffLineKind = "same" | "added" | "removed";
export interface DiffLine { kind: DiffLineKind; text: string; oldLine: number | null; newLine: number | null; }
export interface DiffResult { lines: DiffLine[]; added: number; removed: number; unchanged: number; truncated: boolean; }

export function compareSnapshots(beforeText: string, afterText: string, options: { ignoreWhitespace?: boolean; maxLines?: number } = {}): DiffResult {
  const maxLines = Math.max(1, Math.min(1200, Math.floor(options.maxLines ?? 800)));
  const normalize = (line: string) => options.ignoreWhitespace ? line.replace(/\s+/g, " ").trim() : line;
  const allBefore = beforeText.replace(/\r\n?/g, "\n").split("\n");
  const allAfter = afterText.replace(/\r\n?/g, "\n").split("\n");
  const truncated = allBefore.length > maxLines || allAfter.length > maxLines;
  const before = allBefore.slice(0, maxLines);
  const after = allAfter.slice(0, maxLines);
  const a = before.map(normalize);
  const b = after.map(normalize);

  // Bound work: (maxLines + 1)^2 cells at most. No input code is ever executed.
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Uint16Array(cols));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? (dp[i + 1]![j + 1] ?? 0) + 1 : Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (a[i] === b[j]) {
      lines.push({ kind: "same", text: after[j]!, oldLine: i + 1, newLine: j + 1 });
      i++; j++;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      lines.push({ kind: "removed", text: before[i]!, oldLine: i + 1, newLine: null });
      i++;
    } else {
      lines.push({ kind: "added", text: after[j]!, oldLine: null, newLine: j + 1 });
      j++;
    }
  }
  while (i < before.length) { lines.push({ kind: "removed", text: before[i]!, oldLine: i + 1, newLine: null }); i++; }
  while (j < after.length) { lines.push({ kind: "added", text: after[j]!, oldLine: null, newLine: j + 1 }); j++; }
  return {
    lines,
    added: lines.filter((line) => line.kind === "added").length,
    removed: lines.filter((line) => line.kind === "removed").length,
    unchanged: lines.filter((line) => line.kind === "same").length,
    truncated
  };
}

export function exportSnapshotReport(input: { projectName: string; baselineLabel: string; currentLabel: string; beforeText: string; afterText: string; result: DiffResult; mode: string }): string {
  return JSON.stringify({ tool: "DevForge RegressionLab", createdAt: new Date().toISOString(), ...input }, null, 2);
}
