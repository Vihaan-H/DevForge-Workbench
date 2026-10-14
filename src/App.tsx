import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownToLine, ArrowUpRight, Braces, CheckCircle2, ChevronRight, CircleHelp, Command, FileSearch, FlaskConical, Gauge, GitBranch, Layers3, LockKeyhole, Menu, Plus, Search, Settings2, ShieldCheck, Sparkles, TerminalSquare, Workflow, X, Upload, Trash2, FolderKanban, Download } from "lucide-react";
import { inspectManifest, type ManifestCheckResult } from "./core/manifestMedic";
import ExtensionInspector from "./tools/ExtensionInspector";
import OutputJudge from "./tools/OutputJudge";
import PromptLab from "./tools/PromptLab";
import RegressionLab from "./tools/RegressionLab";
import ChaosUI from "./tools/ChaosUI";
import { createDefaultState, createProject, exportWorkbenchState, loadWorkbenchState, makeReport, parseWorkbenchImport, saveWorkbenchState, type ModuleId, type WorkbenchProject, type WorkbenchState } from "./core/workbench";

type ModuleInfo = { id: Exclude<ModuleId, "overview">; title: string; description: string; icon: typeof ShieldCheck; status: "ready" | "planned"; tag: string };
const modules: ModuleInfo[] = [
  { id: "manifest", title: "Manifest Medic", description: "Inspect Chromium extension manifests for configuration, permission, and structure issues.", icon: ShieldCheck, status: "ready", tag: "EXTENSIONS" },
  { id: "inspector", title: "Extension Inspector", description: "Inspect extension project files, references, and package structure.", icon: FileSearch, status: "ready", tag: "EXTENSIONS" },
  { id: "output", title: "OutputJudge", description: "Validate generated text and JSON against repeatable rules and schemas.", icon: Braces, status: "ready", tag: "AI TESTING" },
  { id: "prompts", title: "PromptLab", description: "Version prompts, run test cases, and compare outputs side by side.", icon: FlaskConical, status: "ready", tag: "AI TESTING" },
  { id: "regression", title: "RegressionLab", description: "Compare snapshots and catch unexpected changes between page versions.", icon: Workflow, status: "ready", tag: "WEB QA" },
  { id: "chaos", title: "ChaosUI", description: "Stress-test layouts with awkward viewports and accessibility scenarios.", icon: Gauge, status: "ready", tag: "WEB QA" }
];

function downloadText(filename: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

export default function App() {
  const [workbench, setWorkbench] = useState<WorkbenchState>(() => loadWorkbenchState());
  const [active, setActive] = useState<ModuleId>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [manifestResult, setManifestResult] = useState<ManifestCheckResult>(() => inspectManifest(loadWorkbenchState().projects[0]?.manifestSource ?? "{}"));
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedProject = workbench.projects.find((project) => project.id === workbench.selectedProjectId) ?? workbench.projects[0];
  const manifestSource = selectedProject?.manifestSource ?? "";
  const visibleModules = useMemo(() => modules.filter((item) =>
    `${item.title} ${item.description} ${item.tag}`.toLowerCase().includes(filter.toLowerCase())
  ), [filter]);

  useEffect(() => {
    setManifestResult(inspectManifest(manifestSource));
  }, [selectedProject?.id, manifestSource]);

  useEffect(() => {
    const saved = saveWorkbenchState(workbench);
    if (!saved) setNotice("Browser storage is unavailable. Export your workbench JSON to keep a portable copy.");
  }, [workbench]);

  function updateWorkbench(updater: (current: WorkbenchState) => WorkbenchState) {
    setWorkbench((current) => updater(current));
  }

  function updateSelectedProject(updates: Partial<WorkbenchProject>) {
    if (!selectedProject) return;
    const now = new Date().toISOString();
    updateWorkbench((current) => ({
      ...current,
      projects: current.projects.map((project) => project.id === selectedProject.id ? { ...project, ...updates, updatedAt: now } : project)
    }));
  }

  function openModule(id: ModuleId) {
    setActive(id);
    setMobileNavOpen(false);
    if (id !== "overview") updateSelectedProject({ activeModule: id });
  }

  function addProject() {
    const project = createProject(projectName || `Project ${workbench.projects.length + 1}`);
    updateWorkbench((current) => ({ ...current, projects: [project, ...current.projects], selectedProjectId: project.id }));
    setProjectName("");
    setActive("manifest");
    setNotice(`Created “${project.name}”. Each project keeps its own manifest editor text.`);
  }

  function removeSelectedProject() {
    if (!selectedProject || workbench.projects.length < 2) {
      setNotice("Keep at least one project in the workbench.");
      return;
    }
    const remaining = workbench.projects.filter((project) => project.id !== selectedProject.id);
    updateWorkbench((current) => ({ ...current, projects: remaining, selectedProjectId: remaining[0]!.id }));
    setNotice("Project removed from this browser. Export first if you need to keep it.");
  }

  function exportWorkspace() {
    downloadText("devforge-workbench-export.json", exportWorkbenchState(workbench));
    setNotice("Workbench export prepared. Keep the JSON file somewhere safe.");
  }

  async function importWorkspace(file?: File) {
    if (!file) return;
    try {
      const source = await file.text();
      if (workbench.settings.confirmBeforeImport && !window.confirm("Import this DevForge backup? It will replace the projects, settings, and report history currently in this browser.")) return;
      const imported = parseWorkbenchImport(source);
      setWorkbench(imported);
      setManifestResult(inspectManifest(imported.projects.find((project) => project.id === imported.selectedProjectId)?.manifestSource ?? "{}"));
      setNotice(`Imported ${imported.projects.length} project(s) and ${imported.reports.length} report(s).`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed. The current workbench was not changed.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function runInspection() {
    const next = inspectManifest(manifestSource);
    setManifestResult(next);
    updateSelectedProject({ manifestSource });
    const report = makeReport({
      kind: "manifest",
      title: `Manifest Medic · ${typeof next.manifest?.name === "string" ? next.manifest.name : selectedProject?.name ?? "Untitled"}`,
      projectId: selectedProject?.id ?? null,
      summary: `${next.summary.errors} error(s), ${next.summary.warnings} warning(s), ${next.summary.info} info finding(s)`,
      payload: { summary: next.summary, findings: next.findings, manifestName: typeof next.manifest?.name === "string" ? next.manifest.name : null }
    });
    updateWorkbench((current) => ({
      ...current,
      reports: current.settings.keepReportHistory
        ? [report, ...current.reports].slice(0, current.settings.reportHistoryLimit)
        : current.reports
    }));
    setNotice("Inspection complete. Results and report history are stored locally.");
  }

  function exportManifestReport() {
    const report = {
      tool: "DevForge Manifest Medic",
      createdAt: new Date().toISOString(),
      project: selectedProject?.name ?? null,
      summary: manifestResult.summary,
      findings: manifestResult.findings,
      manifestName: typeof manifestResult.manifest?.name === "string" ? manifestResult.manifest.name : null
    };
    downloadText("devforge-manifest-report.json", JSON.stringify(report, null, 2));
    setNotice("Manifest report export started.");
  }

  const selected = modules.find((item) => item.id === active);
  const SelectedIcon = selected?.icon ?? CircleHelp;

  return (
    <div className={`app-shell ${workbench.settings.compactCards ? "compact-cards" : ""}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(event) => void importWorkspace(event.target.files?.[0])} />
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`} aria-label="Workbench navigation">
        <div className="brand"><div className="brand-mark"><Command size={21} strokeWidth={2.5} /></div><div><strong>devforge<span>.</span></strong><small>WORKBENCH / LOCAL</small></div><button className="icon-button mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <button className={`nav-item ${active === "overview" ? "active" : ""}`} onClick={() => openModule("overview")}><Layers3 size={17} /><span>Overview</span><span className="nav-shortcut">⌘ 1</span></button>
        <div className="workspace-label tools-label">TOOLKIT <span>06</span></div>
        {modules.map((item, index) => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`} onClick={() => openModule(item.id)}><Icon size={17} /><span>{item.title}</span>{item.status === "ready" ? <span className="ready-dot" /> : <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>}</button>; })}
        <div className="sidebar-spacer" />
        <div className="privacy-card"><div className="privacy-icon"><LockKeyhole size={16} /></div><div><strong>Local-first by design</strong><p>Projects, editor text, settings, and reports stay in this browser until you export them.</p></div></div>
        <a className="github-link" href="https://github.com/Vihaan-H/DevForge-Workbench" target="_blank" rel="noreferrer"><GitBranch size={16} /> View source <ArrowUpRight size={14} /></a>
        <div className="sidebar-footer"><span className="status-led" /> SYSTEM READY <span>v0.2.0</span></div>
      </aside>
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)} />}
      <main id="main-content" className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workbench</span><ChevronRight size={14} /><strong>{selected?.title ?? "Overview"}</strong></div>
          <div className="topbar-right"><span className="local-pill"><span /> LOCAL MODE</span><button className="icon-button" title="Import workbench JSON" aria-label="Import workbench JSON" onClick={() => fileInput.current?.click()}><Upload size={17} /></button><button className="icon-button" title="Export workbench JSON" aria-label="Export workbench JSON" onClick={exportWorkspace}><Download size={17} /></button><button className="icon-button" title="Settings" aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button></div>
        </header>

        {active === "inspector" ? <ExtensionInspector projectName={selectedProject?.name ?? "Untitled project"} onReport={(summary, payload) => {
          const report = makeReport({ kind: "inspector", title: `Extension Inspector · ${selectedProject?.name ?? "Untitled project"}`, projectId: selectedProject?.id ?? null, summary, payload });
          updateWorkbench((current) => ({ ...current, reports: current.settings.keepReportHistory ? [report, ...current.reports].slice(0, current.settings.reportHistoryLimit) : current.reports }));
        }} /> : active === "output" ? <OutputJudge projectName={selectedProject?.name ?? "Untitled project"} onReport={(summary, payload) => {
          const report = makeReport({ kind: "output", title: `OutputJudge · ${selectedProject?.name ?? "Untitled project"}`, projectId: selectedProject?.id ?? null, summary, payload });
          updateWorkbench((current) => ({ ...current, reports: current.settings.keepReportHistory ? [report, ...current.reports].slice(0, current.settings.reportHistoryLimit) : current.reports }));
        }} /> : active === "prompts" ? <PromptLab key={selectedProject?.id ?? "prompt"} projectId={selectedProject?.id ?? "default"} projectName={selectedProject?.name ?? "Untitled project"} onReport={(summary, payload) => { const report = makeReport({ kind: "prompt", title: `PromptLab · ${selectedProject?.name ?? "Untitled project"}`, projectId: selectedProject?.id ?? null, summary, payload }); updateWorkbench((current) => ({ ...current, reports: current.settings.keepReportHistory ? [report, ...current.reports].slice(0, current.settings.reportHistoryLimit) : current.reports })); }} /> : active === "regression" ? <RegressionLab key={selectedProject?.id ?? "regression"} projectId={selectedProject?.id ?? "default"} projectName={selectedProject?.name ?? "Untitled project"} onReport={(summary, payload) => { const report = makeReport({ kind: "regression", title: `RegressionLab · ${selectedProject?.name ?? "Untitled project"}`, projectId: selectedProject?.id ?? null, summary, payload }); updateWorkbench((current) => ({ ...current, reports: current.settings.keepReportHistory ? [report, ...current.reports].slice(0, current.settings.reportHistoryLimit) : current.reports })); }} /> : active === "chaos" ? <ChaosUI key={selectedProject?.id ?? "chaos"} projectId={selectedProject?.id ?? "default"} projectName={selectedProject?.name ?? "Untitled project"} onReport={(summary, payload) => { const report = makeReport({ kind: "chaos", title: `ChaosUI · ${selectedProject?.name ?? "Untitled project"}`, projectId: selectedProject?.id ?? null, summary, payload }); updateWorkbench((current) => ({ ...current, reports: current.settings.keepReportHistory ? [report, ...current.reports].slice(0, current.settings.reportHistoryLimit) : current.reports })); }} /> : active === "overview" ? <section className="page-content">
          <div className="hero-row"><div><div className="eyebrow"><span className="eyebrow-line" /> DEVELOPER TOOLING, WITHOUT THE CEREMONY</div><h1>Build it. Break it.<br /><span>Know why.</span></h1><p className="hero-copy">A focused workbench for testing interfaces, browser extensions, and AI outputs. Catch the silly bugs before they become very public silly bugs.</p><button className="primary-button" onClick={() => openModule("manifest")}><ShieldCheck size={17} /> Open Manifest Medic <ArrowUpRight size={15} /></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="core-cube"><Command size={38} /></div><span className="float-chip chip-a"><Braces size={14} /> JSON</span><span className="float-chip chip-b"><Activity size={14} /> QA</span><span className="float-chip chip-c"><TerminalSquare size={14} /> DEV</span></div></div>
          <div className="project-strip"><div className="project-strip-title"><FolderKanban size={17} /><div><strong>Active project</strong><small>Stored in this browser</small></div></div><select aria-label="Select active project" value={selectedProject?.id ?? ""} onChange={(event) => updateWorkbench((current) => ({ ...current, selectedProjectId: event.target.value }))}>{workbench.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><input aria-label="New project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="New project name" onKeyDown={(event) => { if (event.key === "Enter") addProject(); }} /><button className="secondary-button" onClick={addProject}><Plus size={15} /> New project</button><button className="icon-button danger-icon" title="Delete active project" aria-label="Delete active project" onClick={removeSelectedProject} disabled={workbench.projects.length < 2}><Trash2 size={16} /></button></div>
          <div className="section-heading"><div><span className="section-kicker">YOUR TOOLBELT</span><h2>Workbench modules</h2></div><div className="module-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find a tool..." aria-label="Filter modules" /></div></div>
          <div className="module-grid">{visibleModules.map((item) => { const Icon = item.icon; return <button key={item.id} className={`module-card ${item.status === "planned" ? "module-planned" : ""}`} onClick={() => openModule(item.id)}><div className="module-card-top"><div className="module-icon"><Icon size={19} /></div><span className={`module-status ${item.status}`}>{item.status === "ready" ? "AVAILABLE" : "PLANNED"}</span></div><span className="module-tag">{item.tag}</span><h3>{item.title}</h3><p>{item.description}</p><div className="module-card-bottom"><span>{item.status === "ready" ? "Launch tool" : "In the build queue"}</span><ArrowUpRight size={16} /></div></button>; })}{visibleModules.length === 0 && <div className="empty-search">No tools match that search. Search has standards. Respect them.</div>}</div>
          <div className="section-heading report-section-heading"><div><span className="section-kicker">LOCAL HISTORY</span><h2>Recent reports</h2></div><span className="report-count">{workbench.reports.length} saved</span></div>
          {workbench.reports.length ? <div className="report-grid">{workbench.reports.slice(0, 4).map((report) => <article className="report-card" key={report.id}><div className="report-card-top"><span className="report-type">{report.kind.toUpperCase()}</span><span className="report-date">{formatDate(report.createdAt)}</span></div><strong>{report.title}</strong><p>{report.summary}</p><button className="text-action" onClick={() => downloadText(`devforge-${report.kind}-report.json`, JSON.stringify(report, null, 2))}><ArrowDownToLine size={14} /> Export report</button></article>)}</div> : <div className="empty-reports"><Activity size={17} /><div><strong>No reports yet</strong><p>Run Manifest Medic to create the first local report. Reports are data, not decorative dashboard confetti.</p></div></div>}
          <div className="bottom-grid"><div className="activity-panel"><div className="panel-heading"><div><span className="section-kicker">BUILD STATUS</span><h3>Project heartbeat</h3></div><span className="live-label"><span /> LOCAL</span></div><div className="heartbeat-row"><div className="heartbeat-icon"><CheckCircle2 size={18} /></div><div><strong>Core shell and local projects</strong><p>Project selection, browser persistence, import/export</p></div><span className="done-tag">DONE</span></div><div className="heartbeat-row"><div className="heartbeat-icon"><CheckCircle2 size={18} /></div><div><strong>Manifest Medic engine</strong><p>Static rules, suggested fixes, deterministic findings</p></div><span className="done-tag">DONE</span></div><div className="heartbeat-row"><div className="heartbeat-icon muted"><Sparkles size={18} /></div><div><strong>Three remaining tools</strong><p>PromptLab, RegressionLab and ChaosUI remain queued</p></div><span className="queued-tag">QUEUED</span></div></div><div className="principles-panel"><div className="principle-symbol"><LockKeyhole size={20} /></div><span className="section-kicker">PROJECT PRINCIPLES</span><h3>Private by default.</h3><p>Inspect locally. Export deliberately. Never execute untrusted project files just to inspect them.</p><div className="principle-rule" /><div className="principle-meta"><span>NO API KEYS</span><span>NO BACKEND</span><span>YOUR FILES</span></div></div></div>
          <footer className="page-footer"><span>DEVFORGE WORKBENCH <span className="footer-dot">/</span> PHASES 01–07</span><span>Made for people who read the error message.</span></footer>
        </section> : active === "manifest" ? <section className="page-content tool-page">
          <div className="eyebrow"><span className="eyebrow-line" /> EXTENSION TOOLING / 01</div><h1 className="tool-title">Manifest <span>Medic.</span></h1><p className="tool-intro">Static checks for Chromium extension manifests. Paste JSON, inspect diagnostics and export a report. Nothing is uploaded.</p>
          <div className="tool-toolbar"><div className="tool-toolbar-label"><Braces size={16} /><strong>manifest.json</strong><span>{selectedProject?.name ?? "NO PROJECT"}</span></div><div className="toolbar-actions"><button className="secondary-button" onClick={() => { updateSelectedProject({ manifestSource: createDefaultState().projects[0]!.manifestSource }); setManifestResult(inspectManifest(createDefaultState().projects[0]!.manifestSource)); setNotice("Starter manifest restored for this project."); }}><Activity size={15} /> Reset sample</button><button className="primary-button compact" onClick={runInspection}><ShieldCheck size={16} /> Run checks</button></div></div>
          <div className="manifest-workspace"><div className="editor-panel"><div className="editor-top"><span><span className="editor-dot" /> SOURCE EDITOR</span><span>JSON</span></div><textarea spellCheck={false} aria-label="Manifest JSON source" value={manifestSource} onChange={(event) => updateSelectedProject({ manifestSource: event.target.value })} /><div className="editor-footer"><span>Autosaved locally</span><span>{manifestSource.split("\n").length} lines</span></div></div><div className="results-panel"><div className="results-header"><div><span className="section-kicker">DIAGNOSTICS</span><h2>Inspection results</h2></div><button className="icon-button" onClick={exportManifestReport} title="Export report"><ArrowUpRight size={17} /></button></div><div className="score-grid"><div><strong className={manifestResult.summary.errors ? "count-error" : ""}>{manifestResult.summary.errors}</strong><span>ERRORS</span></div><div><strong className={manifestResult.summary.warnings ? "count-warning" : ""}>{manifestResult.summary.warnings}</strong><span>WARNINGS</span></div><div><strong>{manifestResult.summary.info}</strong><span>INFO</span></div></div><div className="finding-list">{manifestResult.findings.map((finding) => <article className={`finding finding-${finding.severity}`} key={finding.id}><div className="finding-symbol">{finding.severity === "error" ? "!" : finding.severity === "warning" ? "△" : "i"}</div><div><div className="finding-title-row"><strong>{finding.title}</strong><span>{finding.severity.toUpperCase()}</span></div><p>{finding.detail}</p>{finding.path && <code>{finding.path}</code>}{finding.suggestion && <p className="finding-suggestion"><strong>Suggested fix:</strong> {finding.suggestion}</p>}</div></article>)}</div><button className="secondary-button export-button" onClick={exportManifestReport}><ArrowUpRight size={15} /> Export JSON report</button></div></div>
          <div className="disclaimer"><CircleHelp size={16} /><p><strong>Keep expectations calibrated.</strong> These static rules are a useful baseline, not a complete Chrome Web Store review. File existence checks and WebCRX/CRX Emulator compatibility need real-world testing.</p></div>
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={14} /></button></div>}
          <footer className="page-footer"><span>MANIFEST MEDIC <span className="footer-dot">/</span> LOCAL ENGINE</span><span>Input is not sent to a server.</span></footer>
        </section> : <section className="page-content planned-page"><div className="eyebrow"><span className="eyebrow-line" /> WORKBENCH MODULE</div><div className="planned-icon"><SelectedIcon size={28} /></div><h1 className="tool-title">{selected?.title ?? "Module"}<span>.</span></h1><p className="tool-intro">{selected?.description}</p><div className="planned-card"><div className="planned-card-icon"><Sparkles size={21} /></div><div><span className="module-status planned">PLANNED</span><h2>This module is not implemented yet.</h2><p>Phase 01 establishes navigation and project storage; it does not pretend the remaining modules are finished. This tool will become usable in its own implementation phase.</p><button className="primary-button" onClick={() => openModule("manifest")}><ShieldCheck size={16} /> Use Manifest Medic <ArrowUpRight size={15} /></button></div></div><footer className="page-footer"><span>DEVFORGE WORKBENCH <span className="footer-dot">/</span> PHASES 01 + 02</span><span>Small reliable steps beat six pretend tools.</span></footer></section>}
      </main>
      {notice && active === "overview" && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={14} /></button></div>}
      {settingsOpen && <div className="settings-scrim" role="presentation" onClick={() => setSettingsOpen(false)}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}><div className="settings-heading"><div><span className="section-kicker">WORKBENCH CONFIGURATION</span><h2 id="settings-title">Settings</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={18} /></button></div><label className="setting-row"><span><strong>Confirm before import</strong><small>Ask before replacing local projects and reports.</small></span><input type="checkbox" checked={workbench.settings.confirmBeforeImport} onChange={(event) => updateWorkbench((current) => ({ ...current, settings: { ...current.settings, confirmBeforeImport: event.target.checked } }))} /></label><label className="setting-row"><span><strong>Keep report history</strong><small>Store recent inspection reports in this browser.</small></span><input type="checkbox" checked={workbench.settings.keepReportHistory} onChange={(event) => updateWorkbench((current) => ({ ...current, settings: { ...current.settings, keepReportHistory: event.target.checked }, reports: event.target.checked ? current.reports : [] }))} /></label><label className="setting-row"><span><strong>Compact report cards</strong><small>Reduce spacing on the dashboard.</small></span><input type="checkbox" checked={workbench.settings.compactCards} onChange={(event) => updateWorkbench((current) => ({ ...current, settings: { ...current.settings, compactCards: event.target.checked } }))} /></label><label className="setting-row limit-setting"><span><strong>Maximum report history</strong><small>Keep between 1 and 250 reports when history is enabled.</small></span><input type="number" min="1" max="250" value={workbench.settings.reportHistoryLimit} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 1 && value <= 250) updateWorkbench((current) => ({ ...current, settings: { ...current.settings, reportHistoryLimit: Math.floor(value) }, reports: current.reports.slice(0, Math.floor(value)) })); }} /></label><div className="settings-actions"><button className="secondary-button" onClick={() => updateWorkbench((current) => ({ ...current, reports: [] }))}>Clear report history</button><button className="primary-button" onClick={() => { setSettingsOpen(false); setNotice("Settings saved locally."); }}>Done</button></div><p className="settings-footnote">Settings and projects are stored in this browser's local storage. Use Export before clearing browser data.</p></section></div>}
    </div>
  );
}
