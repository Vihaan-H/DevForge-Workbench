import { describe, expect, it } from "vitest";
import { inspectManifest } from "./manifestMedic";

const valid = { manifest_version: 3, name: "Example", version: "1.0.0", description: "A sample", action: { default_title: "Open" } };

describe("inspectManifest", () => {
  it("reports invalid JSON without throwing", () => {
    const result = inspectManifest("{oops");
    expect(result.validJson).toBe(false);
    expect(result.summary.errors).toBe(1);
    expect(result.findings[0]?.id).toBe("json-parse");
  });

  it("rejects a non-object JSON root", () => {
    const result = inspectManifest("[]");
    expect(result.validJson).toBe(true);
    expect(result.summary.errors).toBe(1);
    expect(result.findings[0]?.id).toBe("root-object");
  });

  it("flags missing required fields and non-V3 manifests", () => {
    const result = inspectManifest(JSON.stringify({ name: "Example", manifest_version: 2 }));
    expect(result.findings.some((item) => item.id === "manifest-version")).toBe(true);
    expect(result.findings.some((item) => item.id === "missing-version")).toBe(true);
  });

  it("warns about broad host permissions and risky permissions", () => {
    const result = inspectManifest(JSON.stringify({ ...valid, host_permissions: ["<all_urls>"], permissions: ["debugger"] }));
    expect(result.findings.some((item) => item.id === "broad-host-permission")).toBe(true);
    expect(result.findings.some((item) => item.id === "permission-debugger")).toBe(true);
  });

  it("accepts a simple MV3 manifest and reports its version", () => {
    const result = inspectManifest(JSON.stringify(valid));
    expect(result.summary.errors).toBe(0);
    expect(result.findings.some((item) => item.id === "manifest-version-ok")).toBe(true);
  });

  it("catches wrong permission field types and non-string entries", () => {
    const result = inspectManifest(JSON.stringify({ ...valid, permissions: "tabs", host_permissions: ["https://example.com/*", 5] }));
    expect(result.findings.some((item) => item.id === "array-type-permissions")).toBe(true);
    expect(result.findings.some((item) => item.id === "array-item-type-host_permissions")).toBe(true);
  });

  it("detects Manifest V2 background scripts in an MV3 manifest", () => {
    const result = inspectManifest(JSON.stringify({ ...valid, background: { service_worker: "worker.js", scripts: ["old.js"] } }));
    expect(result.findings.some((item) => item.id === "mv3-background-scripts")).toBe(true);
  });

  it("flags malformed content script fields and run_at", () => {
    const result = inspectManifest(JSON.stringify({ ...valid, content_scripts: [{ matches: "all", js: [3], run_at: "never" }] }));
    expect(result.findings.some((item) => item.id === "content-scripts-type") || result.findings.some((item) => item.id === "content-script-matches-type-0")).toBe(true);
    expect(result.findings.some((item) => item.id === "content-script-js-type-0")).toBe(true);
    expect(result.findings.some((item) => item.id === "content-script-run-at-0")).toBe(true);
  });

  it("provides actionable suggestions for findings", () => {
    const result = inspectManifest("{}");
    expect(result.findings.some((item) => typeof item.suggestion === "string" && item.suggestion.length > 0)).toBe(true);
  });

  it("reports duplicate permissions and unsafe CSP", () => {
    const result = inspectManifest(JSON.stringify({ ...valid, permissions: ["storage", "storage"], content_security_policy: "script-src 'self' 'unsafe-eval'" }));
    expect(result.findings.some((item) => item.id === "duplicate-permissions-storage")).toBe(true);
    expect(result.findings.some((item) => item.id === "csp-unsafe-eval")).toBe(true);
  });
});
