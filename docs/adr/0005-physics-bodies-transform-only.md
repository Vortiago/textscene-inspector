# Physics bodies render as transform-only groups

`StaticBody3D`, `RigidBody3D`, `CharacterBody3D`, `Area3D` and their 2D equivalents render as transform-only `<group>`s that position their children, with no physics simulation and no geometry of their own. Their collision shapes show only through the collision gizmo toggle, which is off by default (ADR-0006).

A static previewer shows where things are, not how they move. The cost: the viewer never shows motion, gravity or collision response, and a `RigidBody3D` looks identical to a plain Node3D except for its node type in the tree. The omission of physics behaviour is deliberate.

The parsers reuse the Node3D transform parse. Only the collision-shape resources of `CollisionShape3D` (BoxShape3D, ConvexPolygonShape3D, ConcavePolygonShape3D) need new geometry code.
