/**
 * Vendored corpora under `scenes/` that are `res://` roots but carry no
 * `project.godot` to say so.
 *
 * Each is a closure lifted out of a Godot project: its scenes reference
 * siblings as `res://<subdir>/<file>`, which only resolves if the corpus
 * DIRECTORY is the root. Without a marker file, anything that walks up looking
 * for `project.godot` falls back to the scene's own folder — and a scene one
 * level down (`player/goblin.tscn`) then resolves `res://player/goblin.png`
 * against `player/`, finds nothing, and renders an empty viewport. That failure
 * is silent: Godot exits 0 and writes a flat grey frame, so a blank reference
 * image looks like a successful capture.
 *
 * The vendored demos under `scenes/demos/` are NOT listed — each keeps its own
 * `project.godot` and resolves the ordinary way.
 *
 * Three places must agree on this list: the Godot reference renderer (the
 * `res://` root it stages), the sheet resolver (a previewer `?fixture=` id back
 * to a repo path), and copy-fixtures (which flattens these onto the previewer's
 * fixtures root, which is WHY the ids look the way they do).
 */
export const FLATTENED_CORPUS_ROOTS = ['isometric', 'ld58'];
