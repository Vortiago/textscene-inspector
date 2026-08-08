---
type: SkeletonIK3D
category: 3D
status: linter-only
fixture: unit-skeleton-ik-3d.tscn
# image: unit-skeleton-ik-3d
visual: false
renders_as: nothing (a transform-only group)
---

# SkeletonIK3D

A FABRIK chain solver: it walks the bones from `root_bone` to `tip_bone`, drags the
tip onto a target transform over up to `max_iterations` passes, and writes the
result into the parent Skeleton3D's global pose override. Godot deprecates it in
4.x in favour of the newer SkeletonModifier3D solvers, and its class registration
sits behind `#ifndef DISABLE_DEPRECATED`, but a stock build still saves and reloads
every key below. It draws nothing at runtime, so the previewer renders it as a
transform-only group (ADR-0008): its children still show, and that absence is the
whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `root_bone` | `&"UpperArm"` | first bone of the chain, by name |
| `tip_bone` | `&"Hand"` | last bone, the one placed on the target |
| `target` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.5, 1.2, 0.25)` | fallback goal, used whenever `target_node` does not resolve |
| `target_node` | `NodePath("../../Target")` | the node (a sibling of the required Skeleton3D parent) whose transform overrides `target` |
| `override_tip_basis` | `false` | the tip keeps its own rotation instead of the target's |
| `use_magnet` | `true` | the solver consults the pole target |
| `magnet` | `Vector3(0, 0.5, 1)` | pole position that decides which way the chain bends |
| `min_distance` | `0.05` | iteration stops once the tip is this close, in metres |
| `max_iterations` | `16` | solver passes per frame |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin SkeletonIK3D -->
Strict parsing format-checks these `SkeletonIK3D` properties, plus 2 inherited from SkeletonModifier3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `magnet` | Vector3(x, y, z) |
| `max_iterations` | integer |
| `min_distance` | float |
| `override_tip_basis` | true or false |
| `root_bone` | quoted string or &"name" |
| `target` | Transform3D(12 floats) |
| `target_node` | NodePath("path/to/node") |
| `tip_bone` | quoted string or &"name" |
| `use_magnet` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, so it reads the node's transform and
nothing else: all nine keys above are dropped rather than substituted, and no
fallback value exists to name. Strict parsing is the only place they are read, and
it is format checking alone — every setter in `skeleton_ik_3d.cpp` is a bare
assignment, so nothing this node carries can be out of range. In particular
`min_distance` and `max_iterations` take negatives, `magnet` takes `inf` and `nan`
components, and a bone name matching no bone in the skeleton is accepted, because
Godot's own inspector enum for `root_bone` and `tip_bone` is built from live
Skeleton3D state and exists only in the editor. The deprecated `interpolation`
alias never appears in a saved scene, so neither parser has anything to say about
it; the value it forwarded to lives on `influence`, inherited from
SkeletonModifier3D.
