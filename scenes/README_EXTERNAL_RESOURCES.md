# External resource fixtures

The scenes in `scenes/fixtures/` that test `[ext_resource]` loading and sub-scene instancing. Each `res://` path resolves against `scenes/fixtures/`.

## Pass or fail at a glance

| Scene | Pass | Fail |
| --- | --- | --- |
| `integration-external-only.tscn` | One blue cube | An empty viewport |
| `integration-external-separation.tscn` | A red box and a red sphere | Only the box |
| `integration-three-cubes.tscn` | Three blue cubes in a row | Fewer than three |

## Other instancing scenes

| Scene | Tests |
| --- | --- |
| `child_cube.tscn`, `child_sphere.tscn` | One-mesh scenes that the others instance |
| `integration-parent-child-scene.tscn` | One `PackedScene` beside local geometry |
| `integration-multiple-externals.tscn` | A scene referenced twice loads once |
| `integration-instanced-subscene.tscn` | Instanced roots collapse into the parent (ADR-0013). It has a golden image. |

## Missing on purpose

These references resolve nowhere. The files are in `scenes/upload-payloads/`, outside every root.

| Scene | Missing reference | File to upload |
| --- | --- | --- |
| `test-missing-material.tscn` | `res://materials/test.tres` | `test.tres` |
| `test-missing-external-scene.tscn` | `res://subscenes/child.tscn` | `child.tscn` |
| `unit-external-texture.tscn` | `res://textures/test_texture.png` | None |

`test-bright-red.tres` and `test-bright-magenta.tres` in `upload-payloads/` are spare albedo materials. Upload one to check that a material reaches the mesh.

To test an upload in the web previewer, drag the file onto the page. The previewer matches a file to a missing path by its name (`src/multiFileUpload.ts`).
