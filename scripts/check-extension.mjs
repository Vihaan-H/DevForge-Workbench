import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = join(root, "browser-extension");
const read = (name) => readFileSync(join(extensionDir, name), "utf8");
const manifest = JSON.parse(read("manifest.json"));

assert.equal(manifest.manifest_version, 3, "The companion must use Manifest V3.");
assert.equal(typeof manifest.name, "string", "Manifest name is required.");
assert.equal(typeof manifest.version, "string", "Manifest version is required.");
assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "scripting"], "Keep permissions least-privilege and user-gesture scoped.");
assert.equal("host_permissions" in manifest, false, "Do not add persistent host permissions.");
assert.equal("content_scripts" in manifest, false, "Do not add persistent content scripts.");
assert.equal("background" in manifest, false, "No background service worker is needed for this click-triggered tool.");
assert.equal(manifest.action?.default_popup, "popup.html", "Manifest popup must point to popup.html.");
assert.ok(existsSync(join(extensionDir, manifest.action.default_popup)), "The popup file must exist.");
assert.ok(manifest.content_security_policy?.extension_pages?.includes("script-src 'self'"), "Use a self-only extension-page script policy.");

const html = read("popup.html");
const css = read("popup.css");
const js = read("popup.js");
assert.match(html, /<html\s+lang=["']en["']/i, "Popup HTML must declare its language.");
assert.match(html, /id=["']inspect["']/i, "Popup must expose an explicit inspection button.");
assert.match(html, /id=["']status["'][^>]*aria-live=["']polite["']/i, "Popup must announce status changes.");
assert.match(html, /<script\s+src=["']popup\.js["'][^>]*defer/i, "Use a deferred external popup script.");
assert.doesNotMatch(html, /<script\s*>/i, "Inline JavaScript is not allowed in the popup.");
assert.match(html, /rel=["']stylesheet["'][^>]*href=["']popup\.css["']/i, "Popup stylesheet must be a local file.");
assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i, "Popup must not load remote assets.");
assert.match(js, /inspectButton\.addEventListener\(["']click["']/i, "Inspection must require an explicit click.");
assert.match(js, /chrome\.scripting\.executeScript/i, "Inspection must use Chromium's supported scripting API.");
assert.match(js, /document\.createElement\(["']a["']\)/i, "JSON export should be performed by a local download link.");
assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|WebSocket\s*\(/i, "The companion must not send page data over the network.");
assert.doesNotMatch(css, /url\s*\(\s*["']?https?:/i, "Popup CSS must not load remote resources.");
for (const file of ["popup.html", "popup.css", "popup.js", "manifest.json"]) {
  assert.ok(existsSync(join(extensionDir, file)), `Missing extension file: ${file}`);
}
execFileSync(process.execPath, ["--check", join(extensionDir, "popup.js")], { stdio: "inherit" });
console.log("Companion extension checks passed: MV3, local resources, explicit-click flow, minimum permissions, popup syntax.");
