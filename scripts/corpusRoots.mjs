/**
 * Vendored corpora under `scenes/` that are `res://` roots with no
 * `project.godot` (the demos keep theirs). Unlisted, a nested scene resolves
 * `res://` against its own folder and Godot silently writes a grey frame. Read by
 * the reference renderer, the sheet resolver and copy-fixtures, which flattens them.
 */
export const FLATTENED_CORPUS_ROOTS = ['isometric', 'ld58'];
