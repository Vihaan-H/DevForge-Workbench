import { useMemo, useState } from "react";
import { ArrowDownToLine, CheckCircle2, ClipboardCheck, Play, RotateCcw } from "lucide-react";

type Finding = { severity: "error" | "warning" | "info"; title: string; detail: string };
type Props = { projectName: string; onReport: (summary: string, payload: unknown) => void };
type Rules = { parseJson: boolean; minWords: string; maxWords: string; required: string; forbidden: string; schema: string };
const DEFAULT_RULES: Rules = { parseJson: false, minWords: "", maxWords: "", required: "", forbidden: "", schema: "" };
const wordCount = (text: string) => (text.trim().match(/\S+/g) ?? []).length;

function checkSchema(value: unknown, schema: unknown, path = "$"): string[] {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return [];
  const rule = schema as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof rule.type === "string") {
    const valid = rule.type === "object" ? !!value && typeof value === "object" && !Array.isArray(value)
      : rule.type === "array" ? Array.isArray(value)
      : rule.type === "null" ? value === null
      : rule.type === "integer" ? typeof value === "number" && Number.isInteger(value)
      : rule.type === "number" ? typeof value === "number"
      : rule.type === "string" ? typeof value === "string"
      : rule.type === "boolean" ? typeof value === "boolean" : true;
    if (!valid) errors.push(`${path} must be ${rule.type}`);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    if (Array.isArray(rule.required)) for (const key of rule.required) if (typeof key === "string" && !(key in object)) errors.push(`${path} is missing required property "${key}"`);
    if (rule.properties && typeof rule.properties === "object" && !Array.isArray(rule.properties)) {
      for (const [key, childSchema] of Object.entries(rule.properties as Record<string, unknown>)) {
        if (key in object) errors.push(...checkSchema(object[key], childSchema, `${path}.${key}`));
      }
    }
  }
  if (Array.isArray(value) && rule.items) value.forEach((item, index) => errors.push(...checkSchema(item, rule.items, `${path}[${index}]`)));
  if (typeof value === "string") {
    if (typeof rule.minLength === "number" && value.length < rule.minLength) errors.push(`${path} must contain at least ${rule.minLength} characters`);
    if (typeof rule.maxLength === "number" && value.length > rule.maxLength) errors.push(`${path} must contain at most ${rule.maxLength} characters`);
    if (typeof rule.pattern === "string") {
      try { if (!new RegExp(rule.pattern).test(value)) errors.push(`${path} does not match pattern ${rule.pattern}`); }
      catch { errors.push(`Schema pattern at ${path} is not a valid regular expression`); }
    }
  }
  return errors;
}

function evaluate(output: string, rules: Rules) {
  const findings: Finding[] = [];
  const words = wordCount(output);
  let parsed: unknown;
  let parsedOk = false;
  if (rules.parseJson || rules.schema.trim()) {
    try { parsed = JSON.parse(output); parsedOk = true; }
    catch (error) { findings.push({ severity: "error", title: "Invalid JSON", detail: error instanceof Error ? error.message : "Output could not be parsed as JSON." }); }
  }
  const min = rules.minWords.trim() ? Number(rules.minWords) : null;
  const max = rules.maxWords.trim() ? Number(rules.maxWords) : null;
  if (min !== null && Number.isFinite(min) && words < min) findings.push({ severity: "error", title: "Below minimum word count", detail: `Output has ${words} words; minimum is ${min}.` });
  if (max !== null && Number.isFinite(max) && words > max) findings.push({ severity: "error", title: "Above maximum word count", detail: `Output has ${words} words; maximum is ${max}.` });
  const required = rules.required.split("\n").map((line) => line.trim()).filter(Boolean);
  required.forEach((term) => { if (!output.toLocaleLowerCase().includes(term.toLocaleLowerCase())) findings.push({ severity: "error", title: "Required text missing", detail: `Expected to find: ${term}` }); });
  const forbidden = rules.forbidden.split("\n").map((line) => line.trim()).filter(Boolean);
  forbidden.forEach((term) => { if (output.toLocaleLowerCase().includes(term.toLocaleLowerCase())) findings.push({ severity: "error", title: "Forbidden text found", detail: `Unexpected text found: ${term}` }); });
  if (rules.schema.trim() && parsedOk) {
    try {
      const schema = JSON.parse(rules.schema);
      checkSchema(parsed, schema).forEach((detail) => findings.push({ severity: "error", title: "Schema mismatch", detail }));
    } catch (error) { findings.push({ severity: "error", title: "Invalid schema JSON", detail: error instanceof Error ? error.message : "Schema must be valid JSON." }); }
  }
  if (!findings.length) findings.push({ severity: "info", title: "All enabled checks passed", detail: "No violations were found for the selected deterministic rules. This does not judge factual accuracy or quality." });
  return { findings, words, characters: output.length, passed: findings.every((item) => item.severity !== "error") };
}

export default function OutputJudge({ projectName, onReport }: Props) {
  const [output, setOutput] = useState("");
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [result, setResult] = useState<ReturnType<typeof evaluate> | null>(null);
  const report = useMemo(() => result ? { tool: "OutputJudge", createdAt: new Date().toISOString(), project: projectName, metrics: { words: result.words, characters: result.characters, passed: result.passed }, rules, findings: result.findings } : null, [result, projectName, rules]);

  function run() {
    const next = evaluate(output, rules);
    setResult(next);
    onReport(`${next.passed ? "PASS" : "FAIL"} · ${next.findings.filter((item) => item.severity === "error").length} violation(s), ${next.words} words`, { outputLength: output.length, words: next.words, passed: next.passed, rules, findings: next.findings });
  }
  function exportReport() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "devforge-outputjudge-report.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const update = (key: keyof Rules, value: string | boolean) => setRules((current) => ({ ...current, [key]: value }));

  return <section className="page-content tool-page">
    <div className="eyebrow"><span className="eyebrow-line" /> AI TESTING / 04</div>
    <h1 className="tool-title">Output<span>Judge.</span></h1>
    <p className="tool-intro">Run repeatable, deterministic checks on any text or manually supplied AI output. No model call, API key, or upload. It checks rules, not whether something is true or brilliant.</p>
    <div className="tool-toolbar"><div className="tool-toolbar-label"><ClipboardCheck size={16} /><strong>OUTPUT VALIDATION</strong><span>{projectName}</span></div><div className="toolbar-actions"><button className="secondary-button" onClick={() => { setOutput(""); setRules(DEFAULT_RULES); setResult(null); }}><RotateCcw size={14} /> Reset</button><button className="primary-button compact" onClick={run}><Play size={14} /> Run checks</button></div></div>
    <div className="judge-layout">
      <div className="editor-panel"><div className="editor-top"><span><span className="editor-dot" /> OUTPUT UNDER TEST</span><span>{wordCount(output)} WORDS</span></div><textarea aria-label="Output text to validate" spellCheck={false} value={output} onChange={(event) => setOutput(event.target.value)} placeholder="Paste the output you want to test here..." /><div className="editor-footer"><span>{output.length.toLocaleString()} characters</span><span>Local only</span></div></div>
      <div className="results-panel judge-rules"><div className="results-header"><div><span className="section-kicker">TEST RULES</span><h2>Validation settings</h2></div></div>
        <label className="judge-check"><input type="checkbox" checked={rules.parseJson} onChange={(event) => update("parseJson", event.target.checked)} /><span><strong>Must be valid JSON</strong><small>Parse the entire output as JSON.</small></span></label>
        <div className="judge-number-row"><label>Minimum words<input type="number" min="0" value={rules.minWords} onChange={(event) => update("minWords", event.target.value)} placeholder="No minimum" /></label><label>Maximum words<input type="number" min="0" value={rules.maxWords} onChange={(event) => update("maxWords", event.target.value)} placeholder="No maximum" /></label></div>
        <label className="judge-field">Required text <small>One phrase per line, case-insensitive.</small><textarea rows={3} value={rules.required} onChange={(event) => update("required", event.target.value)} placeholder={"must include\nsource"} /></label>
        <label className="judge-field">Forbidden text <small>One phrase per line, case-insensitive.</small><textarea rows={3} value={rules.forbidden} onChange={(event) => update("forbidden", event.target.value)} placeholder={"TODO\ninsert here"} /></label>
        <label className="judge-field">Optional JSON schema subset <small>Supports type, required, properties, items, minLength, maxLength, pattern.</small><textarea rows={5} value={rules.schema} onChange={(event) => update("schema", event.target.value)} placeholder={'{"type":"object","required":["answer"],"properties":{"answer":{"type":"string","minLength":1}}}'} /></label>
      </div>
    </div>
    {result && <div className="judge-result"><div className="results-header"><div><span className="section-kicker">LATEST RUN</span><h2>{result.passed ? "Checks passed" : "Checks failed"}</h2></div><div className={`judge-status ${result.passed ? "passed" : "failed"}`}>{result.passed ? <CheckCircle2 size={16} /> : <ClipboardCheck size={16} />}{result.passed ? "PASS" : "FAIL"}</div></div><div className="score-grid"><div><strong>{result.words}</strong><span>WORDS</span></div><div><strong>{result.characters}</strong><span>CHARACTERS</span></div><div><strong className={result.passed ? "" : "count-error"}>{result.findings.filter((item) => item.severity === "error").length}</strong><span>VIOLATIONS</span></div></div><div className="finding-list">{result.findings.map((item, index) => <article className={`finding finding-${item.severity}`} key={item.title + index}><div className="finding-symbol">{item.severity === "error" ? "!" : "i"}</div><div><div className="finding-title-row"><strong>{item.title}</strong><span>{item.severity.toUpperCase()}</span></div><p>{item.detail}</p></div></article>)}</div><button className="secondary-button export-button" onClick={exportReport}><ArrowDownToLine size={15} /> Export JSON report</button></div>}
    <div className="disclaimer"><ClipboardCheck size={16} /><p><strong>Deterministic means repeatable.</strong> Phrase checks are case-insensitive substring matches. The schema validator supports a documented subset of JSON Schema, not the entire standard. A PASS only means the enabled checks passed.</p></div>
  </section>;
}
