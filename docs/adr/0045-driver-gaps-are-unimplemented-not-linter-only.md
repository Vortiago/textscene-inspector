# Driver gaps are `unimplemented`, not `linter-only`

- Status: Accepted (2026-10-02).
- Related: ADR-0008 (invisible render intent: `transform-only` stays the claim that
  the node's own geometry is nil), ADR-0005 (physics bodies are transform-only by
  design, not by omission), ADR-0031 (resource slices share the status vocabulary).

## Context

`linter-only` on a comparison sheet claims the node's runtime effect is nil: it
draws nothing and moves nothing, so there is no render to assess. Skeleton
modifiers, IK solvers, the XR pose writers (`XRBodyModifier3D`,
`XRHandModifier3D`, `OpenXRHand`), the blend-shape writer `XRFaceModifier3D`,
the XR render-model nodes and RemoteTransform all claimed it.
Each has a real Godot runtime effect: a `SkeletonModifier3D` feeds bone poses
through `Skeleton3D::_process_modifiers` (`skeleton_3d.cpp:1166`), a
`RemoteTransform3D` relays its transform every frame
(`remote_transform_3d.cpp`, `_update_transform`), and an `OpenXRRenderModel`
mounts a child scene (`openxr_render_model.cpp:72`, `add_child`). Calling those
nil-effect was a false claim, and the taxonomy forced it: a gap had no legal
combination, because `transform-only` plus `unimplemented` is refused, so a
mislabel could only land on `linter-only`.

## Decision

**The status axis is completeness of the node's runtime effect, not geometry.**
Geometry decides only the finished nil case.

| Godot effect | Previewer | Registration | Sheet status |
| --- | --- | --- | --- |
| Draws | draws | `draws` (default) | `done` / `limitation` / `unreviewed` |
| Drives, driving implemented | drives | `transform-only` (+ `scenePass`) | `done` / `limitation` |
| Draws or drives, missing | gap | `pending` (base kept, badge shows gap) | `unimplemented` |
| Nil (no geometry, no drive) | nil | `transform-only`, no `scenePass` | `linter-only` |

`unimplemented` widens to "Godot has a runtime effect for it, own draw or
driving, and the previewer does not implement it yet". `linter-only` keeps
"runtime effect genuinely nil". A driver gap registers `pending` on its base
component, so `visible`, the workspace split and every golden are unchanged; only
the badge moves to the gap. Two guards in `sheets.test.mjs` hold the line: a type
in `runtimeEffectNodes.data.mjs` (every driver and self-drawing type, each with
its engine cite) may not claim `linter-only`, and a registration carrying a
`scenePass` may not either.

## Considered Options

- **A new status value** (`driver-gap`): rejected. It duplicates `unimplemented`
  one axis over, and the gallery, nav and rollup all key off the five existing
  values.
- **Keep `transform-only` on the gaps and only fix the sheets**: rejected. The
  registry's `rendersOwnVisual` reads the intent, and the outliner badge is the
  user-visible half of the honesty; a `transform-only` registration says
  "complete while invisible" (ADR-0008), which is the claim under repair.
- **Treat session-fed draws and drives as nil-effect**: rejected for what a
  session makes a node do to the scene, write bone poses or mount a model. The
  absence here is a missing implementation, the same shape as the XR composition
  layers already marked `unimplemented`. A session that updates only a node's
  own transform is the keep-list below, not a drive of another node.

## Consequences

The ledger of runtime effects is `runtimeEffectNodes.data.mjs`: a type absent
from it claims a nil effect. Deliberate exclusions keep `linter-only`, because
the previewer's contract says their effect is nil here, not missing: physics
bodies and joints, `PhysicalBone2D`/`PhysicalBone3D` ragdoll physics (ADR-0005
settled these as transform-only by design), navigation nodes, `BackBufferCopy`,
`VisibleOnScreenNotifier`/`Enabler`, `SpringArm3D`, `OccluderInstance3D`, and
`Skeleton2D`/`Bone2D` (no 2D IK slice exists, so Skeleton2D drives nothing
here). The XR trackers (`XRNode3D`, `XRController3D`, `XROrigin3D`,
`XRAnchor3D`) stay too: a session updates only their own transform, their
children ride the normal hierarchy the previewer renders, and they drive no
other node.
`RemoteTransform2D`/`3D` are the middle row: the relay is implemented once at
load, so their sheets move to `limitation`, not to a gap.
