# ADR 0021 — VS Code preview refresh is save-driven, not keystroke-driven

- Status: Accepted (2026-07-12)

The **Preview panel** mirrors the `.tscn` file **on disk**: it refreshes on document save
and on external disk changes caught by the resource watcher (git pull, branch switch),
reading content from the filesystem — unsaved editor keystrokes never render. This is a
deliberate asymmetry with the web previewer's live-typed **Source pane** (ADR-0020), not
a gap to close.

Why disk-truth wins in VS Code: every dependency the scene renders with (textures,
`.tres` materials, GLB meshes, instanced sub-scenes) is loaded from disk, so refreshing
the scene text from disk keeps the text and its dependency closure consistent — a
keystroke-live preview would render buffer text against disk resources and pay a full
re-parse per keystroke. The editing loop VS Code users already have is the real text
editor with its own linting surfaces (Problems panel, Outline, go-to-definition);
keystroke-live preview is the web **Source pane**'s job. Save is the user's explicit
"render this" gesture, matching how the Godot editor picks up externally-edited scenes.

Consequences: `update()`'s content-diff guard dedups the save-event/watcher double-fire;
a refresh is in-place (full text re-sent, React reconciliation), so camera, selection,
and tree expansion survive; **Dependency hot-reload** stays a separate, relevance-gated
per-resource path (no full refresh when only a texture changed).
