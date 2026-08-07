---
type: PhysicalBoneSimulator3D
category: 3D
status: linter-only
fixture: unit-physical-bone-simulator-3d.tscn
# image: unit-physical-bone-simulator-3d
visual: false
renders_as: nothing (a transform-only group)
---

# PhysicalBoneSimulator3D

PhysicalBoneSimulator3D is the ragdoll driver: it collects the `PhysicalBone3D` nodes
beneath it, hands them over to the physics server when simulation starts, and writes the
bodies' resulting poses back onto a parent `Skeleton3D` each frame. It draws nothing at
runtime, so the previewer renders it as a transform-only group (ADR-0008): its children
still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)` | Node3D's key, lifting the group one unit up; no visible mark, since the node draws nothing and the fixture gives it no children |
| `influence` | `0.75` | SkeletonModifier3D's key, blending the modifier's result against the incoming pose; inert in the previewer, which runs no modifier |

PhysicalBoneSimulator3D itself contributes no property to set. Its parameters are not
its own: they belong to the `PhysicalBone3D` children it drives, which are a separate
type with a separate slice, so a scene tunes the ragdoll bone by bone rather than on the
simulator. What the simulator holds is runtime state, a `simulating` flag and a cache of
bone poses rebuilt from the live skeleton, none of it serialised. Every key a `.tscn` may
carry on one therefore reaches it through the base-walk from SkeletonModifier3D up, and
the lint block below lists that inherited surface.

The fixture places it under a `Skeleton3D`, the only parent where a SkeletonModifier3D
does anything, and gives its inherited keys non-default values, since the defaults Godot
omits from the file would exercise nothing. Neither key changes the capture: the
simulation this node exists to run only starts at runtime, so in a Godot editor preview
the bones sit in their rest pose too.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin PhysicalBoneSimulator3D -->
Strict parsing format-checks the inherited set (2 inherited from SkeletonModifier3D, 16 inherited from Node3D, 10 inherited from Node); `PhysicalBoneSimulator3D` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

PhysicalBoneSimulator3D declares no validator of its own, because Godot gives it no
property of its own: `_bind_methods` binds five methods and zero `ADD_PROPERTY`, and the
class takes none of the other three routes into a `.tscn` either, so a real instance's
storage property list is identical to a bare SkeletonModifier3D's. The strict parser
checks it entirely against the inherited set. It also has no `parser.ts`: `index.ts`
registers `parseNode3D` directly. A value strict rejects is therefore dropped rather than
substituted, and there is no PhysicalBoneSimulator3D-specific fallback for the two
parsers to disagree about.
