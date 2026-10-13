# DevForge Workbench

A local-first developer testing workbench for browser extensions, web interfaces, and AI outputs.

**Status:** early foundation (v0.4.0). Phases 01–04 establish persistent projects, backup/restore, report history, Manifest Medic, Extension Inspector, and OutputJudge. PromptLab, RegressionLab, and ChaosUI remain planned.

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

## Privacy and data handling

- Current features work without a backend, account, API key, or external AI service.
- Project data and settings are stored in this browser's local storage.
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
7. **ChaosUI:** test layout/accessibility scenarios with reversible controls and clear reset behavior.
8. **Companion extension:** minimal-permission Chromium extension to capture explicitly requested page diagnostics and export a report.
9. **Release hardening:** accessibility checks, cross-browser testing, docs, and reproducible builds.
