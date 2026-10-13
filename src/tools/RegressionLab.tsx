import { useEffect, useState } from "react";
import { ArrowDownToLine, GitCompare, Save, Trash2, Upload } from "lucide-react";
import { compareSnapshots, type DiffResult } from "../core/regressionLab";

type Props = { projectId: string; projectName: string; onReport: (summary: string, payload: unknown) => void };
type Snapshot = { id: string; name: string; mode: string; text: string; createdAt: string };
const keyFor = (projectId: string) => `devforge.regressionlab.v1.${projectId}`;
const newId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
function loadSnapshots(projectId: string): Snapshot[] {
  try {
    const raw = localStorage.getItem(keyFor(projectId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is Snapshot => !!item && typeof item.id === "string" && typeof item.name === "string" && typeof item.mode === "string" && typeof item.text === "string" && typeof item.createdAt === "string").slice(0, 40) : [];
  } catch { return []; }
}

export default function RegressionLab({ projectId, projectName, onReport }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => loadSnapshots(projectId));
  const [mode, setMode] = useState("Text / output");
  const [baselineLabel, setBaselineLabel] = useState("Baseline");
  const [currentLabel, setCurrentLabel] = useState("Current");
  const [baseline, setBaseline] = useState("");
  const [current, setCurrent] = useState("");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [baselineId, setBaselineId] = useState("");
  const [currentId, setCurrentId] = useState("");
  const [result, setResult] = useState<DiffResult | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try { localStorage.setItem(keyFor(projectId), JSON.stringify(snapshots)); } catch { setNotice("Browser storage is full or unavailable. Export snapshots to keep a copy."); }
  }, [snapshots, projectId]);

  function saveSnapshot(side: "baseline" | "current") {
    const text = side === "baseline" ? baseline : current;
    const label = (side === "baseline" ? baselineLabel : currentLabel).trim();
    if (!text.trim() || !label) { setNotice("Enter a snapshot label and non-empty content before saving."); return; }
    const snapshot: Snapshot = { id: newId(), name: label.slice(0, 100), mode, text, createdAt: new Date().toISOString() };
    setSnapshots((existing) => [snapshot, ...existing].slice(0, 40));
    if (side === "baseline") setBaselineId(snapshot.id); else setCurrentId(snapshot.id);
    setNotice(`Saved ${label} in this project's browser-local snapshot shelf.`);
  }

  function loadSnapshot(side: "baseline" | "current", id: string) {
    const snapshot = snapshots.find((item) => item.id === id);
    if (!snapshot) return;
    if (side === "baseline") { setBaseline(snapshot.text); setBaselineLabel(snapshot.name); setBaselineId(id); }
    else { setCurrent(snapshot.text); setCurrentLabel(snapshot.name); setCurrentId(id); }
    setMode(snapshot.mode);
    setResult(null);
  }

  function compare() {
    if (!baseline.trim() || !current.trim()) { setNotice("Both snapshots need content before comparison."); return; }
    const diff = compareSnapshots(baseline, current, { ignoreWhitespace });
    setResult(diff); setNotice("");
    onReport(`${diff.added} added, ${diff.removed} removed, ${diff.unchanged} unchanged`, {
      project: projectName, mode, baselineLabel, currentLabel, ignoreWhitespace,
      baseline, current, counts: { added: diff.added, removed: diff.removed, unchanged: diff.unchanged }, truncated: diff.truncated
    });
  }

  return <section className="page-content tool-page">
    <div className="eyebrow"><span className="eyebrow-line" /> WEB QA / 06</div>
    <h1 className="tool-title">Regression<span>Lab.</span></h1>
    <p className="tool-intro">Save a known-good text, DOM, HTML, CSS, or generated-output snapshot and compare it with a new version. This is a text diff, not a browser renderer or pixel screenshot engine.</p>
    <div className="tool-toolbar"><div className="tool-toolbar-label"><GitCompare size={16} /><strong>Snapshot workspace</strong><span>{projectName}</span></div><div className="toolbar-actions"><button className="secondary-button" onClick={() => downloadJson("devforge-regression-snapshots.json", snapshots)}><ArrowDownToLine size={14} /> Export snapshots</button><label className="secondary-button import-snapshot"><Upload size={14} /> Import snapshots<input type="file" accept="application/json,.json" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const parsed: unknown = JSON.parse(await file.text()); if (!Array.isArray(parsed) || parsed.length > 40 || parsed.some((item) => !item || typeof item.name !== "string" || typeof item.text !== "string" || typeof item.mode !== "string")) throw new Error("Choose an exported snapshot JSON array with no more than 40 valid snapshots."); const imported = parsed as Snapshot[]; setSnapshots((existing) => [...imported.map((item) => ({ ...item, id: newId() })), ...existing].slice(0, 40)); setNotice(`Imported ${imported.length} snapshot(s).`); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not import snapshot file."); } finally { event.target.value = ""; } }} /></label></div></div>
    <div className="snapshot-shelf results-panel"><div className="results-header"><div><span className="section-kicker">SAVED SNAPSHOTS</span><h2>Project shelf</h2></div><span className="report-count">{snapshots.length} / 40</span></div>{snapshots.length ? <div className="snapshot-list">{snapshots.map((snapshot) => <div className="snapshot-row" key={snapshot.id}><div><strong>{snapshot.name}</strong><small>{snapshot.mode} · {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.text.length.toLocaleString()} chars</small></div><div className="snapshot-actions"><button className="text-action" onClick={() => loadSnapshot("baseline", snapshot.id)}>Load as baseline</button><button className="text-action" onClick={() => loadSnapshot("current", snapshot.id)}>Load as current</button><button className="icon-button" aria-label={`Delete snapshot ${snapshot.name}`} onClick={() => { setSnapshots((existing) => existing.filter((item) => item.id !== snapshot.id)); if (baselineId === snapshot.id) setBaselineId(""); if (currentId === snapshot.id) setCurrentId(""); }}><Trash2 size={14} /></button></div></div>)}</div> : <p className="quiet-copy">No snapshots saved yet. Paste a baseline and current version below, then save either one for reuse.</p>}</div>
    <div className="regression-controls"><label className="judge-field">Snapshot type<select value={mode} onChange={(event) => setMode(event.target.value)}><option>Text / output</option><option>HTML / DOM text</option><option>CSS</option><option>JSON</option><option>Other code or config</option></select></label><label className="judge-check"><input type="checkbox" checked={ignoreWhitespace} onChange={(event) => setIgnoreWhitespace(event.target.checked)} /><span><strong>Ignore whitespace differences</strong><small>Collapse repeated whitespace and trim line edges before comparing.</small></span></label></div>
    <div className="manifest-workspace regression-workspace">
      <div className="editor-panel"><div className="editor-top"><span><span className="editor-dot" /> BASELINE SNAPSHOT</span><span>{baseline.length.toLocaleString()} CHARS</span></div><label className="snapshot-label">Label<input value={baselineLabel} onChange={(event) => setBaselineLabel(event.target.value)} /></label><textarea aria-label="Baseline snapshot content" value={baseline} onChange={(event) => { setBaseline(event.target.value); setResult(null); }} placeholder="Paste the known-good version here…" /><div className="editor-footer"><span>Reference / previous build</span><button className="text-action" onClick={() => saveSnapshot("baseline")}><Save size={13} /> Save baseline</button></div></div>
      <div className="editor-panel"><div className="editor-top"><span><span className="editor-dot" /> CURRENT SNAPSHOT</span><span>{current.length.toLocaleString()} CHARS</span></div><label className="snapshot-label">Label<input value={currentLabel} onChange={(event) => setCurrentLabel(event.target.value)} /></label><textarea aria-label="Current snapshot content" value={current} onChange={(event) => { setCurrent(event.target.value); setResult(null); }} placeholder="Paste the candidate version here…" /><div className="editor-footer"><span>Candidate / current build</span><button className="text-action" onClick={() => saveSnapshot("current")}><Save size={13} /> Save current</button></div></div>
    </div>
    <button className="primary-button regression-compare-button" onClick={compare} disabled={!baseline.trim() || !current.trim()}><GitCompare size={16} /> Compare snapshots</button>
    {notice && <div className="notice" role="status">{notice}</div>}
    {result && <div className="results-panel regression-results"><div className="results-header"><div><span className="section-kicker">DIFF RESULTS</span><h2>{baselineLabel} → {currentLabel}</h2></div><button className="secondary-button" onClick={() => downloadJson("devforge-regression-report.json", { projectName, mode, baselineLabel, currentLabel, ignoreWhitespace, counts: { added: result.added, removed: result.removed, unchanged: result.unchanged }, truncated: result.truncated, lines: result.lines })}><ArrowDownToLine size={14} /> Export diff</button></div><div className="score-grid"><div><strong>{result.added}</strong><span>ADDED LINES</span></div><div><strong className="count-error">{result.removed}</strong><span>REMOVED LINES</span></div><div><strong>{result.unchanged}</strong><span>UNCHANGED</span></div></div>{result.truncated && <div className="inspector-status">Diff capped at 1,200 lines per snapshot for browser responsiveness. Only the leading lines were compared.</div>}<div className="diff-list" aria-label="Line-by-line diff">{result.lines.map((line, index) => <div key={`${index}-${line.kind}`} className={`diff-line diff-${line.kind}`}><span>{line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}</span><small>{line.oldLine ?? ""}</small><small>{line.newLine ?? ""}</small><code>{line.text || " "}</code></div>)}</div><p className="quiet-copy">Whitespace mode normalizes line content for comparison but preserves original text in displayed lines. This tool does not execute or render either snapshot.</p></div>}
    <div className="disclaimer"><GitCompare size={16} /><p><strong>Regression, not execution.</strong> Snapshots stay in browser local storage and can be exported as JSON. Up to 40 saved snapshots are kept per project; comparisons are bounded to 1,200 lines per side.</p></div>
  </section>;
}
