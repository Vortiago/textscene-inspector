import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { lightModesInjection, type LightModes } from './lightModes';
import { DiffuseMode } from '../godot/rendering/materials/diffuseMode';
import { SpecularMode } from '../godot/rendering/materials/specularMode';
import { patchedShader } from './testing/patchedFragment';

const BURLEY_GGX: LightModes = {
  diffuseMode: DiffuseMode.DIFFUSE_BURLEY,
  specularMode: SpecularMode.SPECULAR_SCHLICK_GGX,
};

/** The fragment shader a lit material in `modes` compiles. */
function fragmentIn(modes: Partial<LightModes>): string {
  const injection = lightModesInjection({ ...BURLEY_GGX, ...modes })!;
  return patchedShader(injection.onBeforeCompile, THREE.ShaderLib.standard.fragmentShader);
}

describe('lightModesInjection', () => {
  it.each([
    // `scene_forward_lights_inc.glsl:194-202,210-213`.
    [DiffuseMode.DIFFUSE_LAMBERT, 'GODOT_DIFFUSE_LAMBERT'],
    [DiffuseMode.DIFFUSE_LAMBERT_WRAP, 'GODOT_DIFFUSE_LAMBERT_WRAP'],
    [DiffuseMode.DIFFUSE_TOON, 'GODOT_DIFFUSE_TOON'],
  ])('defines the diffuse branch of mode %i, %s', (diffuseMode, define) => {
    expect(fragmentIn({ diffuseMode })).toMatch(new RegExp(`^#define ${define}\\n`));
  });

  it.each([
    // `scene_forward_lights_inc.glsl:228-237`.
    [SpecularMode.SPECULAR_TOON, 'GODOT_SPECULAR_TOON'],
    [SpecularMode.SPECULAR_DISABLED, 'GODOT_SPECULAR_DISABLED'],
  ])('defines the specular branch of mode %i, %s', (specularMode, define) => {
    expect(fragmentIn({ specularMode })).toMatch(new RegExp(`^#define ${define}\\n`));
  });

  it('defines both modes of a surface that sets both', () => {
    const fragment = fragmentIn({
      diffuseMode: DiffuseMode.DIFFUSE_TOON,
      specularMode: SpecularMode.SPECULAR_TOON,
    });
    expect([
      fragment.includes('#define GODOT_DIFFUSE_TOON\n'),
      fragment.includes('#define GODOT_SPECULAR_TOON\n'),
    ]).toEqual([true, true]);
  });

  it("patches nothing for Burley and GGX, BaseMaterial3D's defaults", () => {
    // `material.h:608-609`.
    expect(lightModesInjection(BURLEY_GGX)).toBeUndefined();
  });

  it('draws a diffuse mode past the enum as Lambert, as a shader with no diffuse render mode (edge case)', () => {
    // `material.cpp:828-841` writes no `diffuse_*` render mode for it, and `shader_types.cpp:241`
    // makes Lambert the default.
    expect(lightModesInjection({ ...BURLEY_GGX, diffuseMode: 7 })).toBe(
      lightModesInjection({ ...BURLEY_GGX, diffuseMode: DiffuseMode.DIFFUSE_LAMBERT })
    );
  });

  it('draws a specular mode past the enum as GGX, as a shader with no specular render mode (edge case)', () => {
    // `material.cpp:843-855` writes no `specular_*` render mode for it, and
    // `scene_forward_clustered.glsl:1078-1080` makes GGX the default.
    expect(lightModesInjection({ ...BURLEY_GGX, specularMode: 7 })).toBeUndefined();
  });

  it('gives one injection per pair of modes, so composed programs share it', () => {
    const modes = { diffuseMode: DiffuseMode.DIFFUSE_TOON, specularMode: SpecularMode.SPECULAR_TOON };
    expect(lightModesInjection(modes)).toBe(lightModesInjection({ ...modes }));
  });
});
