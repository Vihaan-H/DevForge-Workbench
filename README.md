# DevForge Workbench

A local-first developer testing workbench for browser extensions, web interfaces, and AI outputs.

**Status:** early foundation (v0.1.0). Manifest Medic is the first implemented module. Other modules are explicitly marked planned until they have working behavior.

## Principles

- Local-first: inputs stay in the browser unless you deliberately export a report.
- No backend, account, API key, or external AI service required for the current tools.
- Inspect untrusted project files as data; do not execute them merely to inspect them.
- Keep the UI honest about what is implemented and what is on the roadmap.
- Build and test modules incrementally rather than shipping six decorative shells.

## Current features

### Manifest Medic
- Parses a pasted JSON manifest and handles malformed input without crashing.
- Checks Manifest V3 baseline, required fields, version formatting, selected sensitive permissions, broad host access, and common action/service-worker/content-script configuration mistakes.
- Shows severity counts and individual findings.
- Remembers the editor text in localStorage when available.
- Exports a JSON report locally.
- Includes Vitest unit tests for the static rule engine.

These rules are a useful baseline, not an exhaustive validator or a guarantee of Chrome Web Store approval. Browser and WebCRX/CRX Emulator compatibility still needs real-world testing.

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

## Netlify

1. Import this repository into Netlify.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. No environment variables are required for the current app.

## Roadmap

1. **Core:** shared project types, reliable local persistence, report/export conventions.
2. **Manifest Medic:** broaden static rules and fixtures.
3. **Extension Inspector:** safely inspect project archives, check referenced files and icons, and export findings. Never execute imported scripts.
4. **OutputJudge:** deterministic rules for text, JSON, schemas, required/forbidden content, and length limits.
5. **PromptLab:** version prompt templates and run test cases against manually supplied outputs, optionally evaluated by OutputJudge.
6. **RegressionLab:** compare saved text/DOM/CSS snapshots and highlight diffs.
7. **ChaosUI:** test layout/accessibility scenarios with reversible controls and clear reset behavior.
8. **Companion extension:** minimal-permission Chromium extension to capture explicitly requested page diagnostics and export a report.
9. **Release hardening:** accessibility checks, cross-browser testing, docs, and reproducible builds.

## Security notes

- Do not paste secrets, access tokens, private keys, or confidential customer data into test inputs.
- Reports may include manifest names, permissions, and diagnostic details. Review exports before sharing.
- The companion extension is not included yet.
