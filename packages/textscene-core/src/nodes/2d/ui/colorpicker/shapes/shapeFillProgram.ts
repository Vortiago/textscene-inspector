/**
 * The program injection of a shape's shader fill: a `meshBasicMaterial` whose colour is the shape's
 * `fragment()` at the fragment's `UV`, under one cache key per fragment and canvas space (ADR-0038).
 *
 * Godot's shader writes `COLOR`, which replaces the vertex colour and the modulate it carries
 * (`drivers/gles3/shaders/canvas.glsl:181`), so only the canvas modulation multiplies after it
 * (`:716`). In an sRGB canvas `COLOR` holds sRGB numbers, so the fill decodes once and three's
 * output encode restores them. A linear canvas takes `COLOR` as linear, as Godot does.
 */
import * as THREE from 'three';
import type { ProgramInjection } from '../../../../../r3f/materialProgramInputs';
import { afterInclude, editedProgram } from '../../../../../r3f/shaderPatch/chunkPatch';
import { canvasProgramKey } from '../../../../../r3f/lighting2d/canvasItemLighting';
import { SHAPE_COLOR_FUNCTION, shapeFragmentGlsl, type ShapeFragment } from './shapeFragment';

/**
 * The uniforms a fill reads. The caller owns them and writes `.value`, so a new colour or modulate
 * reaches the compiled program without a recompile.
 */
export interface ShapeFillUniforms {
  /** One per name in `ShapeFragment.uniforms`. */
  shape: Record<string, THREE.IUniform<number>>;
  /** The canvas modulation, in the canvas's own space: sRGB numbers or linear. */
  canvasModulate: THREE.IUniform<THREE.Color>;
}

/** The unit quad runs from (0, 0) at the top-left to (1, -1), so `UV` runs 0 to 1 with y down, as Godot's does. */
const VERTEX_UV = `vShapeUv = vec2( position.x, -position.y );`;

// Clamped at 0: `okhsl_to_srgb` goes far negative outside the circle, the 8-bit target Godot writes
// clamps it, and `pow` of a negative base is undefined on a driver that lowers `mix` as a lerp.
const SRGB_COLOR = `vec4 shapeColor = ${SHAPE_COLOR_FUNCTION}( vShapeUv );
diffuseColor = vec4( sRGBTransferEOTF( vec4( max( shapeColor.rgb * uShapeCanvasModulate, 0.0 ), 1.0 ) ).rgb, diffuseColor.a * shapeColor.a );`;

const LINEAR_COLOR = `vec4 shapeColor = ${SHAPE_COLOR_FUNCTION}( vShapeUv );
diffuseColor = vec4( shapeColor.rgb * uShapeCanvasModulate, diffuseColor.a * shapeColor.a );`;

export function shapeFillInjection(
  fragment: ShapeFragment,
  uniforms: ShapeFillUniforms,
  isLinearCanvas: boolean
): ProgramInjection {
  const declarations = shapeFragmentGlsl(fragment);
  return {
    cacheKey: canvasProgramKey(`color-picker-shape-${fragment.name}`, isLinearCanvas),
    onBeforeCompile(shader) {
      Object.assign(shader.uniforms, uniforms.shape);
      shader.uniforms.uShapeCanvasModulate = uniforms.canvasModulate;
      editedProgram(
        shader,
        {
          vertex: [
            {
              three: 'void main() {',
              godot: 'varying vec2 vShapeUv;\nvoid main() {',
            },
            afterInclude('#include <begin_vertex>', VERTEX_UV),
          ],
          fragment: [
            {
              three: 'void main() {',
              godot: `varying vec2 vShapeUv;\nuniform vec3 uShapeCanvasModulate;\n${declarations}\nvoid main() {`,
            },
            afterInclude('#include <color_fragment>', isLinearCanvas ? LINEAR_COLOR : SRGB_COLOR),
          ],
        },
        `ColorPicker ${fragment.name} fill`
      );
    },
  };
}
