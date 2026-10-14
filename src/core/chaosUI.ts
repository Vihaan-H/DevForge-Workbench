export type ChaosScenario = "baseline" | "mobile" | "narrow" | "large-text" | "focus-visible" | "high-contrast" | "reduced-motion";
export type ChaosFinding = { id: string; severity: "error" | "warning" | "info"; title: string; detail: string; line?: number };
export interface ChaosInspection { findings: ChaosFinding[]; summary: { errors: number; warnings: number; info: number }; strippedFeatures: string[]; }

const safeUrl = (value: string) => /^(#|data:image\/(?:png|gif|jpeg|webp);base64,)/i.test(value.trim());
/** Remove active content and remote resource references before creating an opaque sandbox preview. */
export function sanitizeChaosMarkup(html: string): { html: string; strippedFeatures: string[] } {
  const stripped = new Set<string>();
  let safe = html.slice(0, 200_000);
  if (safe.length !== html.length) stripped.add("Input truncated at 200,000 characters");
  safe = safe.replace(/<!--[\s\S]*?-->/g, "");
  safe = safe.replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, () => { stripped.add("Removed embedded style element; use the CSS editor"); return ""; });
  safe = safe.replace(/<\s*(script|iframe|object|embed|applet|form|base|meta|link)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, (_match, tag: string) => { stripped.add(`Removed <${String(tag).toLowerCase()}> element`); return ""; });
  safe = safe.replace(/<\s*(script|iframe|object|embed|applet|form|base|meta|link)\b[^>]*\/?\s*>/gi, (_match, tag: string) => { stripped.add(`Removed <${String(tag).toLowerCase()}> element`); return ""; });
  safe = safe.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, () => { stripped.add("Removed inline event handler"); return ""; });
  safe = safe.replace(/\s+(src|srcset|href|action|formaction|poster|ping|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_whole, attr: string, double: string, single: string, bare: string) => {
    const value = double ?? single ?? bare ?? "";
    if (safeUrl(value)) return ` ${attr}="${value.replace(/"/g, "&quot;")}"`;
    stripped.add("Removed remote or unsafe resource URL");
    return "";
  });
  safe = safe.replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, () => { stripped.add("Removed nested srcdoc"); return ""; });
  safe = safe.replace(/\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (_whole, double: string, single: string) => {
    const value = double ?? single ?? "";
    if (/url\s*\(|expression\s*\(|@import|javascript:/i.test(value)) { stripped.add("Removed unsafe inline style"); return ""; }
    return ` style="${value.replace(/"/g, "&quot;")}"`;
  });
  safe = safe.replace(/<\s*([a-z][\w:-]*)\b([^>]*)>/gi, (_whole, tag: string, attrs: string) => {
    const normalizedTag = String(tag).toLowerCase();
    if (["html", "head", "body", "title"].includes(normalizedTag)) return "";
    return `<${normalizedTag}${attrs}>`;
  });
  return { html: safe, strippedFeatures: [...stripped] };
}

export function inspectChaosMarkup(html: string, css: string): ChaosInspection {
  const findings: ChaosFinding[] = [];
  const images = [...html.matchAll(/<img\b([^>]*)>/gi)];
  images.forEach((match, index) => {
    const attrs = match[1] ?? "";
    if (!/\balt\s*=/i.test(attrs)) findings.push({ id: `img-alt-${index}`, severity: "error", title: "Image is missing alt text", detail: "Add an alt attribute. Use alt=\"\" only when the image is decorative." });
    if (/\balt\s*=\s*(['"])\s*\1/i.test(attrs)) findings.push({ id: `img-empty-alt-${index}`, severity: "info", title: "Empty image alternative", detail: "An empty alt is valid for decorative images, but confirm this image conveys no information." });
  });
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
  buttons.forEach((match, index) => {
    const attrs = match[1] ?? "";
    const text = (match[2] ?? "").replace(/<[^>]*>/g, "").trim();
    if (!text && !/\baria-label\s*=|\baria-labelledby\s*=/i.test(attrs)) findings.push({ id: `button-name-${index}`, severity: "error", title: "Button may have no accessible name", detail: "Provide visible text or an aria-label/aria-labelledby reference." });
  });
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  anchors.forEach((match, index) => {
    const attrs = match[1] ?? "";
    const text = (match[2] ?? "").replace(/<[^>]*>/g, "").trim();
    if (!/\bhref\s*=/i.test(attrs)) findings.push({ id: `link-href-${index}`, severity: "warning", title: "Link has no href", detail: "Use a real destination or a button if this control performs an action." });
    if (!text && !/\baria-label\s*=|\baria-labelledby\s*=/i.test(attrs)) findings.push({ id: `link-name-${index}`, severity: "error", title: "Link may have no accessible name", detail: "Provide meaningful link text or an accessible label." });
  });
  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  if (headings.length === 0) findings.push({ id: "headings-none", severity: "warning", title: "No headings detected", detail: "Use semantic headings to describe the content structure when appropriate." });
  for (let index = 1; index < headings.length; index++) {
    if (headings[index]! > headings[index - 1]! + 1) findings.push({ id: `heading-skip-${index}`, severity: "warning", title: "Heading level is skipped", detail: `Heading level jumps from h${headings[index - 1]} to h${headings[index]}.` });
  }
  const ids = [...html.matchAll(/\bid\s*=\s*(['"])(.*?)\1/gi)].map((match) => match[2]).filter(Boolean);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  [...new Set(duplicates)].forEach((id) => findings.push({ id: `duplicate-id-${id}`, severity: "warning", title: "Duplicate element ID", detail: `The ID "${id}" appears more than once.` }));
  if (/(outline\s*:\s*none|outline\s*:\s*0)(?![^{}]*:focus)/i.test(css)) findings.push({ id: "outline-removed", severity: "warning", title: "CSS may remove focus outlines", detail: "Ensure keyboard focus remains visible with a clear :focus-visible style." });
  if (/font-size\s*:\s*(?:[0-9]+(?:\.[0-9]+)?px|[0-9]+(?:\.[0-9]+)?pt)\b/i.test(css)) findings.push({ id: "fixed-font-size", severity: "info", title: "Fixed font sizes detected", detail: "Check text resizing at 200% zoom and prefer scalable units for body text." });
  if (/overflow\s*:\s*(?:hidden|clip)/i.test(css)) findings.push({ id: "overflow-hidden", severity: "warning", title: "Clipping overflow detected", detail: "At narrow widths or enlarged text, confirm important content and keyboard focus are not clipped." });
  if (!findings.length) findings.push({ id: "baseline", severity: "info", title: "No baseline rules were triggered", detail: "This is a lightweight static check, not a complete accessibility audit." });
  const summary = findings.reduce((acc, item) => { acc[item.severity === "error" ? "errors" : item.severity === "warning" ? "warnings" : "info"]++; return acc; }, { errors: 0, warnings: 0, info: 0 });
  return { findings, summary, strippedFeatures: [] };
}

export function buildChaosPreviewDocument(html: string, css: string, scenario: ChaosScenario): { srcdoc: string; strippedFeatures: string[] } {
  const clean = sanitizeChaosMarkup(html);
  const cleanCss = css.slice(0, 100_000)
    .replace(/@import\s+[^;]+;?/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "initial")
    .replace(/javascript\s*:/gi, "");
  const scenarioCss: Record<ChaosScenario, string> = {
    baseline: "",
    mobile: "@media (max-width: 480px) { html { width: 100% !important; } body { max-width: 100% !important; overflow-wrap: anywhere !important; } * { max-width: 100% !important; } }",
    narrow: "html, body { width: 280px !important; max-width: 280px !important; overflow-wrap: anywhere !important; } * { max-width: 100% !important; }",
    "large-text": "html { font-size: 125% !important; } body, body * { line-height: 1.6 !important; }",
    "focus-visible": "*:focus { outline: 3px solid #ff00dd !important; outline-offset: 3px !important; }",
    "high-contrast": "html { filter: contrast(1.8) !important; } a, button, input, select, textarea, [tabindex] { outline: 2px solid currentColor; outline-offset: 2px; }",
    "reduced-motion": "*, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }"
  };
  const srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;min-height:100%;font-family:Arial,sans-serif;color:#171717;background:#fff}body{padding:16px}img{max-width:100%;height:auto}button,input,textarea,select{font:inherit}*:focus-visible{outline:2px solid #175cd3;outline-offset:2px}${cleanCss.replace(/<\/style/gi, "<\\/style")}${scenarioCss[scenario]}</style></head><body>${clean.html}</body></html>`;
  return { srcdoc, strippedFeatures: clean.strippedFeatures };
}
