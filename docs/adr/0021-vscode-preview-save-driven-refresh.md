# ADR 0021: VS Code preview refresh is save-driven, not keystroke-driven

- Status: Accepted

The **Preview panel** mirrors the `.tscn` file **on disk**. It refreshes on document save
and on external disk changes that the resource watcher catches (git pull, branch switch),
and reads content from the filesystem. Unsaved editor keystrokes never render. This is a
deliberate asymmetry with the live-typed **Source pane** of the web previewer (ADR-0020),
not a gap to close.

Why disk truth wins in VS Code: every dependency the scene renders with (textures,
`.tres` materials, GLB meshes, instanced sub-scenes) loads from disk. A refresh of the
scene text from disk keeps the text and its dependency closure consistent. A
keystroke-live preview renders buffer text against disk resources and pays a full
parse per keystroke. VS Code users already edit in the real text editor with its own
linting surfaces (Problems panel, Outline, go-to-definition). Keystroke-live preview is
the job of the web **Source pane**. Save is the user's explicit "render this" gesture,
like the way the Godot editor picks up externally-edited scenes.

Consequences: the content-diff guard of `update()` removes the duplicate from the
save-event/watcher double-fire. A refresh is in-place (full text sent again, React
reconciliation), so camera, selection and tree expansion survive. **Dependency hot-reload**
stays a separate, relevance-gated per-resource path (no full refresh when only a texture
changes).
