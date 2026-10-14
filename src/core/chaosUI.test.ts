import { describe, expect, it } from "vitest";
import { buildChaosPreviewDocument, inspectChaosMarkup, sanitizeChaosMarkup } from "./chaosUI";

describe("ChaosUI safety and checks", () => {
  it("strips script blocks, event attributes, forms and remote URLs", () => {
    const result = sanitizeChaosMarkup('<script>alert(1)</script><button onclick="run()">Go</button><img src="https://example.com/a.png"><form><input></form>');
    expect(result.html).not.toMatch(/<script|onclick|https:\/\/|<form/i);
    expect(result.strippedFeatures.length).toBeGreaterThan(0);
  });

  it("flags missing image alternatives and unlabeled controls", () => {
    const result = inspectChaosMarkup('<img src="local.png"><button></button><a href="#"> </a>', "");
    expect(result.findings.some((finding) => finding.id === "img-alt-0")).toBe(true);
    expect(result.findings.some((finding) => finding.id === "button-name-0")).toBe(true);
    expect(result.findings.some((finding) => finding.id === "link-name-0")).toBe(true);
  });

  it("detects focus outline removal and clipping risks", () => {
    const result = inspectChaosMarkup('<h1>Test</h1>', 'button{outline:0} .card{overflow:hidden}');
    expect(result.findings.some((finding) => finding.id === "outline-removed")).toBe(true);
    expect(result.findings.some((finding) => finding.id === "overflow-hidden")).toBe(true);
  });

  it("generates scenario CSS and disables scripts and external loads", () => {
    const result = buildChaosPreviewDocument('<h1>Safe</h1><script>bad()</script>', '@import url(https://example.com/x.css); .a{background:url(https://example.com/a.png)}', "large-text");
    expect(result.srcdoc).toContain("font-size: 125%");
    expect(result.srcdoc).not.toContain("<script>bad()");
    expect(result.srcdoc).not.toContain("https://example.com");
  });
});
