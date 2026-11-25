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
- A constant starts at Godot's default for the pipeline, not at the template's declared value. `TemplateUniforms.presetSpecialisation` gives the first emit that value, so the first draw keeps the stages it starts with.

**A block member that holds one value for each frame folds the same way.** Godot reads such members at run time, so its driver keeps their samplers. WebGL 2 counts every sampler the program reads and guarantees 16, and the lit template reads 24.

- `ProgramTemplate.specialisedMembers` names the members, from the rows of a binding table (`EFFECT_SPECIALISATIONS`). `TemplateUniforms` gives each one a `Specialisation`, not a uniform.
- The emitter folds an `if` whose condition rests on literals, read through struct members and constructors: `if (bool(implementation_data.ss_effects_flags & 1u))`. It emits only the branch taken, so the program reads no sampler of the other. A `?:` on such a condition emits only the operand taken.
- A guard that rests on a call folds when the function's body is one `return` of literals, as `sc_use_forward_gi()`. ANGLE folds a literal condition, but not one behind a call.

## Consequences

- A change of value emits the stages again and, the first time, compiles a program. The previewer sees this when the fog mode changes, not on each frame.
- The depth variant gets a program for each value too, as Godot's depth pre-pass gets the same specialisation (`render_forward_clustered.cpp:2108`).
- A new constant needs only a binding row: the emitter and the material already fold and key it.
- A specialised member costs a program for each value. Only a member that a frame holds constant for every draw qualifies: a per-draw value, such as an instance flag, would build a program for each draw.
