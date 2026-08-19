# An uncompiled shader draws Godot's default surface

- Status: Accepted (2026-08-19).
- Related: ADR-0039 (one StandardMaterial3D derivation, two adapters — "Godot's
  default 3D surface" is that derivation's `null` input, which is why both
  adapters can now express it). ADR-0031 (resource slices — the slice claims
  `ShaderMaterial` so it routes here rather than to a missing-resources row).

## Context

We compile no GLSL. A Godot `ShaderMaterial` therefore has no faithful render,
and the previewer has to draw *something* for the surface wearing it.

That decision had been made twice, differently, and neither answer knew about the
other:

- a `ShaderMaterial` arriving as a `.tres` got an invented surface —
  `0xaaccdd`, `opacity 0.5`, an emissive tint — chosen to look conspicuous;
- the same resource arriving as a `[sub_resource]` of the scene resolved to no
  material at all, and so drew Godot's default 3D surface.

Godot cannot tell those two arrivals apart: every material setter takes a
`Ref<Material>`, and where the resource was loaded from is not represented past
the call. So a scene rendered one way or the other depending on a fact the engine
does not model. Six MeshInstance3D nodes across four demo scenes sat on the
silent side of that split.

The invented surface was also cited to **ADR-0004** — an ADR about CSG nodes
rendering as their base primitive, superseded by ADR-0027 and silent on shaders.
No ADR recorded the no-GLSL decision at all, which is how a diagnostic colour
came to look like a settled one.

## Decision

**An uncompiled shader draws the surface Godot binds for a mesh with no usable
material**, from either arrival, and the `logger.warn` carries the diagnosis
instead of the pixels.

That surface is the hardcoded default shader — mid-grey `ALBEDO 0.6`, `ROUGHNESS
0.8`, `METALLIC 0.2` — not a default-constructed `StandardMaterial3D`, which is
white and matte. A `ShaderMaterial` is not a `StandardMaterial3D`, so decoding
its body against that schema would find none of the keys it reads and produce the
white one; both paths therefore decline the resource rather than decode it, and
render the derivation's `null` input.

`buildStandardMaterial` widened to accept that `null` as part of this. It was
narrower than `standardMaterialBag`, the derivation it adapts, and an adapter
narrower than its own derivation forces callers to reinvent the case it dropped —
which is exactly what the invented surface was.

## Consequences

The preview is **best-effort**: it draws the plainest honest surface and reports
what it skipped. It does not put a colour on screen that no scene asked for. A
shader-heavy scene now reads as under-rendered rather than as deliberately
tinted, and the console says which node and why.

The cost is that an unrendered shader is no longer conspicuous in the picture. A
user skimming a scene will not see that a surface was substituted unless they
read the log. That is accepted: a distinctive stand-in is a second wrong answer
layered over the first, and it is the one that misleads a screenshot.

This does not extend to 2D. `useCanvasItemMaterial` resolves an uncompiled shader
to `null` on its own stated grounds, and the shapes are genuinely different: a
`CanvasItemMaterial` modifies how an otherwise-correct sprite composites, so
falling through leaves the sprite right, whereas a 3D material *is* the surface's
entire appearance.
