export type FindingSeverity = "error" | "warning" | "info";

export interface ManifestFinding {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  path?: string;
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

/** Static manifest inspection only. It never executes uploaded extension code. */
export function inspectManifest(source: string): ManifestCheckResult {
  const findings: ManifestFinding[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch (error) {
    findings.push({
      id: "json-parse",
      severity: "error",
      title: "Invalid JSON",
      detail: error instanceof Error ? error.message : "The manifest could not be parsed as JSON."
    });
    return { validJson: false, manifest: null, findings, summary: { errors: 1, warnings: 0, info: 0 } };
  }

  if (!isRecord(parsed)) {
    findings.push({ id: "root-object", severity: "error", title: "Manifest must be an object", detail: "The top-level JSON value must be an object, not an array or primitive." });
    return { validJson: true, manifest: null, findings, summary: { errors: 1, warnings: 0, info: 0 } };
  }

  const manifest = parsed;
  const manifestVersion = manifest.manifest_version;
  if (manifestVersion !== 3) {
    findings.push({
      id: "manifest-version",
      severity: "error",
      title: "Manifest V3 required for this baseline",
      detail: manifestVersion === 2
        ? "Manifest V2 is deprecated in modern Chromium. Review current platform support before shipping."
        : "Set manifest_version to 3 for the modern Chromium extension baseline.",
      path: "manifest_version"
    });
  } else {
    findings.push({ id: "manifest-version-ok", severity: "info", title: "Manifest V3 detected", detail: "The manifest declares version 3.", path: "manifest_version" });
  }

  for (const key of ["name", "version", "description"]) {
    if (typeof manifest[key] !== "string" || !(manifest[key] as string).trim()) {
      const severity = key === "description" ? "warning" : "error";
      findings.push({ id: `missing-${key}`, severity, title: `Missing or invalid ${key}`, detail: `Provide a non-empty string for "${key}".`, path: key });
    }
  }

  if (typeof manifest.version === "string" && !/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
    findings.push({ id: "version-format", severity: "warning", title: "Unusual version format", detail: "Chromium extension versions usually use one to four dot-separated numeric components.", path: "version" });
  }

  const permissions = stringList(manifest.permissions);
  const hostPermissions = stringList(manifest.host_permissions);
  const riskyPermissions = new Set(["debugger", "management", "nativeMessaging", "proxy", "webRequestBlocking", "history", "downloads"]);
  for (const permission of permissions) {
    if (riskyPermissions.has(permission)) {
      findings.push({ id: `permission-${permission}`, severity: "warning", title: `Review permission: ${permission}`, detail: "This permission can expose sensitive browser capabilities. Confirm that the feature genuinely requires it.", path: "permissions" });
    }
  }

  if (hostPermissions.some((host) => host === "<all_urls>" || host === "http://*/*" || host === "https://*/*")) {
    findings.push({ id: "broad-host-permission", severity: "warning", title: "Broad host access", detail: "This extension requests access across many sites. Prefer the narrowest host patterns that support its features.", path: "host_permissions" });
  }

  const action = isRecord(manifest.action) ? manifest.action : null;
  if (action && action.default_popup !== undefined && typeof action.default_popup !== "string") {
    findings.push({ id: "popup-type", severity: "error", title: "Invalid popup path", detail: "action.default_popup must be a string path.", path: "action.default_popup" });
  }

  const background = isRecord(manifest.background) ? manifest.background : null;
  if (background && background.service_worker !== undefined && typeof background.service_worker !== "string") {
    findings.push({ id: "service-worker-type", severity: "error", title: "Invalid service worker path", detail: "background.service_worker must be a string path.", path: "background.service_worker" });
  }

  const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  contentScripts.forEach((entry, index) => {
    if (!isRecord(entry)) {
      findings.push({ id: `content-script-${index}`, severity: "error", title: "Invalid content script entry", detail: "Each content_scripts item must be an object.", path: `content_scripts[${index}]` });
      return;
    }
    if (stringList(entry.matches).length === 0) {
      findings.push({ id: `content-script-matches-${index}`, severity: "error", title: "Content script has no matches", detail: "Provide at least one string match pattern.", path: `content_scripts[${index}].matches` });
    }
    if (stringList(entry.js).length === 0 && stringList(entry.css).length === 0) {
      findings.push({ id: `content-script-files-${index}`, severity: "warning", title: "Content script has no files", detail: "Add at least one JavaScript or CSS file, or remove this entry.", path: `content_scripts[${index}]` });
    }
  });

  if (!manifest.action && !manifest.browser_action) {
    findings.push({ id: "no-action", severity: "info", title: "No toolbar action declared", detail: "This is valid if the extension does not need a toolbar button." });
  }

  if (findings.length === 0) {
    findings.push({ id: "clean", severity: "info", title: "No baseline issues found", detail: "No issues were detected by the current static rules. This is not a full Chrome Web Store review." });
  }

  const summary = findings.reduce((counts, finding) => {
    if (finding.severity === "error") counts.errors += 1;
    else if (finding.severity === "warning") counts.warnings += 1;
    else counts.info += 1;
    return counts;
  }, { errors: 0, warnings: 0, info: 0 });

  return { validJson: true, manifest, findings, summary };
}
