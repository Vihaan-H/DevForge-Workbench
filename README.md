# DevForge Workbench

A local-first developer testing workbench for browser extensions, web interfaces, and AI outputs.

**Status:** Phases 01–09 implementation is complete. The workbench includes local projects, Manifest Medic, Extension Inspector, OutputJudge, PromptLab, RegressionLab, ChaosUI, and a minimal-permission Chromium companion extension. Automated release-baseline checks are in CI; manual cross-browser smoke testing remains a release task.

## Implemented

### Phase 01: Workbench core
- Six-module navigation and searchable dashboard.
- Multiple local projects, each with its own manifest editor content.
- Browser-local persistence for projects, settings, and report history.
- Settings for import confirmation, report history, compact report cards, and report-history limit.
- Versioned JSON backup/export and validated JSON import/restore.
- Dashboard report cards and per-report JSON export.
- Storage failures and malformed imports are handled without intentionally replacing existing state.

### Phase 02: Manifest Medic
- Malformed JSON and invalid root-object diagnostics.
- Manifest V3 baseline and required-field checks.
- Version formatting and long-name warnings.
- Permission-field type checks, duplicate permission checks, and sensitive-permission warnings.
- Broad host access warnings for required and optional host patterns.
- Action, popup, icon, background service-worker, and Manifest V2 background-script conflict checks.
- Content-script structure, matches, file-list, and timing checks.
- Baseline CSP checks including unsafe-eval.
- Findings include severity, path where applicable, explanation, and suggested correction.
- Deterministic Vitest coverage for invalid, incomplete, suspicious, and valid fixture manifests.

These are static baseline rules, not a complete Chrome Web Store review. The engine never executes extension code. WebCRX/CRX Emulator compatibility still needs real-world testing.

### Phase 03: Extension Inspector
- Accepts ZIP packages up to 20 MB and inspects their files locally.
- Checks for manifest.json, parses its root object, and verifies referenced popup, service worker, content-script, CSS, and icon paths.
- Reports missing references, missing icon declarations, non-V3 manifests, malformed permissions, and potentially sensitive files.
- Exports a JSON findings report and a ZIP copy of the inspected package.
- Limits archive file count and unpacked size; excludes common macOS metadata.
- Imported scripts are never executed. The inspector is a baseline, not a security audit.

### Phase 04: OutputJudge
- Checks manually supplied text with repeatable required-phrase and forbidden-phrase rules.
- Supports optional minimum and maximum word counts.
- Can require valid JSON and validate a practical JSON Schema subset: type, required, properties, items, minLength, maxLength, and pattern.
- Produces deterministic PASS/FAIL findings, counts, and downloadable JSON reports.
- Reports are added to the same local workbench history. It does not call an AI model or claim to verify truth or writing quality.

### Phase 05: PromptLab
- Stores prompt templates and frozen, numbered prompt versions per workbench project.
- Lets you create test cases with context, required/forbidden phrases, and optional word-count bounds.
- Evaluates manually pasted outputs against deterministic rules; it does not call a model or claim to judge factual accuracy or prose quality.
- Saves runs with the tested prompt version and test case, shows PASS/FAIL findings, and compares two saved outputs side by side.
- Saves prompt data in project-scoped browser storage and supports a separate JSON export. Review exports before sharing because they may contain private prompts and outputs.

### Phase 06: RegressionLab
- Compares baseline and candidate text snapshots with line-by-line added, removed, and unchanged lines.
- Includes optional whitespace normalization and a bounded comparison engine (up to 1,200 lines per snapshot).
- Saves up to 40 snapshots per project, reloads them into either comparison side, and imports/exports snapshot JSON.
- Supports text, HTML/DOM text, CSS, JSON, and other code/config as text. It does not execute files, render a DOM, or perform pixel-based screenshot comparisons.
- Adds comparison summaries to workbench report history and can export detailed diff reports.

### Phase 07: ChaosUI
- Provides an editable HTML fragment and CSS workspace, viewport stress presets, and a live preview in an opaque sandboxed iframe.
- Includes baseline, mobile (375 px), tiny (280 px), enlarged text, keyboard-focus, high-contrast, and reduced-motion scenarios.
- Removes scripts, event-handler attributes, forms, nested frames, external resource URLs, CSS imports, and CSS `url()` references from the preview.
- Flags common static issues such as missing image alternatives, potentially unnamed buttons/links, skipped heading levels, duplicate IDs, removed focus outlines, and clipped overflow.
- Stores the workspace per project, shares findings with report history, and exports JSON reports.
- Static heuristics do not prove WCAG conformance and cannot measure rendered contrast, real reflow, or pixel differences.

### Phase 08: Chromium companion extension
- Adds `browser-extension/`, an installable Chromium Manifest V3 extension with a popup and local JSON export.
- Uses only `activeTab` and `scripting`; it has no persistent host permissions, content scripts, background worker, storage permission, analytics, or server calls.
- Inspection is explicitly click-triggered and measures page structure, layout dimensions, element counts, and basic accessibility signals without collecting visible page text or form values.
- Reports retain the origin and path but omit query parameters and fragments to reduce accidental capture of tokens.
- `npm run check:extension` validates the manifest and local popup package; CI runs this check alongside unit tests and the production build.
- Browser-restricted tabs can refuse injection. This is expected and is never bypassed.

### Phase 09: Release hardening
- Adds a keyboard skip link to the main content and an accessible name for the workbench navigation landmark.
- Honors the operating system's reduced-motion preference and removes the remote Google Fonts import. Typography falls back to local system fonts.
- Adds a `no-referrer` policy on the app document to avoid forwarding the app URL as a referrer.
- Adds `npm run check:release` for document metadata, tool integration, skip navigation, visible focus styling, reduced motion, remote font imports, and the companion permission baseline.
- CI now runs unit tests, companion-extension validation, release-baseline checks, and the TypeScript/Vite production build.
- Manual QA checklist: test keyboard-only navigation, reduced motion, narrow/mobile layout, extension behavior in supported Chromium browsers, and restricted browser pages before sharing broadly. Automated checks do not replace these real-browser checks.

## Privacy and data handling

- Current features work without a backend, account, API key, or external AI service. The workbench does not load third-party web fonts.
- Projects and settings are stored in this browser's local storage. PromptLab and RegressionLab keep additional project-scoped data under separate local storage keys; export those tool workspaces separately. Browser-local tool data is not automatically included in the main workbench JSON backup.
- Use **Export workbench JSON** to make a backup before clearing browser data or switching devices.
- Import replaces the current local projects, settings, and report history after confirmation (when that setting is enabled).
- Exported reports may contain project names, manifest names, permissions, and diagnostic details. Review them before sharing.
- Do not paste secrets, access tokens, private keys, or confidential customer data into test inputs.
- Imported project files are data, not code to execute.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Run checks:

```bash
npm test
npm run build
```

## Vercel / Netlify

- Build command: `npm run build`
- Output directory: `dist`
- No environment variables are required.
- Import the repository and deploy from `main`.

## Roadmap

1. **Core:** implemented in Phase 01.
2. **Manifest Medic:** expanded in Phase 02.
3. **Extension Inspector:** safely inspect project archives, check referenced files and icons, and export findings. Never execute imported scripts.
4. **OutputJudge:** deterministic rules for text, JSON, schemas, required/forbidden content, and length limits.
5. **PromptLab:** version prompt templates and run test cases against manually supplied outputs, optionally evaluated by OutputJudge.
6. **RegressionLab:** compare saved text/DOM/CSS snapshots and highlight diffs.
7. **ChaosUI:** implemented with reversible scenario presets and a resettable sandbox preview.
8. **Companion extension:** implemented in `browser-extension/`; user-triggered page diagnostics and JSON export with minimal permissions.
9. **Release hardening:** automated baseline checks and keyboard/reduced-motion defaults implemented. Manual cross-browser smoke checks are documented but still need to be performed on target browsers/devices.
