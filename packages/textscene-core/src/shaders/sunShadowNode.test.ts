/**
 * The directional shadow lookup, read on its generated GLSL: one function per step of
 * `scene_forward_clustered.glsl:2310-2491` and `scene_forward_lights_inc.glsl:283-424`.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { vec3, vec4 } from 'three/tsl';
import { generatedFragmentShader } from './generatedShader.testkit.js';
import { LightRows } from './lightRows.js';
import { SunShadow } from './sunShadowNode.js';
import { MAX_SUNS, SUN_ROWS } from './sunRows.js';

function shadowShader(rowsFromBottom: boolean): string {
  const rows = new LightRows(SUN_ROWS, MAX_SUNS);
  const depth = new THREE.DepthTexture(4, 4);
  depth.compareFunction = THREE.LessEqualCompare;
  const lookup = new SunShadow(rows, { depth, colour: new THREE.Texture(), rowsFromBottom }, true);
  return generatedFragmentShader(vec4(vec3(lookup.shadow(SUN_ROWS)), 1));
}

describe('SunShadow', () => {
  const shader = shadowShader(true);

  it('calls one function per step, with the light’s first row and the fragment', () => {
    expect(shader).toMatch(new RegExp(`godotSunShadow\\( ${SUN_ROWS}, \\w+, \\w+, `));
    for (const name of [
      'godotSunSplitShadow',
      'godotSunPcfSplit',
      'godotSunPcf',
      'godotSunSoftShadow',
      'godotSunSoftSplit',
      'godotSunBlockerShadow',
      'godotSunRawDepth',
    ]) {
      expect(shader).toMatch(new RegExp(`\\b(float|vec\\d) ${name} ?\\(`));
    }
  });

  it('fades out between the fade’s two depths only while they ascend', () => {
    expect(shader).toMatch(/\( \w+\.y > \w+\.x \)/);
    expect(shader).toMatch(/mix\( \w+, 1\.0, \w+ \)/);
  });

  it('compares the atlas depth through a shadow sampler', () => {
    expect(shader).toContain('sampler2DShadow');
    expect(shader).toMatch(/texture\( \w+, vec3\(/);
  });

  it('reads the blocker depth from two bytes of the colour', () => {
    expect(shader).toContain('vec2( 256.0, 1.0 )');
    expect(shader).toContain('65535.0');
  });

  it('turns the rows back for an atlas WebGLRenderer drew', () => {
    // three's own turn sits in a branch on its flip uniform, so the lookup's is the one held in a constant.
    const lookupTurn = /vec2 \w+ = vec2\( \w+\.x, 1\.0 - \w+\.y \)/;
    expect(shader).toMatch(lookupTurn);
    expect(shadowShader(false)).not.toMatch(lookupTurn);
  });

  it('loads the blocker depth at the rows WebGLRenderer wrote, as the patch reads them', () => {
    // three turns a load only from a marked texture, in a branch on its flip uniform, so a turn of
    // the lookup's own would read the colour copy upside down: the soft shadow then found no blocker.
    expect(shader).not.toMatch(/\( \w+\.y - 1\.0 \) - \w+\.y/);
  });
});
