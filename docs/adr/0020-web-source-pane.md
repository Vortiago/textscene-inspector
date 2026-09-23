# ADR 0020: Editable Source pane in the web previewer

- Status: Accepted
- Related: ADR-0007 (Split Dock shell, "no left rail"), ADR-0001 (React-free linter
  boundary). Builds on the shared `TscnPreviewShell` and `@textscene/core/linter`.

## Context

Users want to see the `.tscn` source text beside the render, edit it and preview the result,
and have invalid code marked. The linter is a React-free, THREE-free, browser-safe package.
In production the built-in fixtures are a handful of examples, and the real flow is
**uploading or pasting** a `.tscn`.

Constraints:

- `TscnPreviewShell` is **shared** with the VS Code extension, which already gives the user
  a real text editor and file tree. ADR-0007 removed the left rail of the shell because in
  the VS Code webview it duplicates the Explorer of VS Code. A source-text UI must not
  bring it back.
- Bundle size is actively managed (the shell lazy-loads its DOM panels).
- The shell parses again whenever its `content` prop changes, so two-way content flow
  needs no change to the parse pipeline.

## Decision

Add an editable **Source pane** (see CONTEXT.md) to the **web app only**, as a left sibling
that wraps `<TscnPreviewShell>`. The specifics and the rejected options:

1. **Web-app sibling, not a shell column.** The web app owns the buffer and renders the pane
   left of the shell. It injects the show/hide toggle through the `toolbar` slot of the
   shell and feeds edits down through the `content` prop. **The shell API is unchanged and
   ADR-0007 stands.** The shell has no left rail. The rail belongs to the outer layout of
   the web app. VS Code never mounts the pane (it has the real editor).
   *Rejected:* a prop-gated left column in `TscnPreviewShell`. It couples the shared shell
   to an editing concern and must be explicitly disabled in VS Code.

2. **Bare `<textarea>`, no editor library.** Editing relies on the native input and native
   undo of the textarea. The pane is forced monospace. *Rejected:* Monaco (multi-MB, web
   workers, awkward under Vite, and it duplicates the editor of VS Code) and CodeMirror 6 (a
   real dependency for a bare-bones pane). Neither is justified for viewing plus light
   editing of `.tscn`.

3. **Hold the last valid render.** The buffer is the source of truth for the editor and the
   linter. The web app forwards content to the shell **only when it still parses renderably
   under the Lenient parser** (debounced about 250 ms). A mid-edit file that breaks for a
   moment leaves the viewport on its last valid render, and the gutter marker signals the
   current breakage. The gate is the lenient parser, not zero lint errors, so the viewport
   stays live through strict-only findings that still render. *Rejected:* passing every
   keystroke straight through. It flickers the viewport to empty on transient errors.

4. **Linter surfaced as a gutter and popover.** The web app is the first browser consumer
   of `@textscene/core/linter` and runs it continuously (cheap string parsing). Diagnostics
   render as a line gutter with error and warning dots and a hover popover that explains
   the issues on that line. The toggle carries a problem-count badge, so a collapsed pane
   still signals problems. *Deferred, not rejected:* inline wavy underlines under the
   offending span. A `<textarea>` cannot style its own text per range. The dependency-free
   **highlight-overlay** pattern (an `aria-hidden` mirror `<div>` of spans behind a
   `color: transparent` textarea, scroll-synced and metric-matched) achieves it without
   CodeMirror. It is alignment-sensitive, and monospace makes it tractable.

5. **Ephemeral persistence plus Download.** Edits live in memory only. A scene switch or a
   reload resets the buffer to the content of the file. A "Download .tscn" button exports
   the current buffer. *Rejected:* write-back through the File System Access API. It is
   Chromium-only, heavy on permission prompts, well beyond bare-bones, and the job of the
   VS Code extension.

   *Amendment:* edits stay ephemeral, but an in-app one-click replacement does not lose
   them silently. The fixture palette, the ⤢ open-sub-scene of the tree, and a
   scene-replacing drop or upload confirm (native `window.confirm`, no custom modal) before
   they discard a buffer edited since its last load. Unedited panes and resource-only drops
   never prompt. The reason is the one-misclick total-loss risk of the ⤢ affordance.
   Excluded: browser reload and close stay unguarded (no `beforeunload` handler). A reload
   stays the documented reset path.

6. **Shown by default.** The production flow is upload or paste with few fixtures, so an
   editor-first split is the right first impression. An empty pane shows a "Paste or type
   your `.tscn` here…" placeholder. The show/hide state and the pane width persist in
   `localStorage`, like the active-fixture persistence.

## Consequences

- The web app gains an editable buffer and a linter dependency. `@textscene/core/linter`
  ships to the browser.
- `TscnPreviewShell` and the VS Code extension are **untouched**. Web and VS Code parity
  holds, because the pane is purely additive web-app chrome.
- No undo or redo beyond the native textarea history, no multi-file editing, and the pane
  always shows the root/main scene only (inline instanced sub-scenes do not show).
- Inline underlines are absent. The overlay technique in point 4 is the route to them
  without an editor library.
