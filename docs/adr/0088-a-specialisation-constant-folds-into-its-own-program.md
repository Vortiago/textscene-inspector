# A specialisation constant folds into its own program

- Status: Accepted.
- Related: ADR-0076 (Godot's shaders run through one transpiler).

## Context

Godot's scene shaders read specialisation constants: `layout(constant_id = N) const` globals such as `pso_sc_packed_0`, whose bit 6 turns on the depth fog (`scene_forward_clustered_inc.glsl:63, 101`). Godot sets them for each render and builds one pipeline for each set of values (`render_forward_clustered.cpp:2083-2084`). The driver then folds each constant, so a branch on it costs nothing.

WebGL has no specialisation constants. A uniform in place of the constant was measured on the previewer's software GL (SwiftShader): `unit-spatial-shader-fog.tscn` blocked the main thread for 403 s, against 2.6 to 3.9 s with the constant folded as a literal. A uniform masked to the one bit took as long.

## Decision

**The emitter folds each specialisation constant as a TSL literal of its value, and each value gets its own program.**

- `Specialisation` holds the value and the materials that read it. `TemplateUniforms.specialisations` maps each constant to its holder, apart from the uniforms.
- A binding table writes a value as it writes a uniform. A new value tells each reader, and each reader emits its stages again: three keeps the first build of a function, so the same nodes cannot take a new literal.
- `BoundNodeMaterial.customProgramCacheKey` adds the values, so three keeps one program for each set of values and reuses it.
- The colour draw of a surface writes the constants, before three keys the first program (`onBeforeProgram`) and before each later draw. A shadow or depth draw writes none.

## Consequences

- A change of value emits the stages again and, the first time, compiles a program. The previewer sees this when the fog mode changes, not on each frame.
- The depth variant gets a program for each value too, as Godot's depth pre-pass gets the same specialisation (`render_forward_clustered.cpp:2108`).
- A new constant needs only a binding row: the emitter and the material already fold and key it.
