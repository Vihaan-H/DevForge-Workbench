import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Braces, CheckCircle2, ChevronRight, CircleHelp, Command, FileSearch, FlaskConical, Gauge, GitBranch, Layers3, LockKeyhole, Menu, Search, ShieldCheck, Sparkles, TerminalSquare, Workflow, X } from "lucide-react";
import { inspectManifest, type ManifestCheckResult } from "./core/manifestMedic";

type ModuleId = "overview" | "manifest" | "inspector" | "output" | "prompts" | "regression" | "chaos";
type ModuleInfo = { id: ModuleId; title: string; description: string; icon: typeof ShieldCheck; status: "ready" | "planned"; tag: string };

const modules: ModuleInfo[] = [
  { id: "manifest", title: "Manifest Medic", description: "Inspect Chromium extension manifests for common configuration and permission issues.", icon: ShieldCheck, status: "ready", tag: "EXTENSIONS" },
  { id: "inspector", title: "Extension Inspector", description: "Inspect extension project files, references, and package structure.", icon: FileSearch, status: "planned", tag: "EXTENSIONS" },
  { id: "output", title: "OutputJudge", description: "Validate generated text and JSON against repeatable rules and schemas.", icon: Braces, status: "planned", tag: "AI TESTING" },
  { id: "prompts", title: "PromptLab", description: "Version prompts, run test cases, and compare outputs side by side.", icon: FlaskConical, status: "planned", tag: "AI TESTING" },
  { id: "regression", title: "RegressionLab", description: "Compare snapshots and catch unexpected changes between page versions.", icon: Workflow, status: "planned", tag: "WEB QA" },
  { id: "chaos", title: "ChaosUI", description: "Stress-test layouts with awkward viewports and accessibility scenarios.", icon: Gauge, status: "planned", tag: "WEB QA" }
];

const starterManifest = JSON.stringify({
  manifest_version: 3,
  name: "My Extension",
  version: "1.0.0",
  description: "A sample extension to inspect",
  action: { default_title: "Open extension" },
  permissions: ["storage"],
  host_permissions: []
}, null, 2);

const initialResult = inspectManifest(starterManifest);

function loadManifest(): string {
  try { return localStorage.getItem("devforge.manifest.source") ?? starterManifest; }
  catch { return starterManifest; }
}

export default function App() {
  const [active, setActive] = useState<ModuleId>("overview");
  const [manifestSource, setManifestSource] = useState(loadManifest);
  const [result, setResult] = useState<ManifestCheckResult>(initialResult);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState("");

  const visibleModules = useMemo(() => modules.filter((item) =>
    `${item.title} ${item.description} ${item.tag}`.toLowerCase().includes(filter.toLowerCase())
  ), [filter]);

  function runInspection() {
    const next = inspectManifest(manifestSource);
    setResult(next);
    try { localStorage.setItem("devforge.manifest.source", manifestSource); } catch { /* Storage may be disabled. */ }
    setNotice("Inspection complete. Results are calculated locally in this tab.");
  }

  function exportReport() {
    const report = {
      tool: "DevForge Manifest Medic",
      createdAt: new Date().toISOString(),
      summary: result.summary,
      findings: result.findings,
      manifestName: typeof result.manifest?.name === "string" ? result.manifest.name : null
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "devforge-manifest-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Report export started.");
  }

  const selected = modules.find((item) => item.id === active);
  const SelectedIcon = selected?.icon ?? CircleHelp;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Command size={21} strokeWidth={2.5} /></div>
          <div><strong>devforge<span>.</span></strong><small>WORKBENCH / LOCAL</small></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <button className={`nav-item ${active === "overview" ? "active" : ""}`} onClick={() => { setActive("overview"); setMobileNavOpen(false); }}>
          <Layers3 size={17} /><span>Overview</span><span className="nav-shortcut">⌘ 1</span>
        </button>
        <div className="workspace-label tools-label">TOOLKIT <span>06</span></div>
        {modules.map((item, index) => {
          const Icon = item.icon;
          return <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`} onClick={() => { setActive(item.id); setMobileNavOpen(false); }}>
            <Icon size={17} /><span>{item.title}</span>{item.status === "ready" ? <span className="ready-dot" /> : <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>}
          </button>;
        })}
        <div className="sidebar-spacer" />
        <div className="privacy-card"><div className="privacy-icon"><LockKeyhole size={16} /></div><div><strong>Local-first by design</strong><p>Your manifest stays in this browser. No upload, no account, no mystery server.</p></div></div>
        <a className="github-link" href="https://github.com/Vihaan-H/DevForge-Workbench" target="_blank" rel="noreferrer"><GitBranch size={16} /> View source <ArrowUpRight size={14} /></a>
        <div className="sidebar-footer"><span className="status-led" /> SYSTEM READY <span>v0.1.0</span></div>
      </aside>

      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workbench</span><ChevronRight size={14} /><strong>{selected?.title ?? "Overview"}</strong></div>
          <div className="topbar-right"><span className="local-pill"><span /> LOCAL MODE</span><button className="icon-button help-button" title="About DevForge" onClick={() => setNotice("DevForge is a local-first toolkit. Planned modules are labeled clearly and are not yet implemented.")}><CircleHelp size={18} /></button></div>
        </header>

        {active === "overview" ? <section className="page-content">
          <div className="hero-row">
            <div><div className="eyebrow"><span className="eyebrow-line" /> DEVELOPER TOOLING, WITHOUT THE CEREMONY</div><h1>Build it. Break it.<br /><span>Know why.</span></h1><p className="hero-copy">A focused workbench for testing interfaces, browser extensions, and AI outputs. Catch the silly bugs before they become very public silly bugs.</p>
              <button className="primary-button" onClick={() => setActive("manifest")}><ShieldCheck size={17} /> Open Manifest Medic <ArrowUpRight size={15} /></button>
            </div>
            <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="core-cube"><Command size={38} /></div><span className="float-chip chip-a"><Braces size={14} /> JSON</span><span className="float-chip chip-b"><Activity size={14} /> QA</span><span className="float-chip chip-c"><TerminalSquare size={14} /> DEV</span></div>
          </div>

          <div className="section-heading"><div><span className="section-kicker">YOUR TOOLBELT</span><h2>Workbench modules</h2></div><div className="module-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find a tool..." aria-label="Filter modules" /></div></div>
          <div className="module-grid">
            {visibleModules.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} className={`module-card ${item.status === "planned" ? "module-planned" : ""}`} onClick={() => setActive(item.id)}>
                <div className="module-card-top"><div className="module-icon"><Icon size={19} /></div><span className={`module-status ${item.status}`}>{item.status === "ready" ? "AVAILABLE" : "PLANNED"}</span></div>
                <span className="module-tag">{item.tag}</span><h3>{item.title}</h3><p>{item.description}</p><div className="module-card-bottom"><span>{item.status === "ready" ? "Launch tool" : "In the build queue"}</span><ArrowUpRight size={16} /></div>
              </button>;
            })}
            {visibleModules.length === 0 && <div className="empty-search">No tools match that search. The search box has standards. Respect them.</div>}
          </div>

          <div className="bottom-grid"><div className="activity-panel"><div className="panel-heading"><div><span className="section-kicker">BUILD STATUS</span><h3>Project heartbeat</h3></div><span className="live-label"><span /> LIVE</span></div><div className="heartbeat-row"><div className="heartbeat-icon"><CheckCircle2 size={18} /></div><div><strong>Core shell initialized</strong><p>React, TypeScript, Vite and strict type checks</p></div><span className="done-tag">DONE</span></div><div className="heartbeat-row"><div className="heartbeat-icon"><CheckCircle2 size={18} /></div><div><strong>Manifest Medic engine</strong><p>Static checks with unit test coverage</p></div><span className="done-tag">DONE</span></div><div className="heartbeat-row"><div className="heartbeat-icon muted"><Sparkles size={18} /></div><div><strong>Remaining modules</strong><p>Built in stages, not fake buttons</p></div><span className="queued-tag">QUEUED</span></div></div>
          <div className="principles-panel"><div className="principle-symbol"><LockKeyhole size={20} /></div><span className="section-kicker">PROJECT PRINCIPLES</span><h3>Private by default.</h3><p>Inspect locally. Export deliberately. Never execute untrusted project files just to inspect them.</p><div className="principle-rule" /><div className="principle-meta"><span>NO API KEYS</span><span>NO BACKEND</span><span>YOUR FILES</span></div></div></div>
          <footer className="page-footer"><span>DEVFORGE WORKBENCH <span className="footer-dot">/</span> BUILD 0001</span><span>Made for people who read the error message.</span></footer>
        </section> : active === "manifest" ? <section className="page-content tool-page">
          <div className="eyebrow"><span className="eyebrow-line" /> EXTENSION TOOLING / 01</div><h1 className="tool-title">Manifest <span>Medic.</span></h1><p className="tool-intro">Static checks for Chromium extension manifests. Paste your JSON, inspect the findings, and export a report. Nothing is uploaded.</p>
          <div className="tool-toolbar"><div className="tool-toolbar-label"><Braces size={16} /><strong>manifest.json</strong><span>JSON INPUT</span></div><div className="toolbar-actions"><button className="secondary-button" onClick={() => { setManifestSource(starterManifest); setNotice("Starter manifest restored."); }}><Activity size={15} /> Reset sample</button><button className="primary-button compact" onClick={runInspection}><ShieldCheck size={16} /> Run checks</button></div></div>
          <div className="manifest-workspace"><div className="editor-panel"><div className="editor-top"><span><span className="editor-dot" /> SOURCE EDITOR</span><span>JSON</span></div><textarea spellCheck={false} aria-label="Manifest JSON source" value={manifestSource} onChange={(event) => setManifestSource(event.target.value)} /><div className="editor-footer"><span>Local inspection only</span><span>{manifestSource.split("\n").length} lines</span></div></div>
            <div className="results-panel"><div className="results-header"><div><span className="section-kicker">DIAGNOSTICS</span><h2>Inspection results</h2></div><button className="icon-button" onClick={exportReport} title="Export report"><ArrowUpRight size={17} /></button></div><div className="score-grid"><div><strong className={result.summary.errors ? "count-error" : ""}>{result.summary.errors}</strong><span>ERRORS</span></div><div><strong className={result.summary.warnings ? "count-warning" : ""}>{result.summary.warnings}</strong><span>WARNINGS</span></div><div><strong>{result.summary.info}</strong><span>INFO</span></div></div><div className="finding-list">{result.findings.map((finding) => <article className={`finding finding-${finding.severity}`} key={finding.id}><div className="finding-symbol">{finding.severity === "error" ? "!" : finding.severity === "warning" ? "△" : "i"}</div><div><div className="finding-title-row"><strong>{finding.title}</strong><span>{finding.severity.toUpperCase()}</span></div><p>{finding.detail}</p>{finding.path && <code>{finding.path}</code>}</div></article>)}</div><button className="secondary-button export-button" onClick={exportReport}><ArrowUpRight size={15} /> Export JSON report</button></div>
          </div><div className="disclaimer"><CircleHelp size={16} /><p><strong>Keep expectations calibrated.</strong> These are baseline static rules, not a complete Chrome Web Store review. File existence checks and deeper project inspection are planned for Extension Inspector.</p></div>
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={14} /></button></div>}
          <footer className="page-footer"><span>MANIFEST MEDIC <span className="footer-dot">/</span> LOCAL ENGINE</span><span>Input is not sent to a server.</span></footer>
        </section> : <section className="page-content planned-page"><div className="eyebrow"><span className="eyebrow-line" /> WORKBENCH MODULE</div><div className="planned-icon"><SelectedIcon size={28} /></div><h1 className="tool-title">{selected?.title ?? "Module"}<span>.</span></h1><p className="tool-intro">{selected?.description}</p><div className="planned-card"><div className="planned-card-icon"><Sparkles size={21} /></div><div><span className="module-status planned">PLANNED</span><h2>This module is not implemented yet.</h2><p>It is on the roadmap, but this screen is deliberately honest instead of pretending a button is a product. The first working module is Manifest Medic.</p><button className="primary-button" onClick={() => setActive("manifest")}><ShieldCheck size={16} /> Use Manifest Medic <ArrowUpRight size={15} /></button></div></div><footer className="page-footer"><span>DEVFORGE WORKBENCH <span className="footer-dot">/</span> BUILD 0001</span><span>Small reliable steps beat six pretend tools.</span></footer></section>}
      </main>
      {notice && active === "overview" && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={14} /></button></div>}
    </div>
  );
}
