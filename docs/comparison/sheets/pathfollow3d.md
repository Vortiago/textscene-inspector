---
type: PathFollow3D
category: 3D
fixture: unit-pathfollow-3d.tscn
image: unit-pathfollow-3d
renders_as: a curve-positioned transform group
---

# PathFollow3D

PathFollow3D positions its children a set distance along its parent Path3D's
curve. The previewer samples the curve and drives a transform group to that point;
here it carries an orange box that lands at the arc-length midpoint of the
U-shaped track, one node in the row of blue marker boxes that trace the curve. Its
editor follow-point gizmo is selection-gated (ADR-0018), so a plain capture shows
only the box the follower carries.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `progress` | `3.0528675` | absolute distance in metres along the curve; at instantiation Godot honours this value, placing the follower at the arc-length midpoint — the bottom of the U at `(0, 0, -1.4)` |
| `progress_ratio` | `0.5` | the same midpoint expressed as a fraction of arc length; the fixture pins it to agree with `progress` so both renderers resolve the follower to one point |
| `transform` | translation `(0, 0, -1.4)` | normally overridden by `progress`, but authored to the same midpoint so any resolution path lands the box identically |

## Divergences

The orange follower box lands at the bottom of the U at `(0, 0, -1.4)` in both
images, beside the same blue marker — placement agrees. Shadows differ in edge
softness: the reference box and markers cast crisp, dark footprints in Godot, while
the previewer's directional light applies softer, more diffuse shadow filtering —
most visible under the large reference box. This is a global shadow difference, not
PathFollow3D behaviour.
