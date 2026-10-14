import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const html = read("index.html");
const app = read("src/App.tsx");
const css = read("src/styles.css");
const chaos = read("src/core/chaosUI.ts");
const extensionManifest = JSON.parse(read("browser-extension/manifest.json"));
const readme = read("README.md");

assert.match(html, /<html\s+lang=["']en["']/i, "The app document must declare English.");
assert.match(html, /name=["']viewport["']/i, "The app document must declare responsive viewport behavior.");
assert.match(html, /name=["']description["']/i, "The app document needs a description.");
assert.match(html, /name=["']referrer["']\s+content=["']no-referrer["']/i, "Avoid sending the app URL as a referrer.");
assert.match(html, /<title>DevForge Workbench<\/title>/i, "The document title must be meaningful.");

assert.match(app, /className=["']skip-link["']\s+href=["']#main-content["']/i, "Provide a keyboard-accessible skip link.");
assert.match(app, /<main\s+id=["']main-content["']/i, "The skip link target must exist.");
assert.match(app, /aria-label=["']Workbench navigation["']/i, "The sidebar must have an accessible landmark name.");
for (const moduleName of ["Manifest Medic", "Extension Inspector", "OutputJudge", "PromptLab", "RegressionLab", "ChaosUI"]) {
  assert.ok(app.includes(moduleName), "Missing expected workbench tool: " + moduleName);
}
for (const importName of ["ExtensionInspector", "OutputJudge", "PromptLab", "RegressionLab", "ChaosUI"]) {
  assert.ok(app.includes('import ' + importName + ' from "./tools/' + importName + '"'), "Tool is not integrated: " + importName);
}

assert.doesNotMatch(css, /@import\s+url\(\s*["']?https?:\/\//i, "Avoid third-party stylesheet imports.");
assert.doesNotMatch(css, /fonts\.googleapis\.com/i, "Avoid third-party font requests.");
assert.match(css, /:focus-visible/, "Keyboard focus needs a visible treatment.");
assert.match(css, /prefers-reduced-motion\s*:\s*reduce/i, "Respect the operating system reduced-motion preference.");
assert.match(css, /\.skip-link:focus/, "The skip link must become visible when focused.");
assert.match(chaos, /sanitizeChaosMarkup/, "ChaosUI must keep the preview sanitization path.");

assert.equal(extensionManifest.manifest_version, 3, "The companion must be Manifest V3.");
assert.deepEqual([...extensionManifest.permissions].sort(), ["activeTab", "scripting"], "The companion must remain least-privilege.");
assert.equal("host_permissions" in extensionManifest, false, "No persistent host permission is allowed.");
assert.match(readme, /Phase 09: Release hardening/i, "Document automated checks and outstanding manual QA.");
console.log("Release checks passed: app metadata, skip navigation, focus/reduced-motion styling, no remote font imports, tool integration, and companion permission baseline.");
