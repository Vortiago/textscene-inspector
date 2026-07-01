# ADR 0020 — Editable Source pane in the web previewer

- Status: Accepted (2026-07-01)
- Related: ADR-0007 (Split Dock shell — "no left rail"), ADR-0001 (React-free linter
  boundary). Builds on the shared `TscnPreviewShell` and `@textscene/core/linter`.

## Context

The web previewer showed a scene's render + inspector but never its **source text**, and
the linter — though already a React/THREE-free, browser-safe package — had no browser
consumer. Users want to see the `.tscn` alongside the render, edit-and-preview, and have
invalid code marked. In production the built-in fixtures are just a handful of examples;
the real flow is **uploading or pasting** a `.tscn`.

Constraints that shaped the decision:

- `TscnPreviewShell` is **shared** with the VS Code extension, which already gives the user
  a real text editor and file tree. ADR-0007 deliberately killed the shell's left rail
  because in the VS Code webview it would duplicate VS Code's own Explorer. Any source-text
  UI must not regress that.
- Bundle size is actively managed (the shell already lazy-loads its DOM panels, WI-R3F-18).
- The shell already re-parses whenever its `content` prop changes, so two-way content flow
  needs no change to the parse pipeline.

## Decision

Add an editable **Source pane** (see CONTEXT.md) to the **web app only**, as a left sibling
that wraps `<TscnPreviewShell>`. Specifics and the alternatives rejected:

1. **Web-app sibling, not a shell column.** The web app owns the buffer and renders the pane
   left of the shell, injecting the show/hide toggle through the shell's existing `toolbar`
   slot and feeding edits down via the existing `content` prop. **The shell API is
   unchanged and ADR-0007 stands** — the shell still has no left rail; the rail belongs to
   the web app's outer layout. VS Code never mounts the pane (it has the real editor).
   *Rejected:* growing `TscnPreviewShell` a prop-gated left column — it couples the shared
   shell to an editing concern and would have to be explicitly disabled in VS Code.

2. **Bare `<textarea>`, no editor library.** Editing relies on the textarea's native input
   and native undo; the pane is forced monospace. *Rejected:* Monaco (multi-MB, web workers,
   awkward under Vite, and ironically duplicates VS Code's own editor) and CodeMirror 6
   (a real dep for a "bare-bones" pane). Neither is justified for viewing + light editing of
   `.tscn`.

3. **Hold last valid render.** The buffer is the source of truth for the editor + linter,
   but the web app forwards content to the shell **only when it still parses renderably
   under the Lenient parser** (debounced ~250 ms). A mid-edit file that transiently breaks
   leaves the viewport on its last valid render; the gutter marker is what signals the
   current breakage. Gating on the lenient parser (not on zero lint-errors) keeps the
   viewport live through strict-only nitpicks that still render. *Rejected:* passing every
   keystroke straight through — it flickers the viewport to empty on transient errors.

4. **Linter surfaced as a gutter + popover.** The web app becomes the first browser consumer
   of `@textscene/core/linter`, running it continuously (cheap string-parsing). Diagnostics
   render as a line-gutter with error/warning dots and a hover popover explaining the
   issue(s) on that line; the toggle carries a problem-count badge so a collapsed pane still
   nudges. *Deferred, not rejected:* inline wavy underlines under the offending span. A
   `<textarea>` cannot style its own text per-range, but the dep-free **highlight-overlay**
   pattern (an `aria-hidden` mirror `<div>` of spans behind a `color: transparent` textarea,
   scroll-synced, metric-matched) achieves it without adopting CodeMirror. Left as a future
   workaround because it is alignment-sensitive; monospace makes it tractable when wanted.

5. **Ephemeral persistence + Download.** Edits live in memory only; switching scene or
   reloading resets the buffer to the file's content (no unsaved-changes warning). A
   "Download .tscn" button exports the current buffer. *Rejected:* File System Access API
   write-back — Chromium-only, permission-prompt heavy, well beyond bare-bones, and squarely
   the VS Code extension's job.

6. **Shown by default.** The production flow is upload/paste with few fixtures, so an
   editor-first split is the right first impression; an empty pane shows a "Paste or type
   your `.tscn` here…" placeholder. Show/hide state and pane width persist in `localStorage`,
   mirroring the existing active-fixture persistence.

## Consequences

- The web app gains an editable buffer and a linter dependency; `@textscene/core/linter`
  ships to the browser for the first time.
- `TscnPreviewShell` and the VS Code extension are **untouched**; web + VS Code parity is
  preserved because the pane is purely additive web-app chrome.
- No undo/redo beyond the browser's native textarea history; no multi-file editing; the pane
  always reflects the root/main scene only (inline instanced sub-scenes are not shown).
- Inline underlines are intentionally absent at first; the overlay workaround is documented
  above so a future upgrade doesn't have to rediscover that a bare textarea can't do it.
