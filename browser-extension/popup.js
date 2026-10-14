"use strict";

const inspectButton = document.getElementById("inspect");
const exportButton = document.getElementById("export");
const statusNode = document.getElementById("status");
const resultsSection = document.getElementById("results");
const pageNameNode = document.getElementById("page-name");
const metricsNode = document.getElementById("metrics");
const findingsNode = document.getElementById("findings");
const healthNode = document.getElementById("health");
let latestReport = null;

function setStatus(message, kind = "") {
  statusNode.textContent = message;
  statusNode.className = `status ${kind}`.trim();
}

function makeMetric(value, label) {
  const card = document.createElement("div");
  card.className = "metric";
  const number = document.createElement("strong");
  number.textContent = String(value);
  const caption = document.createElement("span");
  caption.textContent = label;
  card.append(number, caption);
  return card;
}

function buildFindings(report) {
  const items = [];
  if (!report.document.lang) items.push({ alert: true, text: "The document does not declare a language." });
  if (!report.viewport.hasMeta) items.push({ alert: true, text: "No viewport meta tag was found." });
  if (report.layout.horizontalOverflow) items.push({ alert: true, text: "The document width exceeds the visible viewport." });
  if (report.accessibility.imagesMissingAlt) items.push({ alert: true, text: `${report.accessibility.imagesMissingAlt} image(s) have no alt attribute.` });
  if (report.accessibility.buttonsWithoutName) items.push({ alert: true, text: `${report.accessibility.buttonsWithoutName} button(s) may lack an accessible name.` });
  if (report.accessibility.linksWithoutName) items.push({ alert: true, text: `${report.accessibility.linksWithoutName} link(s) may lack an accessible name.` });
  if (report.accessibility.linksWithoutHref) items.push({ alert: false, text: `${report.accessibility.linksWithoutHref} anchor(s) have no href.` });
  if (report.landmarks.main === 0) items.push({ alert: false, text: "No main landmark was found." });
  if (!items.length) items.push({ alert: false, text: "No configured baseline signals were triggered. This is not proof of accessibility." });
  return items;
}

// This function is injected only after the user clicks Inspect. Keep it self-contained:
// Chrome serializes this function for isolated-world execution, so it cannot close over popup variables.
function collectDiagnostics() {
  const root = document.documentElement;
  const body = document.body;
  const nodes = (selector) => Array.from(document.querySelectorAll(selector)).slice(0, 10000);
  const nameFor = (element) => {
    const aria = element.getAttribute("aria-label");
    const labelledBy = element.getAttribute("aria-labelledby");
    const title = element.getAttribute("title");
    const text = (element.innerText || element.textContent || "").trim();
    return Boolean((aria && aria.trim()) || (labelledBy && labelledBy.trim()) || (title && title.trim()) || text);
  };
  const images = nodes("img");
  const buttons = nodes("button, input[type=button], input[type=submit], input[type=reset]");
  const anchors = nodes("a");
  const controls = nodes("input:not([type=hidden]), select, textarea");
  const missingLabels = controls.filter((control) => {
    if (control.getAttribute("aria-label") || control.getAttribute("aria-labelledby")) return false;
    if (control.labels && control.labels.length) return false;
    const id = control.id;
    return !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
  }).length;
  const locationSummary = (() => {
    try { return window.location.origin + window.location.pathname; }
    catch { return ""; }
  })();

  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    page: { title: document.title || "(untitled)", location: locationSummary },
    document: { lang: root ? (root.getAttribute("lang") || "") : "", readyState: document.readyState, hasBody: Boolean(body) },
    viewport: { width: window.innerWidth, height: window.innerHeight, hasMeta: Boolean(document.querySelector('meta[name="viewport"]')) },
    layout: { documentWidth: root ? root.scrollWidth : 0, documentHeight: root ? root.scrollHeight : 0, horizontalOverflow: Boolean(root && root.scrollWidth > window.innerWidth + 1) },
    counts: {
      headings: nodes("h1,h2,h3,h4,h5,h6").length,
      images: images.length,
      buttons: buttons.length,
      links: anchors.length,
      formControls: controls.length,
      focusableCandidates: nodes('a[href],button,input,select,textarea,[tabindex]').length,
      landmarkElements: nodes('main,nav,header,footer,aside,[role="main"],[role="navigation"]').length
    },
    accessibility: {
      imagesMissingAlt: images.filter((image) => !image.hasAttribute("alt")).length,
      buttonsWithoutName: buttons.filter((button) => !nameFor(button)).length,
      linksWithoutName: anchors.filter((anchor) => !nameFor(anchor)).length,
      linksWithoutHref: anchors.filter((anchor) => !anchor.hasAttribute("href")).length,
      controlsMissingLabel: missingLabels
    },
    landmarks: {
      main: nodes('main,[role="main"]').length,
      navigation: nodes('nav,[role="navigation"]').length,
      header: nodes('header,[role="banner"]').length,
      footer: nodes('footer,[role="contentinfo"]').length
    }
  };
}

function showReport(report) {
  latestReport = report;
  resultsSection.hidden = false;
  pageNameNode.textContent = `${report.page.title} · ${report.page.location || "restricted page address"}`;
  metricsNode.replaceChildren(
    makeMetric(report.layout.horizontalOverflow ? "YES" : "NO", "HORIZONTAL OVERFLOW"),
    makeMetric(report.accessibility.imagesMissingAlt, "IMAGES WITHOUT ALT"),
    makeMetric(report.accessibility.buttonsWithoutName, "BUTTONS WITHOUT NAME"),
    makeMetric(report.accessibility.controlsMissingLabel, "CONTROLS WITHOUT LABEL")
  );
  findingsNode.replaceChildren();
  buildFindings(report).forEach((finding) => {
    const item = document.createElement("li");
    item.textContent = finding.text;
    if (finding.alert) item.className = "alert";
    findingsNode.append(item);
  });
  healthNode.textContent = report.layout.horizontalOverflow || report.accessibility.imagesMissingAlt || report.accessibility.buttonsWithoutName || report.accessibility.controlsMissingLabel ? "REVIEW" : "BASELINE";
  setStatus("Inspection finished. Report is held in this popup until you export it.", "success");
}

inspectButton.addEventListener("click", async () => {
  inspectButton.disabled = true;
  setStatus("Inspecting the active tab…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== "number") throw new Error("No active browser tab was found.");
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectDiagnostics });
    const report = results && results[0] ? results[0].result : null;
    if (!report || typeof report !== "object") throw new Error("The browser did not return a page report. This page may restrict extensions.");
    showReport(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inspection failed.";
    setStatus(`Could not inspect this tab: ${message} Open a regular website tab and try again.`, "error");
  } finally {
    inspectButton.disabled = false;
  }
});

exportButton.addEventListener("click", () => {
  if (!latestReport) { setStatus("Run an inspection before exporting."); return; }
  const report = {
    tool: "DevForge Page Inspector",
    exportedAt: new Date().toISOString(),
    dataHandling: "Page text and query strings are not collected. The report is generated locally after an explicit click.",
    ...latestReport
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "devforge-page-diagnostics.json";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  setStatus("JSON report export started.", "success");
});
