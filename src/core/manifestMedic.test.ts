import { describe, expect, it } from "vitest";
import { inspectManifest } from "./manifestMedic";

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
    const result = inspectManifest(JSON.stringify({
      manifest_version: 3, name: "Example", version: "1.0",
      host_permissions: ["<all_urls>"], permissions: ["debugger"]
    }));
    expect(result.findings.some((item) => item.id === "broad-host-permission")).toBe(true);
    expect(result.findings.some((item) => item.id === "permission-debugger")).toBe(true);
  });

  it("accepts a simple MV3 manifest and reports its version", () => {
    const result = inspectManifest(JSON.stringify({
      manifest_version: 3, name: "Example", version: "1.0.0",
      description: "A small example", action: { default_title: "Open" }
    }));
    expect(result.summary.errors).toBe(0);
    expect(result.findings.some((item) => item.id === "manifest-version-ok")).toBe(true);
  });
});
