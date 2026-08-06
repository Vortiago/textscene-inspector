---
type: SpringBoneCollisionPlane3D
category: 3D
status: linter-only
fixture: unit-spring-bone-collision-plane-3d.tscn
# image: unit-spring-bone-collision-plane-3d
visual: false
renders_as: a transform-only group
---

# SpringBoneCollisionPlane3D

SpringBoneCollisionPlane3D is an infinite XZ plane that pushes a SpringBoneSimulator3D's
bones back along its normal, the +Y axis after the node's rotation. It draws nothing at
runtime, and being unbounded there is nothing it could draw; its shape exists only as an
editor gizmo. So the previewer renders it as a transform-only group (ADR-0008), its
children still land in the right transform space, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)` | places the node one unit above its parent, no visible mark |
| `bone_name` | `&"Head"` | names the bone the plane follows, no visible mark |
| `bone` | `0` | index of that bone, written beside the name, no visible mark |
| `position_offset` | `Vector3(0, -0.25, 0)` | drops the plane a quarter unit below the bone pose position, no visible mark |
| `rotation_offset` | `Quaternion(0.3826834, 0, 0, 0.9238795)` | tilts the normal 45 degrees about X, so the plane is a slope rather than a floor, no visible mark |

Every one of them is inherited. SpringBoneCollisionPlane3D binds no property of its own
by any route, and `doc/classes/SpringBoneCollisionPlane3D.xml` has no members section at
all, so the table can only hold SpringBoneCollision3D's keys plus the Node3D transform:
an infinite plane needs no radius, height or extent, and the offsets are the whole of its
placement.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin SpringBoneCollisionPlane3D -->
Strict parsing format-checks the inherited set (4 inherited from SpringBoneCollision3D, 16 inherited from Node3D, 10 inherited from Node); `SpringBoneCollisionPlane3D` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-springbonecollision3d-parent` (type-family match) | `springbonecollision3d-outside-springbonesimulator3d` | warning |
<!-- lint:end -->

SpringBoneCollisionPlane3D declares no validator of its own, and never will: it binds no
property, so there is no key on which the strict and lenient parsers could disagree. It
has no `parser.ts` either, registering `parseNode3D` directly (index.ts), so the
inherited `bone_name`, `bone`, `position_offset` and `rotation_offset` are never read by
the lenient side at all. A malformed one is silently dropped rather than substituted,
while strict parsing reports it as an error through SpringBoneCollision3D's validators.
One semantic rule does reach this type: `valid-springbonecollision3d-parent` matches
every descendant of SpringBoneCollision3D, so a plane anywhere but directly under a
SpringBoneSimulator3D is warned about as inert, which is why the fixture parents it under
one.
