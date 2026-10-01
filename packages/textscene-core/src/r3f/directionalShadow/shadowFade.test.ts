/**
 * The fade hooks onto one line of three's shadow chunk and two of its lighting chunk, and reaches
 * every lit material through one shared buffer. The first test reads the installed three, so a
 * release that rewrites a line fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAX_DIRECTIONAL_LIGHTS } from '../../godot/directionalShadow';
import {
  DIRECTIONAL_SHADOW_FADE_UNIFORM,
  installDirectionalShadowFade,
  shadowFadeChunks,
  writeDirectionalShadowFades,
} from './shadowFade';
import { godotSplitShadowChunk, installGodotSplitShadow } from './splitShadowChunk';

const PARS = 'shadowmap_pars_fragment';
const LIGHTS = 'lights_fragment_begin';
const threePars = THREE.ShaderChunk[PARS];
const threeLights = THREE.ShaderChunk[LIGHTS];
const LIT_SHADERS = ['lambert', 'phong', 'standard', 'physical', 'toon'] as const;

const occurrences = (text: string, part: string) => text.split(part).length - 1;

function fadeBuffer(): Float32Array {
  return THREE.ShaderLib.standard.uniforms[DIRECTIONAL_SHADOW_FADE_UNIFORM]!.value as Float32Array;
}

afterEach(() => {
  THREE.ShaderChunk[PARS] = threePars;
  THREE.ShaderChunk[LIGHTS] = threeLights;
  for (const shader of Object.values(THREE.ShaderLib)) {
    delete shader.uniforms[DIRECTIONAL_SHADOW_FADE_UNIFORM];
  }
});

describe('shadowFadeChunks', () => {
  it('finds each hooked line exactly once in the installed three', () => {
    expect(occurrences(threePars, '#ifdef USE_SHADOWMAP\n')).toBe(1);
    expect(occurrences(threeLights, 'getShadow( directionalShadowMap[ i ]')).toBe(1);
    expect(occurrences(threeLights, 'getSunShadow( sunShadowMap[ i ]')).toBe(1);
    expect(shadowFadeChunks(threePars, threeLights)).not.toBeNull();
  });

  it('declares one fade per directional and sun shadow, outside both shadow blocks', () => {
    const { pars } = shadowFadeChunks(threePars, threeLights)!;
    const declaration = `uniform vec2 ${DIRECTIONAL_SHADOW_FADE_UNIFORM}[ NUM_DIR_LIGHT_SHADOWS + NUM_SUN_LIGHT_SHADOWS ];`;
    expect(occurrences(pars, declaration)).toBe(1);
    expect(pars.indexOf(declaration)).toBeLessThan(pars.indexOf('#if NUM_SUN_LIGHT_SHADOWS > 0'));
    expect(pars).toContain('smoothstep( fade.x, fade.y, depth )');
  });

  it('mixes the directional shadow towards unshadowed by the view depth', () => {
    const { lights } = shadowFadeChunks(threePars, threeLights)!;
    expect(lights).toContain(
      `1.0, directionalShadowFadeOut( ${DIRECTIONAL_SHADOW_FADE_UNIFORM}[ i ], - geometryPosition.z ) )`
    );
  });

  it('mixes the sun shadow by the fade after every directional one', () => {
    const { lights } = shadowFadeChunks(threePars, threeLights)!;
    expect(lights).toContain(
      `mix( getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ), 1.0, directionalShadowFadeOut( ${DIRECTIONAL_SHADOW_FADE_UNIFORM}[ NUM_DIR_LIGHT_SHADOWS + UNROLLED_LOOP_INDEX ], - geometryPosition.z ) )`
    );
  });

  it('leaves the spot shadow unfaded (edge case)', () => {
    const { lights } = shadowFadeChunks(threePars, threeLights)!;
    expect(occurrences(lights, 'directionalShadowFadeOut')).toBe(2);
    expect(lights).toContain('getShadow( spotShadowMap[ i ]');
  });

  it('is null for chunks without the lines (error case)', () => {
    expect(shadowFadeChunks('void main() {}', threeLights)).toBeNull();
    expect(shadowFadeChunks(threePars, 'void main() {}')).toBeNull();
    const withoutSun = threeLights.replace('getSunShadow( sunShadowMap[ i ]', 'getSunShadow( sunMap[ i ]');
    expect(shadowFadeChunks(threePars, withoutSun)).toBeNull();
  });
});

describe('installDirectionalShadowFade', () => {
  it('gives every lit built-in material the fade uniform', () => {
    installDirectionalShadowFade();
    for (const name of LIT_SHADERS) {
      expect(THREE.ShaderLib[name]!.uniforms[DIRECTIONAL_SHADOW_FADE_UNIFORM]).toBeDefined();
    }
  });

  it('leaves an unlit material without it (edge case)', () => {
    installDirectionalShadowFade();
    expect(THREE.ShaderLib.basic.uniforms[DIRECTIONAL_SHADOW_FADE_UNIFORM]).toBeUndefined();
  });

  it('shares one buffer with every material’s cloned uniforms', () => {
    installDirectionalShadowFade();
    const cloned = THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms);
    expect(cloned[DIRECTIONAL_SHADOW_FADE_UNIFORM]!.value).toBe(fadeBuffer());
  });

  it('patches each chunk once when called twice (edge case)', () => {
    installDirectionalShadowFade();
    installDirectionalShadowFade();
    expect(occurrences(THREE.ShaderChunk[LIGHTS], 'directionalShadowFadeOut')).toBe(2);
    expect(occurrences(THREE.ShaderChunk[PARS], `uniform vec2 ${DIRECTIONAL_SHADOW_FADE_UNIFORM}`)).toBe(1);
  });
});

describe('writeDirectionalShadowFades', () => {
  it('writes each directional fade at its shadow index', () => {
    installDirectionalShadowFade();
    writeDirectionalShadowFades({
      directional: [
        { from: 64, to: 80 },
        { from: 8, to: 10 },
      ],
      sun: [],
    });
    expect(Array.from(fadeBuffer().subarray(0, 4))).toEqual([64, 80, 8, 10]);
  });

  it('writes each sun fade after every directional one, as the shader indexes it', () => {
    installDirectionalShadowFade();
    writeDirectionalShadowFades({ directional: [{ from: 64, to: 80 }], sun: [{ from: 40, to: 50 }, null] });
    expect(Array.from(fadeBuffer().subarray(0, 6))).toEqual([64, 80, 40, 50, 0, 0]);
  });

  it('writes no fade for a null entry or a shadow past the lists', () => {
    installDirectionalShadowFade();
    writeDirectionalShadowFades({ directional: [{ from: 1, to: 2 }], sun: [{ from: 3, to: 4 }] });
    writeDirectionalShadowFades({ directional: [null], sun: [] });
    expect(Array.from(fadeBuffer()).every((value) => value === 0)).toBe(true);
  });

  it('ignores a shadow past Godot’s directional light limit (edge case)', () => {
    installDirectionalShadowFade();
    const tooMany = Array.from({ length: MAX_DIRECTIONAL_LIGHTS }, () => ({ from: 1, to: 2 }));
    expect(() =>
      writeDirectionalShadowFades({ directional: tooMany, sun: [{ from: 3, to: 4 }] })
    ).not.toThrow();
    expect(fadeBuffer()).toHaveLength(MAX_DIRECTIONAL_LIGHTS * 2);
    expect(Array.from(fadeBuffer()).includes(3)).toBe(false);
  });
});

describe('the fade with Godot’s split lookup', () => {
  /** Both installs, in the given order, and the shadow chunk they leave. */
  function installBoth(order: 'fade first' | 'splits first'): string {
    if (order === 'fade first') {
      installDirectionalShadowFade();
      installGodotSplitShadow();
    } else {
      installGodotSplitShadow();
      installDirectionalShadowFade();
    }
    return THREE.ShaderChunk[PARS];
  }

  it('applies both patches to three’s shadow chunk', () => {
    const pars = installBoth('splits first');
    expect(pars).toContain(`uniform vec2 ${DIRECTIONAL_SHADOW_FADE_UNIFORM}[`);
    expect(pars).toContain('float getSunShadowSplit(');
    expect(pars).toContain('#define SUN_LIGHT_CASCADES 4');
    expect(occurrences(THREE.ShaderChunk[LIGHTS], 'directionalShadowFadeOut')).toBe(2);
  });

  it('leaves the same chunk whichever installs first', () => {
    const splitsFirst = installBoth('splits first');
    THREE.ShaderChunk[PARS] = threePars;
    THREE.ShaderChunk[LIGHTS] = threeLights;
    expect(installBoth('fade first')).toBe(splitsFirst);
  });

  it('equals the split patch of the faded chunk', () => {
    const { pars } = shadowFadeChunks(threePars, threeLights)!;
    expect(installBoth('fade first')).toBe(godotSplitShadowChunk(pars));
  });

  it('patches each part once when both install twice (edge case)', () => {
    installBoth('splits first');
    const pars = installBoth('fade first');
    expect(occurrences(pars, `uniform vec2 ${DIRECTIONAL_SHADOW_FADE_UNIFORM}`)).toBe(1);
    expect(occurrences(pars, 'float getSunShadowSplit(')).toBe(1);
  });

  it('keeps the fade when three’s sun lookup cannot be replaced (error case)', () => {
    THREE.ShaderChunk[PARS] = threePars.replace(
      '#define SUN_LIGHT_CASCADES 2',
      '#define SUN_LIGHT_CASCADES 3'
    );
    const pars = installBoth('fade first');
    expect(pars).toContain(`uniform vec2 ${DIRECTIONAL_SHADOW_FADE_UNIFORM}[`);
    expect(pars).not.toContain('getSunShadowSplit');
  });
});
