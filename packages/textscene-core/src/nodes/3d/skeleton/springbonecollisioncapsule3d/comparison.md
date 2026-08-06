---
type: SpringBoneCollisionCapsule3D
category: 3D
status: linter-only
fixture: unit-spring-bone-collision-capsule-3d.tscn
# image: unit-spring-bone-collision-capsule-3d
visual: false
renders_as: a transform-only group
---

# SpringBoneCollisionCapsule3D

SpringBoneCollisionCapsule3D is the capsule-shaped collider a SpringBoneSimulator3D
consults while resolving its spring bones each frame. The capsule exists only as an
editor gizmo, never as runtime geometry, so the previewer renders the node as a
transform-only group (ADR-0008) and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `radius` | `0.15` | the capsule's radius, and the radius of both hemispheres; no visible mark |
| `height` | `1.0` | the capsule's full height including the hemispheres; no visible mark |
| `inside` | `true` | traps the joint inside the capsule instead of pushing it out; no visible mark |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin SpringBoneCollisionCapsule3D -->
Strict parsing format-checks these `SpringBoneCollisionCapsule3D` properties, plus 4 inherited from SpringBoneCollision3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `height` | float >= 0 |
| `inside` | true or false |
| `radius` | float >= 0 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-springbonecollision3d-parent` (type-family match) | `springbonecollision3d-outside-springbonesimulator3d` | warning |
| `valid-springbonecollisioncapsule3d-shape` | `springbonecollisioncapsule3d-radius-exceeds-half-height` | warning |
<!-- lint:end -->

SpringBoneCollisionCapsule3D has no `parser.ts` of its own: it registers `parseNode3D`
directly (index.ts), so `radius`, `height` and `inside` are never read at all, valid or
not. The lenient parser substitutes nothing and warns about nothing for them, which is
consistent with the node rendering as a transform-only group (ADR-0008).

Where strict linting has something to say, it is about the pair rather than either
value. Godot's own setters keep `radius` at or below `height * 0.5`, each restoring the
invariant by rewriting the OTHER property, so a scene that writes both with a radius
above half the height loads as a different capsule than the one on disk. Which half
moves depends on the order the two keys appear in the file, so the rule reports the
contradiction and does not predict the outcome. Neither float has a checkable ceiling:
their shared `PROPERTY_HINT_RANGE` carries `,or_greater`, and a negative one is outside
that hint but assigned straight through by the setter, so it warns rather than errors.
