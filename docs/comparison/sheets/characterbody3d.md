---
type: CharacterBody3D
category: 3D
fixture: unit-characterbody3d.tscn
image: unit-characterbody3d
renders_as: a transform-only Node3D group
---

# CharacterBody3D

CharacterBody3D is a physics body with no visual of its own — it renders as a
transform-only group (ADR-0005, ADR-0008), reusing the Node3D component. The blue
capsule on screen is its child MeshInstance3D (a CapsuleMesh with a blue
StandardMaterial3D); the sibling CollisionShape3D is selection-gated and draws
nothing in a plain capture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `origin (0, 0.8, 0)` | lifts the group so the capsule floats centered above the origin |
| `velocity` | `Vector3(0, 0, 0)` | runtime physics state; no visual effect in a static preview |

## Divergences

None visible in this fixture.
