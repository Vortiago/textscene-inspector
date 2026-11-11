import { describe, expect, it } from 'vitest';
import { uv, vec3, vec4 } from 'three/tsl';
import { generatedFragmentShader } from './generatedShader.js';
import { schlickFresnel } from './godotLightFunctions.js';

describe('schlickFresnel', () => {
  it('multiplies in the order of Godot’s SchlickFresnel', () => {
    const shader = generatedFragmentShader(vec4(vec3(schlickFresnel(uv().x)), 1));

    // `m = 1.0 - u`, `m2 = m * m`, then `m2 * m2 * m` (`scene_forward_lights_inc.glsl:55-58`).
    expect(shader).toMatch(
      /(\w+) = \( 1\.0 - \w+\.x \);\s+(\w+) = \( \1 \* \1 \);[\s\S]*\( \( \2 \* \2 \) \* \1 \)/
    );
  });
});
