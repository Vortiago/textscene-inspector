/**
 * The grow of a grown StandardMaterial3D: the vertex offset `material.cpp:1458-1461`
 * emits as `VERTEX += NORMAL * grow;` when `grow_enabled`, spliced where three declares
 * `transformed`. Both terms are model space, so the offset rides the raw `normal`
 * attribute before the model matrix, and a scaled node scales it. three declares
 * `attribute vec3 normal;` for every non-raw program (r187 `WebGLProgram.js:585`), so one
 * patch shape serves the basic, standard and physical classes.
 */

import { glslFloat } from '../../utils/glslLiterals';
import { editedProgram } from '../shaderPatch/chunkPatch';
import type { ProgramInjection } from '../materialProgramInputs';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';

/** Where three declares `transformed`, before any chunk that moves it. */
const BEGIN_VERTEX = '#include <begin_vertex>';

/**
 * The offset as a baked constant, not a uniform: `material.cpp:973-974` generates the
 * `grow` uniform only when `grow_enabled`, and each amount compiles once under its
 * cache key (`materialProgramInputs`), the way ADR-0038 keys a program input.
 *
 * The include stays, so a later patch can still anchor on it; the line lands directly
 * after the `transformed` declaration three resolves into it.
 */
function growInjection(amount: number): ProgramInjection {
  const line = `\ttransformed += normal * ${glslFloat(amount)};`;
  return {
    cacheKey: `godot-grow:${glslFloat(amount)}`,
    onBeforeCompile(shader) {
      editedProgram(shader, { vertex: [{ three: BEGIN_VERTEX, godot: `${BEGIN_VERTEX}\n${line}` }] }, 'grow');
    },
  };
}

/** The grow injection `scalars` derive, undefined for a material whose shader is bare. */
export function growInjectionOf(scalars: StandardMaterial3DScalars): ProgramInjection | undefined {
  return scalars.grows ? growInjection(scalars.growAmount) : undefined;
}
