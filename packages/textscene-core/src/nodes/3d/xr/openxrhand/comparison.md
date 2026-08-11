---
type: OpenXRHand
category: 3D
status: linter-only
fixture: unit-open-xr-hand.tscn
# image: unit-open-xr-hand
visual: false
renders_as: nothing (a transform-only group)
---

# OpenXRHand

OpenXRHand drives a Skeleton3D's bone poses from OpenXR hand-tracking data, repositioning
itself to the tracked palm joint every frame. It draws nothing of its own, so the previewer
renders it as a transform-only group (ADR-0008): its children — typically the hand mesh and
skeleton — still show, at the transform and pose the scene file states, not the live tracked
one.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `hand` | `1` | tracks the player's right hand (`HAND_RIGHT`) |
| `motion_range` | `1` | hand skeleton conforms to the held controller's grip instead of forming a full fist |
| `hand_skeleton` | `NodePath("../Skeleton3D")` | the Skeleton3D whose bone poses get updated |
| `skeleton_rig` | `1` | expects Humanoid bone names (`SKELETON_RIG_HUMANOID`), not OpenXR's own |
| `bone_update` | `1` | only rotates bones to match tracking, preserving the modeled bone lengths |

## Divergences

None visible in this fixture: nothing here changes what a static scene draws, since every
property drives live per-frame tracking data the previewer never has.

## Linting

<!-- lint:begin OpenXRHand -->
Strict parsing format-checks these `OpenXRHand` properties, plus 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `bone_update` | enum 0-1 (Full/Rotation Only) |
| `hand` | enum 0-1 (Left/Right) |
| `hand_skeleton` | NodePath("path/to/node") |
| `motion_range` | enum 0-1 (Unobstructed/Conform to controller) |
| `skeleton_rig` | enum 0-1 (OpenXR/Humanoid) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reads OpenXRHand through `parseNode3D`, so a malformed `hand`,
`motion_range`, `skeleton_rig`, or `bone_update` (say, a bare word instead of an enum
index) is kept as opaque, unparsed text with no substitution or fallback value — there is no
tracked hand pose to fall back to either. Strict parsing is where these are actually read,
and there a bad value is an error, not a lenient default.
