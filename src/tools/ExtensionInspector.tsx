import { useRef, useState } from "react";
import { Archive, ArrowDownToLine, FileSearch, ShieldAlert, Upload } from "lucide-react";
import { unzipSync, zipSync, strFromU8 } from "fflate";

type Finding = { severity: "error" | "warning" | "info"; title: string; detail: string; path?: string };
type Props = { projectName: string; onReport: (summary: string, payload: unknown) => void };
type ArchiveFile = { path: string; bytes: Uint8Array };

const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const cleanPath = (path: string) => path.replace(/\\/g, "/").replace(/^\.\//, "");

function inspectFiles(files: ArchiveFile[]) {
  const findings: Finding[] = [];
  const byPath = new Map(files.map((file) => [cleanPath(file.path), file]));
  const manifestFile = byPath.get("manifest.json");
  if (!manifestFile) {
    findings.push({ severity: "error", title: "manifest.json not found", detail: "The archive root must contain manifest.json for this inspector's baseline checks." });
    return { findings, manifest: null as Record<string, unknown> | null, fileCount: files.length, missing: [] as string[] };
  }

  let manifest: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(strFromU8(manifestFile.bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The JSON root is not an object.");
    manifest = parsed as Record<string, unknown>;
  } catch (error) {
    findings.push({ severity: "error", title: "Manifest cannot be parsed", detail: error instanceof Error ? error.message : "Invalid manifest JSON.", path: "manifest.json" });
    return { findings, manifest, fileCount: files.length, missing: [] as string[] };
  }

  const references: string[] = [];
  const addRef = (value: unknown) => {
    if (typeof value === "string" && value.trim()) references.push(cleanPath(value.trim()));
  };
  const addIconRefs = (value: unknown) => {
    if (typeof value === "string") addRef(value);
    else if (value && typeof value === "object" && !Array.isArray(value)) Object.values(value).forEach(addRef);
  };
  const action = manifest.action && typeof manifest.action === "object" ? manifest.action as Record<string, unknown> : null;
  const background = manifest.background && typeof manifest.background === "object" ? manifest.background as Record<string, unknown> : null;
  addRef(action?.default_popup);
  addIconRefs(action?.default_icon);
  addIconRefs(manifest.icons);
  addRef(background?.service_worker);
  const scripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  scripts.forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
    const record = entry as Record<string, unknown>;
    if (Array.isArray(record.js)) record.js.forEach(addRef);
    if (Array.isArray(record.css)) record.css.forEach(addRef);
  });
  const missing = [...new Set(references.filter((path) => !byPath.has(path)))];
  missing.forEach((path) => findings.push({ severity: "error", title: "Referenced file missing", detail: "The manifest references a file that is not present in this archive.", path }));
  if (!manifest.icons || typeof manifest.icons !== "object") findings.push({ severity: "warning", title: "No extension icons declared", detail: "Declare suitable icon sizes if the extension UI or store listing needs them.", path: "icons" });
  if (manifest.manifest_version !== 3) findings.push({ severity: "warning", title: "Manifest V3 not detected", detail: "This inspector's baseline targets modern Chromium Manifest V3.", path: "manifest_version" });
  if (!Array.isArray(manifest.permissions) && manifest.permissions !== undefined) findings.push({ severity: "error", title: "permissions is not an array", detail: "The permissions field must be an array of strings.", path: "permissions" });
  if (files.some((file) => /(^|\/)\.env(?:\.|$)|private.?key|id_rsa/i.test(file.path))) findings.push({ severity: "warning", title: "Potential secret or private file", detail: "Review this archive for credentials or private material before sharing it." });
  if (!findings.length) findings.push({ severity: "info", title: "No baseline archive issues found", detail: "Referenced paths were present and the manifest could be parsed. This is not a full security review." });
  return { findings, manifest, fileCount: files.length, missing };
}

export default function ExtensionInspector({ projectName, onReport }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [manifestName, setManifestName] = useState("");
  const [status, setStatus] = useState("Choose a .zip extension package to inspect it locally.");
  const [busy, setBusy] = useState(false);

  async function inspect(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_ARCHIVE_BYTES) throw new Error("Archive is larger than 20 MB. Use a smaller package.");
      if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Choose a ZIP archive. CRX files are not unpacked or executed.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const unzipped = unzipSync(bytes);
      const nextFiles: ArchiveFile[] = Object.entries(unzipped)
        .filter(([path, value]) => !path.endsWith("/") && value.length > 0 && !path.startsWith("__MACOSX/"))
        .map(([path, value]) => ({ path: cleanPath(path), bytes: value }));
      if (nextFiles.length > 1000) throw new Error("Archive contains more than 1,000 files. Refusing to load an unexpectedly large package.");
      const total = nextFiles.reduce((sum, entry) => sum + entry.bytes.length, 0);
      if (total > MAX_ARCHIVE_BYTES * 3) throw new Error("Unpacked content exceeds the 60 MB safety limit.");
      const result = inspectFiles(nextFiles);
      setFiles(nextFiles);
      setFindings(result.findings);
      setManifestName(typeof result.manifest?.name === "string" ? result.manifest.name : "");
      setStatus(`Inspected ${nextFiles.length} files from ${file.name}. Nothing was executed.`);
      onReport(`${result.findings.filter((item) => item.severity === "error").length} error(s), ${result.findings.filter((item) => item.severity === "warning").length} warning(s), ${result.findings.filter((item) => item.severity === "info").length} info finding(s)`, { archive: file.name, fileCount: result.fileCount, manifestName: result.manifest?.name ?? null, findings: result.findings, missingReferences: result.missing });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not inspect this archive.");
      setFiles([]);
      setFindings([{ severity: "error", title: "Archive inspection failed", detail: error instanceof Error ? error.message : "Unknown archive error." }]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function downloadPackage() {
    if (!files.length) return;
    const output: Record<string, Uint8Array> = {};
    files.forEach((file) => { output[file.path] = file.bytes; });
    const zipped = zipSync(output, { level: 6 });
    const url = URL.createObjectURL(new Blob([zipped], { type: "application/zip" }));
    const link = document.createElement("a");
    link.href = url; link.download = "devforge-inspected-extension.zip"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadReport() {
    const payload = { tool: "Extension Inspector", createdAt: new Date().toISOString(), project: projectName, extension: manifestName || null, fileCount: files.length, findings };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "devforge-extension-inspector-report.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="page-content tool-page">
    <div className="eyebrow"><span className="eyebrow-line" /> EXTENSION TOOLING / 03</div>
    <h1 className="tool-title">Extension <span>Inspector.</span></h1>
    <p className="tool-intro">Inspect a ZIP package's manifest, referenced scripts, styles, popup and icons. Files are read as data only. No extension scripts are executed and no archive is uploaded.</p>
    <div className="tool-toolbar"><div className="tool-toolbar-label"><FileSearch size={16} /><strong>PACKAGE INSPECTION</strong><span>{projectName}</span></div><div className="toolbar-actions"><input ref={input} type="file" accept=".zip,application/zip" hidden onChange={(event) => void inspect(event.target.files?.[0])} /><button className="primary-button compact" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} /> {busy ? "Inspecting..." : "Choose ZIP"}</button></div></div>
    <div className="inspector-layout">
      <div className="editor-panel inspector-files"><div className="editor-top"><span><span className="editor-dot" /> PACKAGE FILES</span><span>{files.length} FILES</span></div>
        {files.length ? <div className="archive-file-list">{files.map((file) => <div className="archive-file" key={file.path}><span>{file.path}</span><small>{file.bytes.length.toLocaleString()} B</small></div>)}</div> : <div className="inspector-empty"><Archive size={25} /><strong>Nothing loaded yet</strong><p>{status}</p></div>}
        <div className="editor-footer"><span>{status}</span><span>MAX 20 MB ZIP</span></div>
      </div>
      <div className="results-panel"><div className="results-header"><div><span className="section-kicker">DIAGNOSTICS</span><h2>{manifestName || "Package results"}</h2></div><button className="icon-button" disabled={!findings.length} onClick={downloadReport} title="Export report"><ArrowDownToLine size={16} /></button></div>
        <div className="score-grid"><div><strong className={findings.some((item) => item.severity === "error") ? "count-error" : ""}>{findings.filter((item) => item.severity === "error").length}</strong><span>ERRORS</span></div><div><strong className={findings.some((item) => item.severity === "warning") ? "count-warning" : ""}>{findings.filter((item) => item.severity === "warning").length}</strong><span>WARNINGS</span></div><div><strong>{findings.filter((item) => item.severity === "info").length}</strong><span>INFO</span></div></div>
        <div className="finding-list">{findings.map((item, index) => <article className={`finding finding-${item.severity}`} key={item.title + index}><div className="finding-symbol">{item.severity === "error" ? "!" : item.severity === "warning" ? "△" : "i"}</div><div><div className="finding-title-row"><strong>{item.title}</strong><span>{item.severity.toUpperCase()}</span></div><p>{item.detail}</p>{item.path && <code>{item.path}</code>}</div></article>)}</div>
        <button className="secondary-button export-button" disabled={!files.length} onClick={downloadPackage}><ArrowDownToLine size={15} /> Export ZIP copy</button>
        <div className="inspector-status"><ShieldAlert size={15} /><span>{status}</span></div>
      </div>
    </div>
    <div className="disclaimer"><ShieldAlert size={16} /><p><strong>Safe by default.</strong> Inspection checks file references and a few manifest basics. It does not prove code is safe, verify every icon format, or guarantee store approval. Never run unknown extension code just because a report looks clean.</p></div>
  </section>;
}
