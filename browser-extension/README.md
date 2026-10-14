# DevForge Page Inspector (Chromium MV3)

A minimal-permission companion for DevForge Workbench. It runs a static page-structure diagnostic only after the user presses **Inspect this page** in the popup.

## Install locally

1. Download the repository ZIP from GitHub and extract it, or clone the repository.
2. Open `chrome://extensions` in Chrome or another Chromium browser.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the repository's `browser-extension` folder.
5. Pin **DevForge Page Inspector**, open a regular website tab, then click the extension and **Inspect this page**.

Extension internal pages, browser settings pages, the Chrome Web Store, PDF viewers, and some protected pages may block injection. This is expected; the extension shows an error rather than bypassing browser restrictions.

## Permissions

- `activeTab`: temporary access to the active tab after a user gesture.
- `scripting`: inject the self-contained diagnostic function when Inspect is clicked.

No broad host permissions, persistent content scripts, background worker, remote code, analytics, server calls, or storage permission are used. Inspection does not start automatically on navigation.

## Collected data

The report contains the page title, origin + path (not query parameters or hash fragments), viewport/layout dimensions, counts for headings and interactive elements, and basic accessibility signals. It does **not** collect the page's visible text, form values, cookies, local storage, network traffic, screenshots, or script source. The report exists in popup memory until exported. JSON export is initiated locally.

## Quality checks

From the repository root, run `npm run check:extension`. The checker verifies manifest version and least-privilege permissions, local popup assets, no inline/remote popup resources, explicit-click injection, local report export, and JavaScript syntax.

## Limits

The diagnostic is a heuristic, not a complete accessibility audit or security scanner. A control's computed accessible name and actual reading order require a real accessibility tree. Overflow is measured at capture time and can change with resizing. Do not treat a clean report as proof of WCAG conformance.
