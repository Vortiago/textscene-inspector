# An uncompiled shader draws Godot's default surface

- Status: Accepted.
- Related: ADR-0039 (one StandardMaterial3D derivation, two adapters: "Godot's default
  3D surface" is that derivation's `null` input, which is why both adapters can express
  it), ADR-0031 (resource slices: the slice claims `ShaderMaterial`, so it routes here and
  not to a missing-resources row).

## Context

A `ShaderMaterial` that the previewer does not render as authored (the previewer
compiles no GLSL) still needs a surface. This ADR is about that surface alone. It takes
no position on whether shaders are rendered: see Consequences.

Two separate answers to that question disagree. Without this decision:

- a `ShaderMaterial` that arrives as a `.tres` gets an invented surface (`0xaaccdd`,
  `opacity 0.5`, an emissive tint) chosen to look conspicuous;
- the same resource that arrives as a `[sub_resource]` of the scene resolves to no
  material, and so draws Godot's default 3D surface.

Godot cannot tell those two arrivals apart: each material setter takes a
`Ref<Material>`, and where the resource was loaded from is not represented past the
call. So a scene would render one way or the other on a fact the engine does not model.

## Decision

**A shader the previewer does not render draws the surface Godot binds for a mesh with no
usable material**, from either arrival, and the `logger.warn` carries the diagnosis
instead of the pixels.

The load-bearing half is *from either arrival*. Which surface stands in is a judgement
that can be revisited. That the two arrivals agree is not, because Godot does not model
the difference between them.

That surface is the hardcoded default shader (mid-grey `ALBEDO 0.6`, `ROUGHNESS 0.8`,
`METALLIC 0.2`), not a default-constructed `StandardMaterial3D`, which is white and
matte. A `ShaderMaterial` is not a `StandardMaterial3D`, so to decode its body against
that schema finds none of the keys it reads and produces the white one. Both paths
therefore decline the resource, do not decode it, and render the derivation's `null`
input.

`buildStandardMaterial` accepts that `null`. An adapter narrower than its own derivation
(`standardMaterialBag`) forces callers to reinvent the case it drops, which is what an
invented surface is.

## Consequences

The preview is **best-effort**: it draws the plainest honest surface and reports what it
skipped. It does not put a colour on screen that no scene asked for. A shader-heavy scene
reads as under-rendered, not as deliberately tinted, and the console says which node and
why.

The cost: an unrendered shader is not conspicuous in the picture. A user who skims a
scene does not see that a surface was substituted unless they read the log. That is
accepted: a distinctive stand-in is a second wrong answer over the first, and it is the
one that misleads a screenshot.

**A later best-effort GLSL system does not contradict this.** It would narrow what
reaches this fallback: shaders it handles are rendered, and the rest arrive here as they
do now. The arrival-parity requirement applies to it unchanged: whatever a partly
supported shader draws, its `.tres` and `[sub_resource]` forms must draw the same thing.
Nothing here is a decision not to compile GLSL. That is a capability the previewer does
not have, not a position, and this ADR survives it.

This does not extend to 2D. `useCanvasItemMaterial` resolves an uncompiled shader to
`null` on its own stated grounds, and the shapes differ: a `CanvasItemMaterial` modifies
how an otherwise-correct sprite composites, so a fall-through leaves the sprite right,
while a 3D material *is* the surface's whole appearance.
