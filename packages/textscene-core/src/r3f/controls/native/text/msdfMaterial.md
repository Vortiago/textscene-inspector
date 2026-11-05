# MSDF shader notes

The reasoning behind the shader source in `msdfMaterial.ts`, too long for a code comment.

## No `#extension GL_OES_standard_derivatives`

three promotes a `ShaderMaterial` to `#version 300 es`, where `fwidth` and `textureSize` are core.
It also prepends function bodies, so the directive no longer precedes every token, and ESSL3
rejects it. Under a real WebGL2 context the pragma failed the compile and every glyph drew
nothing.

## Tone mapping and colour encode

- A `ShaderMaterial` inherits neither `<tonemapping_fragment>` nor `<colorspace_fragment>`, so
  `FRAGMENT` ends with both.
- Without the encode, Godot's font colour 223 renders as 188.
- Without the curve, `Color(1, 1, 0.7)` under FILMIC fills rgb(255, 255, 179), not Godot 4.6.3's
  rgb(255, 255, 210).
- Both errors vanish at 0 and 1, so white text hides them.
- The curve is unconditional. The 2D canvas is mounted `flat` (`NoToneMapping`,
  `r3f/components/Canvas2DStage/World2DCanvas.tsx`), since Godot composites canvas items after
  tone mapping, so three compiles the chunk out there. Without `flat`, every glyph in the 2D stage
  would be tone-mapped.
- `WebGLProgram` injects `tonemapping_pars_fragment` and `colorspace_pars_fragment` into the
  prefix, so a copy in `FRAGMENT` would be a redefinition.
