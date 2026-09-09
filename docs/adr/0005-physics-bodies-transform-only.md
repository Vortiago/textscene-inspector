# Physics bodies render as transform-only groups

`StaticBody3D`, `RigidBody3D`, `CharacterBody3D`, `Area3D` (and their 2D equivalents) render as transform-only `<group>`s that position their children, with no physics simulation and no geometry of their own. Their collision shapes are visible only through the toggleable collision gizmo, which is off by default (ADR-0006).

This matches a static previewer's purpose: the tool shows where things are, not how they move. The trade-off is that the viewer never depicts motion, gravity, or collision response. A `RigidBody3D` looks identical to a plain Node3D except for its node type in the tree.

The parsers reuse the Node3D transform parse. Only `CollisionShape3D`'s collision-shape resources (BoxShape3D, ConvexPolygonShape3D, ConcavePolygonShape3D) are genuinely new geometry code.

Recorded because a future reader may expect physics behaviour from these node types and should know its omission is deliberate.
