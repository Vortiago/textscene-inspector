---
type: FABRIK3D
category: 3D
status: linter-only
fixture: unit-fabrik-3d.tscn
# image: unit-fabrik-3d
visual: false
renders_as: nothing (a transform-only group)
---

# FABRIK3D

FABRIK3D is the position-based IK solver: each frame it drags a bone chain onto its
target with a backward reaching pass followed by a forward one, writing the result into
a parent Skeleton3D's poses. It draws nothing at runtime, so the previewer renders it as
a transform-only group (ADR-0008): its children still show, and that absence is the
whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)` | Node3D's key, lifting the group one unit up; no visible mark, since the node draws nothing and the fixture gives it no children |

FABRIK3D itself contributes no property to set: it binds no `ADD_PROPERTY` and overrides
no property-list hook, so every key a `.tscn` may carry on one, the solver parameters
and the `settings/` chain array alike, reaches it through the base-walk from IterateIK3D
up. The lint block below lists that inherited surface.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin FABRIK3D -->
Strict parsing format-checks the inherited set (6 inherited from IterateIK3D, 1 inherited from IKModifier3D, 2 inherited from SkeletonModifier3D, 17 inherited from Node3D, 10 inherited from Node); `FABRIK3D` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
| `valid-iterateik3d-target-node` (type-family match) | `iterateik3d-setting-missing-target-node` | warning |
<!-- lint:end -->

FABRIK3D declares no validator of its own, because Godot gives it no property of its
own; the strict parser checks it entirely against the inherited set. It also has no
`parser.ts`: `index.ts` registers `parseNode3D` directly, so the solver keys are never
read by the lenient parser at all. A value strict rejects is therefore dropped rather
than substituted, and there is no FABRIK3D-specific fallback for the two parsers to
disagree about.
