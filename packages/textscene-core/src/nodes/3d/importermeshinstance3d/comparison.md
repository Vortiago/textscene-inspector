---
type: ImporterMeshInstance3D
category: 3D
status: linter-only
fixture: unit-importer-mesh-instance-3d.tscn
# image: unit-importer-mesh-instance-3d
visual: false
renders_as: nothing (a transform-only group)
---

# ImporterMeshInstance3D

Carries every mesh-rendering key a real MeshInstance3D would (a mesh, a skin, cast_shadow, layer_mask, the visibility-range fade), but it inherits Node3D rather than VisualInstance3D and exists only inside the import pipeline — Godot's importer replaces it with a real MeshInstance3D before the scene ever runs, so it draws nothing at runtime, not because it lacks a feature but because it is never the thing that renders. The previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `mesh` | `SubResource("ImporterMesh_1")` | the import-time mesh reference; never drawn |
| `skin` | `SubResource("Skin_1")` | the import-time skin reference; never drawn |
| `skeleton_path` | `NodePath("../Skeleton3D")` | which Skeleton3D the skin binds to at import time |
| `layer_mask` | `3` | render layers the eventual MeshInstance3D inherits |
| `cast_shadow` | `1` (On) | shadow-casting mode the eventual MeshInstance3D inherits |
| `visibility_range_begin` | `0.0` | LOD fade-in distance, never evaluated at runtime |
| `visibility_range_begin_margin` | `1.0` | LOD fade-in margin, never evaluated at runtime |
| `visibility_range_end` | `100.0` | LOD fade-out distance, never evaluated at runtime |
| `visibility_range_end_margin` | `2.0` | LOD fade-out margin, never evaluated at runtime |
| `visibility_range_fade_mode` | `1` (Self) | LOD fade mode, never evaluated at runtime |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin ImporterMeshInstance3D -->
Strict parsing format-checks these `ImporterMeshInstance3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `cast_shadow` | enum 0-3 (OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY) |
| `layer_mask` | 32-bit layer mask (layers 1-32) |
| `mesh` | null, SubResource("id") or ExtResource("id") |
| `skeleton_path` | NodePath("path/to/node") |
| `skin` | null, SubResource("id") or ExtResource("id") |
| `visibility_range_begin` | float >= 0 |
| `visibility_range_begin_margin` | float >= 0 |
| `visibility_range_end` | float >= 0 |
| `visibility_range_end_margin` | float >= 0 |
| `visibility_range_fade_mode` | enum 0-2 (DISABLED/SELF/DEPENDENCIES) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

`parser.ts` reuses the plain `parseNode` reader, which decodes only `transform`
from this node's properties — mesh, skin, layer_mask, cast_shadow and every
visibility_range_* key are validated by the strict parser but never decoded by
the lenient one, so a malformed value there changes nothing about what renders.
`transform` is the one exception with a real fallback: `parseNode` warns and
substitutes the identity transform rather than the value strict parsing rejects.
