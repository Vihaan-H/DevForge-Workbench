import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, CheckCircle2, GitCompare, Play, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { createPromptLabState, evaluatePromptOutput, normalizePromptLabState, type PromptLabState, type PromptTestCase, type PromptRun } from "../core/promptLab";

type Props = { projectId: string; projectName: string; onReport: (summary: string, payload: unknown) => void };
const keyFor = (projectId: string) => `devforge.promptlab.v1.${projectId}`;
const newId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const loadState = (projectId: string): PromptLabState => {
  try {
    const raw = localStorage.getItem(keyFor(projectId));
    return raw ? normalizePromptLabState(JSON.parse(raw)) : createPromptLabState();
  } catch { return createPromptLabState(); }
};
function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export default function PromptLab({ projectId, projectName, onReport }: Props) {
  const [data, setData] = useState<PromptLabState>(() => loadState(projectId));
  const [selectedVersionId, setSelectedVersionId] = useState(data.versions[data.versions.length - 1]?.id ?? "");
  const [selectedCaseId, setSelectedCaseId] = useState(data.cases[0]?.id ?? "");
  const [caseName, setCaseName] = useState("");
  const [caseInput, setCaseInput] = useState("");
  const [requiredText, setRequiredText] = useState("");
  const [forbiddenText, setForbiddenText] = useState("");
  const [minWords, setMinWords] = useState("");
  const [maxWords, setMaxWords] = useState("");
  const [output, setOutput] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const currentCase = data.cases.find((item) => item.id === selectedCaseId);
  const selectedVersion = data.versions.find((item) => item.id === selectedVersionId) ?? data.versions[data.versions.length - 1];
  const runA = data.runs.find((item) => item.id === compareA);
  const runB = data.runs.find((item) => item.id === compareB);
  const comparisonDifferent = useMemo(() => runA && runB ? runA.output !== runB.output : false, [runA, runB]);

  useEffect(() => {
    try { localStorage.setItem(keyFor(projectId), JSON.stringify(data)); } catch { /* Export remains available if storage is full or disabled. */ }
  }, [data, projectId]);

  function saveVersion() {
    const prompt = data.draft.trim();
    if (!prompt) return;
    const version = { id: newId(), label: `v${data.versions.length + 1}`, prompt, createdAt: new Date().toISOString() };
    setData((current) => ({ ...current, versions: [...current.versions, version].slice(-200) }));
    setSelectedVersionId(version.id);
  }

  function addCase() {
    if (!caseName.trim()) return;
    const min = minWords.trim() ? Number(minWords) : null;
    const max = maxWords.trim() ? Number(maxWords) : null;
    if ((min !== null && (!Number.isInteger(min) || min < 0)) || (max !== null && (!Number.isInteger(max) || max < 0)) || (min !== null && max !== null && min > max)) return;
    const testCase: PromptTestCase = { id: newId(), name: caseName.trim().slice(0, 100), input: caseInput, required: lines(requiredText), forbidden: lines(forbiddenText), minWords: min, maxWords: max };
    setData((current) => ({ ...current, cases: [...current.cases, testCase].slice(-200) }));
    setSelectedCaseId(testCase.id); setCaseName(""); setCaseInput(""); setRequiredText(""); setForbiddenText(""); setMinWords(""); setMaxWords("");
  }

  function runCase() {
    if (!currentCase || !selectedVersion || !output.trim()) return;
    const result = evaluatePromptOutput(output, currentCase);
    const run: PromptRun = { id: newId(), caseId: currentCase.id, caseName: currentCase.name, versionId: selectedVersion.id, versionLabel: selectedVersion.label, output, passed: result.passed, findings: result.findings, createdAt: new Date().toISOString() };
    setData((current) => ({ ...current, runs: [run, ...current.runs].slice(0, 500) }));
    setCompareB(run.id);
    onReport(`${result.passed ? "PASS" : "FAIL"} · ${currentCase.name} · ${selectedVersion.label}`, { project: projectName, promptName: data.promptName, version: selectedVersion, testCase: currentCase, result, run });
  }

  return <section className="page-content tool-page">
    <div className="eyebrow"><span className="eyebrow-line" /> AI TESTING / 05</div>
    <h1 className="tool-title">Prompt<span>Lab.</span></h1>
    <p className="tool-intro">Version prompt templates, keep deterministic test cases, and compare manually supplied outputs across versions. No model is called and nothing is sent to a service.</p>
    <div className="tool-toolbar"><div className="tool-toolbar-label"><Sparkles size={16} /><strong>Prompt workspace</strong><span>{projectName}</span></div><div className="toolbar-actions"><button className="secondary-button" onClick={() => downloadJson("devforge-promptlab-export.json", data)}><ArrowDownToLine size={14} /> Export workspace</button></div></div>
    <div className="prompt-layout">
      <div className="editor-panel prompt-editor">
        <div className="editor-top"><span><span className="editor-dot" /> PROMPT TEMPLATE</span><span>{data.versions.length} VERSION{data.versions.length === 1 ? "" : "S"}</span></div>
        <div className="prompt-meta"><label className="judge-field">Template name<input value={data.promptName} maxLength={120} onChange={(event) => setData((current) => ({ ...current, promptName: event.target.value }))} placeholder="Customer support reply" /></label><label className="judge-field">Version under test<select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>{data.versions.map((version) => <option key={version.id} value={version.id}>{version.label} · {new Date(version.createdAt).toLocaleDateString()}</option>)}</select></label></div>
        <textarea aria-label="Prompt draft" value={data.draft} onChange={(event) => setData((current) => ({ ...current, draft: event.target.value }))} placeholder="Write the prompt template here…" />
        <div className="prompt-actions"><button className="primary-button compact" onClick={saveVersion} disabled={!data.draft.trim()}><Save size={14} /> Save as version {data.versions.length + 1}</button><span>Saving a version freezes a copy; edits do not rewrite past versions.</span></div>
        <div className="version-list">{data.versions.slice().reverse().slice(0, 8).map((version) => <button key={version.id} className={version.id === selectedVersionId ? "version-row version-active" : "version-row"} onClick={() => { setSelectedVersionId(version.id); setData((current) => ({ ...current, draft: version.prompt })); }}><span><strong>{version.label}</strong><small>{new Date(version.createdAt).toLocaleString()}</small></span><span>{version.prompt.length} chars</span></button>)}</div>
      </div>
      <div className="results-panel">
        <div className="results-header"><div><span className="section-kicker">TEST CASES</span><h2>Repeatable checks</h2></div><span className="report-count">{data.cases.length} saved</span></div>
        <label className="judge-field">Selected test case<select value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)}>{data.cases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {currentCase ? <div className="case-summary"><strong>{currentCase.name}</strong><p>{currentCase.input || "No input/context stored."}</p><div>{currentCase.required.length} required · {currentCase.forbidden.length} forbidden · {currentCase.minWords ?? "no min"}–{currentCase.maxWords ?? "no max"} words</div><button className="text-action" onClick={() => { setCaseName(currentCase.name); setCaseInput(currentCase.input); setRequiredText(currentCase.required.join("\n")); setForbiddenText(currentCase.forbidden.join("\n")); setMinWords(currentCase.minWords === null ? "" : String(currentCase.minWords)); setMaxWords(currentCase.maxWords === null ? "" : String(currentCase.maxWords)); setData((current) => ({ ...current, cases: current.cases.filter((item) => item.id !== currentCase.id) })); setSelectedCaseId(data.cases.find((item) => item.id !== currentCase.id)?.id ?? ""); }}><Trash2 size={13} /> Replace by editing below</button></div> : <p className="quiet-copy">Create a case using the editor below. Cases contain checks, not AI judgements.</p>}
        <div className="case-form"><label className="judge-field">New case name<input value={caseName} onChange={(event) => setCaseName(event.target.value)} placeholder="Concise answer" /></label><label className="judge-field">Test input / context<textarea value={caseInput} onChange={(event) => setCaseInput(event.target.value)} placeholder="Context you would supply to the model" rows={2} /></label><div className="judge-number-row"><label>Minimum words<input type="number" min="0" value={minWords} onChange={(event) => setMinWords(event.target.value)} placeholder="No minimum" /></label><label>Maximum words<input type="number" min="0" value={maxWords} onChange={(event) => setMaxWords(event.target.value)} placeholder="No maximum" /></label></div><label className="judge-field">Required phrases <small>One per line, case-insensitive</small><textarea value={requiredText} onChange={(event) => setRequiredText(event.target.value)} rows={2} /></label><label className="judge-field">Forbidden phrases <small>One per line, case-insensitive</small><textarea value={forbiddenText} onChange={(event) => setForbiddenText(event.target.value)} rows={2} /></label><button className="secondary-button" onClick={addCase} disabled={!caseName.trim()}><Plus size={14} /> Save test case</button></div>
      </div>
    </div>
    <div className="results-panel prompt-run-panel">
      <div className="results-header"><div><span className="section-kicker">MANUAL OUTPUT TESTING</span><h2>Run selected case</h2></div><button className="primary-button compact" onClick={runCase} disabled={!currentCase || !selectedVersion || !output.trim()}><Play size={14} /> Evaluate output</button></div>
      <p className="quiet-copy">Use the selected prompt version and test case, run your model wherever you use it, then paste its actual output here. This tool checks only the configured rules.</p>
      <label className="judge-field">Output to evaluate<textarea className="prompt-output" value={output} onChange={(event) => setOutput(event.target.value)} placeholder="Paste the model output here…" rows={5} /></label>
      {data.runs[0] && <div className="last-run"><span className={data.runs[0].passed ? "judge-status passed" : "judge-status failed"}>{data.runs[0].passed ? <CheckCircle2 size={14} /> : <GitCompare size={14} />}{data.runs[0].passed ? "PASS" : "FAIL"} · {data.runs[0].versionLabel} · {data.runs[0].caseName}</span><p>{data.runs[0].findings.length ? data.runs[0].findings.join(" · ") : "Every enabled phrase and length rule passed."}</p></div>}
    </div>
    <div className="results-panel prompt-run-panel">
      <div className="results-header"><div><span className="section-kicker">RUN HISTORY</span><h2>Compare outputs</h2></div><span className="report-count">{data.runs.length} saved</span></div>
      {data.runs.length ? <><div className="run-compare-selects"><label className="judge-field">Output A<select value={compareA} onChange={(event) => setCompareA(event.target.value)}><option value="">Choose a run</option>{data.runs.map((run) => <option key={run.id} value={run.id}>{run.versionLabel} · {run.caseName} · {new Date(run.createdAt).toLocaleString()}</option>)}</select></label><label className="judge-field">Output B<select value={compareB} onChange={(event) => setCompareB(event.target.value)}><option value="">Choose a run</option>{data.runs.map((run) => <option key={run.id} value={run.id}>{run.versionLabel} · {run.caseName} · {new Date(run.createdAt).toLocaleString()}</option>)}</select></label></div>{runA && runB ? <div className="output-comparison"><div><strong>{runA.versionLabel} / {runA.caseName}</strong><pre>{runA.output}</pre></div><div><strong>{runB.versionLabel} / {runB.caseName}</strong><pre>{runB.output}</pre></div><p>{comparisonDifferent ? "Outputs differ." : "These outputs are identical."} PASS/FAIL badges reflect configured text and length rules, not factual accuracy.</p></div> : <p className="quiet-copy">Select two saved runs to compare their exact outputs.</p>}</> : <p className="quiet-copy">Your saved runs will appear here. A comparison is only meaningful when you bring actual model outputs, which is inconveniently how testing works.</p>}
      {data.runs.length > 0 && <button className="text-action" onClick={() => setData((current) => ({ ...current, runs: [] }))}>Clear run history</button>}
    </div>
    <div className="disclaimer"><Sparkles size={16} /><p><strong>Deterministic on purpose.</strong> PromptLab does not call a model, interpolate variables, or score prose quality. Its checks are exact configured text and word-count rules. Exported data can contain prompts and outputs, so review it before sharing.</p></div>
  </section>;
}
