/** Types the GLB slice owns. */

/**
 * An **Import sidecar**'s root-scale correction, already validated (ADR-0028): `scale`
 * is finite and positive, and `bake` mirrors Godot's `nodes/apply_root_scale`. The
 * `importRootScale` parser in `parser/` produces it, since a sidecar is found by path
 * convention, and `applyRootScale` consumes it.
 */
export interface RootScale {
  scale: number;
  bake: boolean;
}
