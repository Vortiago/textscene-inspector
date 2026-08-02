---
type: SpringBoneCollision3D
category: 3D
status: linter-only
fixture: unit-spring-bone-collision-3d.tscn
# image: unit-spring-bone-collision-3d
visual: false
renders_as: a transform-only group
---

# SpringBoneCollision3D

SpringBoneCollision3D is a collider a SpringBoneSimulator3D consults while resolving its
spring bones each frame; it draws nothing at runtime — its editor gizmo is an editor-only
aid, not a runtime visual — so the previewer renders it as a transform-only group
(ADR-0008), and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `bone_name` | `"Head"` | names the bone the collider follows — no visible mark |
| `bone` | `0` | index of the attached bone — no visible mark |
| `position_offset` | `Vector3(0, 0.05, 0)` | offset from the bone pose position — no visible mark |
| `rotation_offset` | `Quaternion(0, 0.7071068, 0, 0.7071068)` | 90° offset from the bone pose rotation — no visible mark |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin SpringBoneCollision3D -->
Strict parsing format-checks these `SpringBoneCollision3D` properties, plus 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `bone` | integer |
| `bone_name` | quoted string or &"name" |
| `position_offset` | Vector3(x, y, z) |
| `rotation_offset` | Quaternion(x, y, z, w) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-springbonecollision3d-parent` (type-family match) | `springbonecollision3d-outside-springbonesimulator3d` | warning |
<!-- lint:end -->

SpringBoneCollision3D has no `parser.ts` of its own: it registers `parseNode3D` directly
(index.ts), so `bone_name`, `bone`, `position_offset`, and `rotation_offset` are never
read at all, valid or not — an unquoted `bone_name = Head` or a non-numeric
`bone = abc` is silently dropped rather than substituted or warned on, consistent with
the node rendering as a transform-only group (ADR-0008).
