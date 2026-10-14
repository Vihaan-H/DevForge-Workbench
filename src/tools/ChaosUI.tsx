import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownToLine, Eye, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { buildChaosPreviewDocument, inspectChaosMarkup, type ChaosScenario } from "../core/chaosUI";

type Props = { projectId: string; projectName: string; onReport: (summary: string, payload: unknown) => void };
const KEY = (projectId: string) => `devforge.chaosui.v1.${projectId}`;
const SAMPLE_HTML = `<main class="demo-card">
  <p class="eyebrow">CHAOSUI TEST FIXTURE</p>
  <h1>Stress-test this interface</h1>
  <p class="copy">Try awkwardly long content, narrow viewports, keyboard focus, and enlarged text. Real layouts should cope with people doing normal human things.</p>
  <div class="actions"><button>Primary action</button><button aria-label="Open settings">⚙</button></div>
  <img src="https://example.invalid/preview.png" alt="Decorative example" />
  <h2>Details</h2>
  <p>Keep the layout readable when the content gets longer than the designer expected.</p>
  <a href="#details">Read more</a>
</main>`;
const SAMPLE_CSS = `* { box-sizing: border-box; }
.demo-card { max-width: 640px; margin: 20px auto; padding: 24px; border: 1px solid #d3d9cf; border-radius: 14px; box-shadow: 0 12px 30px #0001; }
.eyebrow { color: #557229; font-size: 12px; letter-spacing: .12em; font-weight: 700; }
h1 { font-size: 30px; line-height: 1.15; margin: 12px 0; }
.copy { color: #43483f; line-height: 1.65; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0; }
button { padding: 10px 14px; border: 0; border-radius: 7px; background: #c5f467; color: #17200e; }
img { display: block; width: 100%; min-height: 60px; object-fit: cover; margin: 14px 0; }
a { color: #315b8e; }
button:focus { outline: 0; }
`;
const scenarios: { id: ChaosScenario; label: string; description: string; width: number }[] = [
  { id: "baseline", label: "Baseline", description: "Normal preview, reset scenario overrides.", width: 720 },
  { id: "mobile", label: "Mobile · 375 px", description: "Simulate a narrow mobile content area.", width: 375 },
  { id: "narrow", label: "Tiny · 280 px", description: "Expose fixed-width overflow and wrapping issues.", width: 280 },
  { id: "large-text", label: "Large text · 125%", description: "Increase type size and line height.", width: 720 },
  { id: "focus-visible", label: "Keyboard focus", description: "Make focused elements highly visible.", width: 720 },
  { id: "high-contrast", label: "High contrast", description: "Increase contrast and outline interactive controls.", width: 720 },
  { id: "reduced-motion", label: "Reduced motion", description: "Minimize CSS animations and transitions.", width: 720 }
];
function load(projectId: string) {
  const fallback = { html: SAMPLE_HTML, css: SAMPLE_CSS };
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY(projectId)) ?? "null");
    if (value && typeof value === "object" && typeof (value as {html?: unknown}).html === "string" && typeof (value as {css?: unknown}).css === "string") return { html: (value as {html:string}).html, css: (value as {css:string}).css };
  } catch { /* damaged local data falls back to a known-safe sample */ }
  return fallback;
}
function downloadJson(value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "devforge-chaosui-report.json"; link.click(); URL.revokeObjectURL(url);
}

export default function ChaosUI({ projectId, projectName, onReport }: Props) {
  const initial = useMemo(() => load(projectId), [projectId]);
  const [html, setHtml] = useState(initial.html);
  const [css, setCss] = useState(initial.css);
  const [scenario, setScenario] = useState<ChaosScenario>("baseline");
  const [checked, setChecked] = useState(false);
  const [notice, setNotice] = useState("");
  const safePreview = useMemo(() => buildChaosPreviewDocument(html, css, scenario), [html, css, scenario]);
  const inspection = useMemo(() => inspectChaosMarkup(html, css), [html, css]);
  const currentScenario = scenarios.find((item) => item.id === scenario) ?? scenarios[0]!;

  useEffect(() => {
    try { localStorage.setItem(KEY(projectId), JSON.stringify({ html, css })); }
    catch { setNotice("Browser storage is unavailable or full. Export the report to keep your current checks."); }
  }, [projectId, html, css]);

  function runChecks() {
    setChecked(true);
    const summary = `${inspection.summary.errors} error(s), ${inspection.summary.warnings} warning(s), ${inspection.summary.info} info finding(s)`;
    onReport(summary, { project: projectName, scenario, viewportWidth: currentScenario.width, findings: inspection.findings, summary: inspection.summary, strippedFeatures: safePreview.strippedFeatures, checkedAt: new Date().toISOString() });
    setNotice("Static checks complete. Preview remains sandboxed and script-free.");
  }
  function reset() {
    setHtml(SAMPLE_HTML); setCss(SAMPLE_CSS); setScenario("baseline"); setChecked(false); setNotice("Sample and scenario reset. Local changes are replaced with the sample.");
  }

  return <section className="page-content tool-page">
    <div className="eyebrow"><span className="eyebrow-line" /> WEB QA / 07</div>
    <h1 className="tool-title">Chaos<span>UI.</span></h1>
    <p className="tool-intro">Push a pasted interface fragment through awkward viewport widths, larger text, focus visibility, contrast, and reduced motion. The preview runs in a sandbox with scripts removed and external resources stripped.</p>
    <div className="tool-toolbar"><div className="tool-toolbar-label"><Activity size={16} /><strong>UI stress workspace</strong><span>{projectName}</span></div><div className="toolbar-actions"><button className="secondary-button" onClick={() => downloadJson({ tool: "ChaosUI", projectName, scenario, summary: inspection.summary, findings: inspection.findings, strippedFeatures: safePreview.strippedFeatures, html, css, createdAt: new Date().toISOString() })}><ArrowDownToLine size={14} /> Export report</button><button className="secondary-button" onClick={reset}><RotateCcw size={14} /> Reset sample</button></div></div>
    <div className="chaos-toolbar">
      <label className="judge-field">Stress scenario<select value={scenario} onChange={(event) => setScenario(event.target.value as ChaosScenario)}>{scenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <div className="chaos-scenario-info"><Sparkles size={16} /><div><strong>{currentScenario.label}</strong><p>{currentScenario.description}</p></div></div>
      <button className="primary-button compact" onClick={runChecks}><ShieldCheck size={15} /> Run checks</button>
    </div>
    <div className="chaos-editors">
      <div className="editor-panel"><div className="editor-top"><span><span className="editor-dot" /> HTML FRAGMENT</span><span>{html.length.toLocaleString()} CHARS</span></div><textarea spellCheck={false} aria-label="HTML fragment input" value={html} onChange={(event) => { setHtml(event.target.value); setChecked(false); }} placeholder="Paste body markup only…" /><div className="editor-footer"><span>Scripts, forms and remote resources are removed in preview</span><span>HTML</span></div></div>
      <div className="editor-panel"><div className="editor-top"><span><span className="editor-dot" /> CSS RULES</span><span>{css.length.toLocaleString()} CHARS</span></div><textarea spellCheck={false} aria-label="CSS input" value={css} onChange={(event) => { setCss(event.target.value); setChecked(false); }} placeholder="Paste CSS rules…" /><div className="editor-footer"><span>Imports and remote url() references are stripped</span><span>CSS</span></div></div>
    </div>
    <div className="results-panel chaos-preview-panel">
      <div className="results-header"><div><span className="section-kicker">SANDBOXED PREVIEW</span><h2><Eye size={17} /> {currentScenario.label}</h2></div><span className="report-count">Viewport target: {currentScenario.width}px</span></div>
      <div className="chaos-viewport-shell"><div className="chaos-viewport-meta"><span>Live preview</span><span>{currentScenario.width}px target</span></div><iframe title="ChaosUI script-free preview" sandbox="" referrerPolicy="no-referrer" srcDoc={safePreview.srcdoc} style={{ width: `min(100%, ${currentScenario.width}px)`, minHeight: 360, border: "1px solid #343b2f", borderRadius: 6, background: "#fff", display: "block", margin: "0 auto" }} /></div>
      {safePreview.strippedFeatures.length > 0 && <div className="inspector-status"><ShieldCheck size={15} /><div><strong>Removed from preview:</strong> {safePreview.strippedFeatures.join(" · ")}</div></div>}
    </div>
    <div className="results-panel chaos-findings-panel"><div className="results-header"><div><span className="section-kicker">STATIC QA CHECKS</span><h2>Accessibility and layout hints</h2></div><span className="report-count">{inspection.findings.length} finding(s)</span></div><div className="score-grid"><div><strong className={inspection.summary.errors ? "count-error" : ""}>{inspection.summary.errors}</strong><span>ERRORS</span></div><div><strong className={inspection.summary.warnings ? "count-warning" : ""}>{inspection.summary.warnings}</strong><span>WARNINGS</span></div><div><strong>{inspection.summary.info}</strong><span>INFO</span></div></div><div className="finding-list">{inspection.findings.map((finding) => <article className={`finding finding-${finding.severity}`} key={finding.id}><div className="finding-symbol">{finding.severity === "error" ? "!" : finding.severity === "warning" ? "△" : "i"}</div><div><div className="finding-title-row"><strong>{finding.title}</strong><span>{finding.severity.toUpperCase()}</span></div><p>{finding.detail}</p></div></article>)}</div>{checked && <div className="notice" role="status">Checks recorded in local report history.</div>}</div>
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="disclaimer"><ShieldCheck size={16} /><p><strong>Not a full browser audit.</strong> Checks are static heuristics; they cannot prove accessibility, calculate rendered contrast, measure real reflow, or replace testing in an actual browser. Preview is script-free in an opaque sandbox, but treat user-supplied markup and styles as untrusted.</p></div>
  </section>;
}
