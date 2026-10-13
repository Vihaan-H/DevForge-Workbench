export type FindingSeverity = "error" | "warning" | "info";

export interface ManifestFinding {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  path?: string;
  suggestion?: string;
}

export interface ManifestCheckResult {
  validJson: boolean;
  manifest: Record<string, unknown> | null;
  findings: ManifestFinding[];
  summary: { errors: number; warnings: number; info: number };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const add = (findings: ManifestFinding[], finding: ManifestFinding) => findings.push(finding);

/** Static inspection only. Imported extension scripts are never executed. */
export function inspectManifest(source: string): ManifestCheckResult {
  const findings: ManifestFinding[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    add(findings, { id: "json-parse", severity: "error", title: "Invalid JSON", detail: error instanceof Error ? error.message : "The manifest could not be parsed as JSON.", suggestion: "Fix the JSON syntax, then run checks again." });
    return { validJson: false, manifest: null, findings, summary: { errors: 1, warnings: 0, info: 0 } };
  }
  if (!isRecord(parsed)) {
    add(findings, { id: "root-object", severity: "error", title: "Manifest must be an object", detail: "The top-level JSON value must be an object, not an array or primitive.", suggestion: "Use a JSON object with named manifest fields." });
    return { validJson: true, manifest: null, findings, summary: { errors: 1, warnings: 0, info: 0 } };
  }

  const manifest = parsed;
  const version = manifest.manifest_version;
  if (version !== 3) add(findings, { id: "manifest-version", severity: "error", title: "Manifest V3 required for this baseline", detail: version === 2 ? "Manifest V2 is deprecated in modern Chromium; support differs across browsers." : "Set manifest_version to 3 for the modern Chromium baseline.", path: "manifest_version", suggestion: "Set manifest_version to the number 3, not the string \"3\"." });
  else add(findings, { id: "manifest-version-ok", severity: "info", title: "Manifest V3 detected", detail: "The manifest declares version 3.", path: "manifest_version" });

  for (const key of ["name", "version", "description"]) {
    if (typeof manifest[key] !== "string" || !(manifest[key] as string).trim()) {
      const severity = key === "description" ? "warning" : "error";
      add(findings, { id: `missing-${key}`, severity, title: `Missing or invalid ${key}`, detail: `Provide a non-empty string for "${key}".`, path: key, suggestion: `Add a non-empty string value for ${key}.` });
    }
  }
  if (typeof manifest.version === "string" && !/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
    add(findings, { id: "version-format", severity: "warning", title: "Unusual version format", detail: "Extension versions use one to four dot-separated numeric components.", path: "version", suggestion: "Try a version such as 1.0.0 or 2.4.1.0." });
  }
  if (typeof manifest.name === "string" && manifest.name.length > 75) {
    add(findings, { id: "name-length", severity: "warning", title: "Long extension name", detail: "The extension name is longer than the commonly displayed 75-character limit.", path: "name", suggestion: "Shorten the name or check the target store's current limits." });
  }

  for (const key of ["permissions", "optional_permissions", "host_permissions", "optional_host_permissions"] as const) {
    if (manifest[key] !== undefined && !Array.isArray(manifest[key])) {
      add(findings, { id: `array-type-${key}`, severity: "error", title: `Invalid ${key}`, detail: `${key} must be an array of strings.`, path: key, suggestion: `Change ${key} to an array, for example [].` });
    } else if (Array.isArray(manifest[key]) && (manifest[key] as unknown[]).some((item) => typeof item !== "string")) {
      add(findings, { id: `array-item-type-${key}`, severity: "error", title: `Invalid item in ${key}`, detail: `Every ${key} entry must be a string.`, path: key, suggestion: "Remove non-string entries and use documented permission or host-pattern names." });
    }
  }

  const permissions = stringList(manifest.permissions);
  const hostPermissions = stringList(manifest.host_permissions);
  const optionalHostPermissions = stringList(manifest.optional_host_permissions);
  const riskyPermissions = new Set(["debugger", "management", "nativeMessaging", "proxy", "webRequestBlocking", "history", "downloads"]);
  for (const permission of permissions) {
    if (riskyPermissions.has(permission)) add(findings, { id: `permission-${permission}`, severity: "warning", title: `Review permission: ${permission}`, detail: "This permission can expose sensitive browser capabilities. Confirm that the feature genuinely requires it.", path: "permissions", suggestion: "Remove the permission if the extension does not need it; otherwise explain its purpose in your documentation." });
  }
  for (const key of ["permissions", "optional_permissions"] as const) {
    const values = stringList(manifest[key]);
    const duplicates = values.filter((item, index) => values.indexOf(item) !== index);
    for (const permission of [...new Set(duplicates)]) add(findings, { id: `duplicate-${key}-${permission}`, severity: "warning", title: `Duplicate permission: ${permission}`, detail: `The value appears more than once in ${key}.`, path: key, suggestion: "Keep each permission only once." });
  }
  if ([...hostPermissions, ...optionalHostPermissions].some((host) => host === "<all_urls>" || host === "http://*/*" || host === "https://*/*")) {
    add(findings, { id: "broad-host-permission", severity: "warning", title: "Broad host access", detail: "This extension requests access across many sites. Prefer the narrowest host patterns that support its features.", path: "host_permissions", suggestion: "Restrict access to the domains and URL schemes the feature actually uses." });
  }

  const action = isRecord(manifest.action) ? manifest.action : null;
  if (manifest.action !== undefined && !action) add(findings, { id: "action-type", severity: "error", title: "Invalid action configuration", detail: "action must be an object.", path: "action", suggestion: "Use an object such as { \"default_title\": \"Open\" }." });
  if (action && action.default_popup !== undefined && (typeof action.default_popup !== "string" || !action.default_popup.trim())) add(findings, { id: "popup-type", severity: "error", title: "Invalid popup path", detail: "action.default_popup must be a non-empty string path.", path: "action.default_popup", suggestion: "Point to an existing HTML file in the extension package." });
  if (action && action.default_icon !== undefined && typeof action.default_icon !== "string" && !isRecord(action.default_icon)) add(findings, { id: "action-icon-type", severity: "error", title: "Invalid action icon", detail: "action.default_icon must be a path string or a size-to-path object.", path: "action.default_icon", suggestion: "Use a relative image path or an object keyed by icon sizes." });

  const background = isRecord(manifest.background) ? manifest.background : null;
  if (manifest.background !== undefined && !background) add(findings, { id: "background-type", severity: "error", title: "Invalid background configuration", detail: "background must be an object.", path: "background", suggestion: "Use an object with service_worker and/or supported background options." });
  if (background && background.service_worker !== undefined && (typeof background.service_worker !== "string" || !background.service_worker.trim())) add(findings, { id: "service-worker-type", severity: "error", title: "Invalid service worker path", detail: "background.service_worker must be a non-empty string path.", path: "background.service_worker", suggestion: "Use the relative path to the service worker file included in the package." });
  if (background && background.service_worker && background.scripts !== undefined) add(findings, { id: "mv3-background-scripts", severity: "error", title: "Manifest V3 background conflict", detail: "Manifest V3 uses a service worker instead of the Manifest V2 background scripts array.", path: "background.scripts", suggestion: "Replace background.scripts with a service_worker entry and migrate the code to service-worker constraints." });

  if (manifest.content_scripts !== undefined && !Array.isArray(manifest.content_scripts)) {
    add(findings, { id: "content-scripts-type", severity: "error", title: "Invalid content_scripts", detail: "content_scripts must be an array.", path: "content_scripts", suggestion: "Use an array of content script configuration objects." });
  }
  const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  contentScripts.forEach((entry, index) => {
    const path = `content_scripts[${index}]`;
    if (!isRecord(entry)) {
      add(findings, { id: `content-script-${index}`, severity: "error", title: "Invalid content script entry", detail: "Each content_scripts item must be an object.", path, suggestion: "Replace this entry with an object containing matches and js or css." });
      return;
    }
    if (stringList(entry.matches).length === 0) add(findings, { id: `content-script-matches-${index}`, severity: "error", title: "Content script has no matches", detail: "Provide at least one string match pattern.", path: `${path}.matches`, suggestion: "Add a documented match pattern for pages where this script should run." });
    if (entry.matches !== undefined && !Array.isArray(entry.matches)) add(findings, { id: `content-script-matches-type-${index}`, severity: "error", title: "Invalid matches field", detail: "matches must be an array of strings.", path: `${path}.matches`, suggestion: "Use an array such as [\"https://example.com/*\"]." });
    for (const key of ["js", "css"] as const) {
      if (entry[key] !== undefined && (!Array.isArray(entry[key]) || (entry[key] as unknown[]).some((item) => typeof item !== "string"))) add(findings, { id: `content-script-${key}-type-${index}`, severity: "error", title: `Invalid ${key} file list`, detail: `${key} must be an array of strings.`, path: `${path}.${key}`, suggestion: "Use an array of relative file paths." });
    }
    if (stringList(entry.js).length === 0 && stringList(entry.css).length === 0) add(findings, { id: `content-script-files-${index}`, severity: "warning", title: "Content script has no files", detail: "Add at least one JavaScript or CSS file, or remove this entry.", path, suggestion: "Add js or css paths that exist in the extension package." });
    if (entry.run_at !== undefined && !["document_start", "document_end", "document_idle"].includes(String(entry.run_at))) add(findings, { id: `content-script-run-at-${index}`, severity: "warning", title: "Unusual run_at value", detail: "The run_at value is not one of the standard content-script timing options.", path: `${path}.run_at`, suggestion: "Use document_start, document_end, or document_idle." });
  });

  if (manifest.content_security_policy !== undefined) {
    const csp = isRecord(manifest.content_security_policy) ? manifest.content_security_policy.extension_pages : manifest.content_security_policy;
    if (typeof csp === "string" && /unsafe-eval/i.test(csp)) add(findings, { id: "csp-unsafe-eval", severity: "warning", title: "Review unsafe-eval in CSP", detail: "unsafe-eval is generally not permitted for extension pages under Chromium's extension CSP.", path: "content_security_policy", suggestion: "Remove unsafe-eval and use a CSP-compatible implementation." });
    else if (manifest.manifest_version === 3 && typeof manifest.content_security_policy === "string") add(findings, { id: "csp-mv3-shape", severity: "warning", title: "Review Manifest V3 CSP shape", detail: "Manifest V3 uses an object with an extension_pages policy rather than a string policy.", path: "content_security_policy", suggestion: "Use { \"extension_pages\": \"script-src 'self'; object-src 'self'\" } as a starting shape." });
  }

  if (!manifest.action && !manifest.browser_action) add(findings, { id: "no-action", severity: "info", title: "No toolbar action declared", detail: "This is valid if the extension does not need a toolbar button." });
  if (findings.length === 0) add(findings, { id: "clean", severity: "info", title: "No baseline issues found", detail: "No issues were detected by the current static rules. This is not a full Chrome Web Store review." });

  const summary = findings.reduce((counts, finding) => {
    if (finding.severity === "error") counts.errors += 1;
    else if (finding.severity === "warning") counts.warnings += 1;
    else counts.info += 1;
    return counts;
  }, { errors: 0, warnings: 0, info: 0 });
  return { validJson: true, manifest, findings, summary };
}
