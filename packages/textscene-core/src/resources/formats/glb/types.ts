/**
 * Types the GLB slice owns.
 */

/**
 * An **Import sidecar**'s root-scale correction, already validated (ADR-0028):
 * `scale` is finite and positive, and `bake` mirrors Godot's
 * `nodes/apply_root_scale`. Produced by `importRootScale` (a foreign-format
 * parser that stays in `parser/`, since a sidecar is found by path convention),
 * consumed by `applyRootScale`.
 */
export interface RootScale {
  scale: number;
  bake: boolean;
}
