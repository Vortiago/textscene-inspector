# External Resource Test Fixtures

Scenes in `scenes/fixtures/` that exercise external-resource loading
(`[ext_resource]`) and sub-scene instancing. Every path below is a real
`res://` path resolved against `scenes/fixtures/` itself — the directory IS the
namespace, so a reference resolves in Godot, in the web previewer's mirror of
that directory, and in VS Code with that folder open, or in none of them.

## Obvious pass/fail scenes (start here)

### `integration-external-only.tscn`
**What you should see:** ONE blue cube floating in space.
- Parent scene: no geometry at all, just a light and an external scene reference
- External scene: `res://child_cube.tscn`
- **Result:** a blue cube = working; an empty viewport = external scenes not loading.

### `integration-external-separation.tscn`
**What you should see:** a big red box on the LEFT, a small red sphere on the RIGHT.
- Parent scene: the box, authored inline
- External scene: `res://child_sphere.tscn`
- **Result:** both = working; only the box = external scenes not instantiating.

### `integration-three-cubes.tscn`
**What you should see:** THREE blue cubes in a horizontal row.
- Parent scene: no geometry, three instances of `res://child_cube.tscn`
- **Result:** exercises instancing AND caching (one scene, three instances).

## Building blocks

### `child_cube.tscn` / `child_sphere.tscn`
Standalone one-mesh scenes — loadable on their own, and the targets every
instancing fixture above references.

### `integration-parent-child-scene.tscn`
A single external `PackedScene` reference plus locally authored geometry.

### `integration-multiple-externals.tscn`
Three references, one of them a repeat of `res://child_cube.tscn` — pins that a
scene referenced twice is loaded once and instanced twice.

### `integration-instanced-subscene.tscn`
Two instances of `res://unit-instance-child.tscn`, whose roots collapse into the
parent (ADR-0013). Carries a visual golden.

## Deliberately missing references

These scenes exist to show what an UNRESOLVABLE reference looks like, so their
targets are kept out of every `res://` root — they live in
`scenes/upload-payloads/` instead:

| Scene | Reference it cannot resolve | Payload |
| --- | --- | --- |
| `test-missing-material.tscn` | `res://materials/test.tres` | `upload-payloads/test.tres` |
| `test-missing-external-scene.tscn` | `res://subscenes/child.tscn` | `upload-payloads/child.tscn` |
| `unit-external-texture.tscn` | `res://textures/test_texture.png` | none |

`upload-payloads/test-bright-red.tres` and `test-bright-magenta.tres` are
unreferenced by design: they are stand-in albedo materials to drop in when
checking that a supplied material actually reaches the mesh.

## Testing in the web previewer

1. `pnpm --filter @textscene/web-previewer dev`
2. Pick a scene from the **Integration - External Scenes** or
   **Integration - Multi-Node** category.
3. For a missing-resource scene, drag the matching file from
   `scenes/upload-payloads/` onto the previewer — files are matched to missing
   `res://` paths by basename (`src/multiFileUpload.ts`), so the folder layout
   there does not matter.

## Path resolution

| Host | `res://child_cube.tscn` resolves to |
| --- | --- |
| Web previewer | `/fixtures/child_cube.tscn` (the mirror of `scenes/fixtures/`) |
| VS Code | `<workspace root>/child_cube.tscn` |
| `pnpm ref:godot` | `scenes/fixtures/child_cube.tscn` (staged as the project root) |
