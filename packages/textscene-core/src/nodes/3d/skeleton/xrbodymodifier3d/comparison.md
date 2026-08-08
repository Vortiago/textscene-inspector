---
type: XRBodyModifier3D
category: 3D
status: linter-only
fixture: unit-xr-body-modifier-3d.tscn
# image: unit-xr-body-modifier-3d
visual: false
renders_as: a transform-only group
---

# XRBodyModifier3D

XRBodyModifier3D poses the bones of its parent Skeleton3D from an XRBodyTracker registered
with XRServer, so with no headset attached it has no tracker to read and moves nothing. It
draws nothing of its own either, so the previewer renders it as a transform-only group
(ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)` | places the group one unit up; its children inherit the offset |
| `influence` | `0.75` | inherited from SkeletonModifier3D, blends the tracked pose in at 75 percent, no visible mark |
| `body_tracker` | `&"/user/full_body_tracker"` | the XRServer tracker name the pose is read from, off the `/user/body_tracker` default so Godot would save the line, no visible mark |
| `body_update` | `3` | BODY_UPDATE_UPPER_BODY and BODY_UPDATE_LOWER_BODY, hands left out, no visible mark |
| `bone_update` | `1` | BONE_UPDATE_ROTATION_ONLY, so bones rotate but keep their rest lengths, no visible mark |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin XRBodyModifier3D -->
Strict parsing format-checks these `XRBodyModifier3D` properties, plus 2 inherited from SkeletonModifier3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `body_tracker` | quoted string or &"name" |
| `body_update` | bit mask of BODY_UPDATE_UPPER_BODY (1) | BODY_UPDATE_LOWER_BODY (2) | BODY_UPDATE_HANDS (4) |
| `bone_update` | enum 0-1 (BONE_UPDATE_FULL/BONE_UPDATE_ROTATION_ONLY) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

XRBodyModifier3D has no `parser.ts` of its own: it registers `parseNode3D` directly
(index.ts), so `body_tracker`, `body_update` and `bone_update` are never read by the
lenient parser at all. A malformed value is dropped rather than substituted, and there is
no fallback to name, because nothing downstream of the parse consumes any of the three.

Two facts the strict side reports and the sheet is the only place to record. The two
integer properties sit next to each other and take opposite tiers, which is the whole
reason to read the setters rather than the hints: `body_update` bare-assigns, so a bit past
the three the inspector lists survives the load and is merely unreachable from the editor
(warning), while `bone_update` opens with an `ERR_FAIL_INDEX` against `BONE_UPDATE_MAX`, so
2 is refused outright and the previous value stands (error). And `body_tracker` is declared
`Variant::STRING` yet its getter returns `StringName`, so Godot writes it `&"..."`; the
validator takes that spelling and the plain quoted one, since the variant text parser reads
both and hand-written scenes carry both.
