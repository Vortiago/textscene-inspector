/**
 * A shape's `canvas_item` shader (`ColorPickerShape::init_shaders`, `scene/gui/color_picker_shape.cpp:37-138`)
 * as GLSL that three compiles: Godot's `fragment()` body, verbatim, inside a function of `UV` that
 * returns `COLOR`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { OK_COLOR_GLSL } from './okColorGlsl';

export interface ShapeFragment {
  /** Names the program in its cache key. */
  name: string;
  /** The `float` uniforms the body reads, by their Godot names. */
  uniforms: readonly string[];
  /** The three shaders that prepend `OK_COLOR_SHADER` (`thirdparty/misc/ok_color_shader.h`). */
  usesOkColor: boolean;
  /** Godot's `fragment()` body: it reads `UV` and writes `COLOR`. */
  body: string;
}

/** The function the fill calls, and the name the material's fragment shader calls it by. */
export const SHAPE_COLOR_FUNCTION = 'godotShapeColor';

/** `TAU` of the Godot shading language (`shader_language.cpp`), which GLSL does not define. */
const TAU_GLSL = 'const float TAU = 6.28318530717958647692528676655900576;';

/** The declarations to put before three's `main`: the uniforms, the OK colour functions and the fill function. */
export function shapeFragmentGlsl(fragment: ShapeFragment): string {
  const uniforms = fragment.uniforms.map((name) => `uniform float ${name};`).join('\n');
  return [
    uniforms,
    fragment.usesOkColor ? OK_COLOR_GLSL : '',
    TAU_GLSL,
    `vec4 ${SHAPE_COLOR_FUNCTION}(vec2 UV) {\n\tvec4 COLOR = vec4(1.0);\n${fragment.body}\n\treturn COLOR;\n}`,
  ]
    .filter((part) => part !== '')
    .join('\n');
}
