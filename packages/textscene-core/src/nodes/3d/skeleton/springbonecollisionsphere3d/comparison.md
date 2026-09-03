---
type: SpringBoneCollisionSphere3D
category: 3D
status: linter-only
fixture: unit-spring-bone-collision-sphere-3d.tscn
# image: unit-spring-bone-collision-sphere-3d
visual: false
renders_as: a transform-only group
---

# SpringBoneCollisionSphere3D

SpringBoneCollisionSphere3D is the sphere collider a SpringBoneSimulator3D consults while
resolving its spring bones; the sphere itself is an editor gizmo, not a runtime visual, so
the previewer renders it as a transform-only group (ADR-0008) and that absence is the whole
story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `radius` | `0.25` | the sphere's radius, in metres, that bones are pushed off; no visible mark |
| `inside` | `true` | traps the joint inside the sphere instead of outside it; no visible mark |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin SpringBoneCollisionSphere3D -->
Strict parsing format-checks these `SpringBoneCollisionSphere3D` properties, plus 4 inherited from SpringBoneCollision3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `inside` | true or false |  |
| `radius` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-springbonecollision3d-parent` (type-family match) | `springbonecollision3d-outside-springbonesimulator3d` | warning |
<!-- lint:end -->

SpringBoneCollisionSphere3D has no `parser.ts` of its own: it registers `parseNode3D`
directly (index.ts), so neither `radius` nor `inside` is ever read, valid or not. A
malformed `radius = wide` or `inside = 1` is silently dropped by the lenient parser rather
than substituted with a default, while the strict parser reports it; because the node draws
nothing either way, the two paths agree on the picture and the divergence is confined to the
diagnostics list.
