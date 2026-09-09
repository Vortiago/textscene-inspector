# ADR 0020 — Editable Source pane in the web previewer

- Status: Accepted (2026-07-01)
- Related: ADR-0007 (Split Dock shell, "no left rail"), ADR-0001 (React-free linter
  boundary). Builds on the shared `TscnPreviewShell` and `@textscene/core/linter`.

## Context

The web previewer showed a scene's render and inspector but never its **source text**. The
linter, though already a React-free, THREE-free, browser-safe package, had no browser
consumer. Users want to see the `.tscn` alongside the render, edit-and-preview, and have
invalid code marked. In production the built-in fixtures are just a handful of examples.
The real flow is **uploading or pasting** a `.tscn`.

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
   left of the shell. It injects the show/hide toggle through the shell's existing `toolbar`
   slot and feeds edits down through the existing `content` prop. **The shell API is
   unchanged and ADR-0007 stands.** The shell still has no left rail. The rail belongs to
   the web app's outer layout. VS Code never mounts the pane (it has the real editor).
   *Rejected:* growing `TscnPreviewShell` a prop-gated left column. It couples the shared
   shell to an editing concern and would have to be explicitly disabled in VS Code.

2. **Bare `<textarea>`, no editor library.** Editing relies on the textarea's native input
   and native undo. The pane is forced monospace. *Rejected:* Monaco (multi-MB, web workers,
   awkward under Vite, and it duplicates VS Code's own editor) and CodeMirror 6 (a real
   dependency for a "bare-bones" pane). Neither is justified for viewing plus light editing
   of `.tscn`.

3. **Hold last valid render.** The buffer is the source of truth for the editor and linter.
   The web app forwards content to the shell **only when it still parses renderably under
   the Lenient parser** (debounced about 250 ms). A mid-edit file that transiently breaks
   leaves the viewport on its last valid render. The gutter marker is what signals the
   current breakage. Gating on the lenient parser (not on zero lint errors) keeps the
   viewport live through strict-only nitpicks that still render. *Rejected:* passing every
   keystroke straight through. It flickers the viewport to empty on transient errors.

4. **Linter surfaced as a gutter and popover.** The web app is the first browser consumer
   of `@textscene/core/linter`, running it continuously (cheap string parsing). Diagnostics
   render as a line gutter with error and warning dots and a hover popover explaining the
   issue(s) on that line. The toggle carries a problem-count badge so a collapsed pane still
   nudges. *Deferred, not rejected:* inline wavy underlines under the offending span. A
   `<textarea>` cannot style its own text per range. The dependency-free
   **highlight-overlay** pattern (an `aria-hidden` mirror `<div>` of spans behind a
   `color: transparent` textarea, scroll-synced and metric-matched) achieves it without
   adopting CodeMirror. It is alignment-sensitive, and monospace makes it tractable.

5. **Ephemeral persistence plus Download.** Edits live in memory only. Switching scene or
   reloading resets the buffer to the file's content. A "Download .tscn" button exports the
   current buffer. *Rejected:* File System Access API write-back. It is Chromium-only,
   permission-prompt heavy, well beyond bare-bones, and squarely the VS Code extension's job.

   *Amended 2026-07-17:* edits stay ephemeral, but loss is no longer SILENT for in-app
   one-click replacements. The fixture palette, the tree's ⤢ open-sub-scene, and a
   scene-replacing drop or upload confirm (native `window.confirm`, no custom modal) before
   discarding a buffer edited since its last load. Unedited panes and resource-only drops
   never prompt. The one-misclick-total-loss risk of the ⤢ affordance motivated the change.
   Deliberately excluded: browser reload and close stay unguarded (no `beforeunload`
   handler). Reload-resets remain the documented reset path.

6. **Shown by default.** The production flow is upload or paste with few fixtures, so an
   editor-first split is the right first impression. An empty pane shows a "Paste or type
   your `.tscn` here…" placeholder. Show/hide state and pane width persist in `localStorage`,
   mirroring the existing active-fixture persistence.

## Consequences

- The web app gains an editable buffer and a linter dependency. `@textscene/core/linter`
  ships to the browser.
- `TscnPreviewShell` and the VS Code extension are **untouched**. Web and VS Code parity is
  preserved because the pane is purely additive web-app chrome.
- No undo or redo beyond the browser's native textarea history, no multi-file editing, and
  the pane always reflects the root/main scene only (inline instanced sub-scenes are not
  shown).
- Inline underlines are absent. The overlay technique in point 4 is the route to them
  without adopting an editor library.
