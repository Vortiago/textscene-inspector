import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { heightmapUserData, parallaxInjection, unshadedParallaxInjection } from './godotParallax';
import { UnshadedMaterial } from './unshadedMaterial';
import type { ProgramShader } from '../materialProgramInputs';
import type { Heightmap } from '../../resources/materials/standardmaterial3d/types';

const HEIGHTMAP: Heightmap = { scale: 3, isDeep: false, layers: [8, 32], flip: [1, -1], readsHeight: false };

/** The shader `parallaxInjection(heightmap)` leaves for a material recording `recorded`. */
function patched(
  heightmap: Heightmap,
  recorded: Heightmap | null = heightmap,
  fragmentShader = THREE.ShaderLib.physical.fragmentShader
): ProgramShader {
  const material = new THREE.MeshPhysicalMaterial({
    displacementMap: new THREE.Texture(),
    userData: heightmapUserData(recorded),
  });
  const shader: ProgramShader = { vertexShader: '', fragmentShader, uniforms: {} };
  parallaxInjection(heightmap)!.onBeforeCompile.call(material, shader);
  return shader;
}

describe.each([
  ['MeshStandardMaterial', THREE.ShaderLib.standard.fragmentShader],
  ['MeshPhysicalMaterial', THREE.ShaderLib.physical.fragmentShader],
])('parallaxInjection on the %s fragment shader', (_type, fragmentShader) => {
  it('shifts every map coordinate before the first map is read', () => {
    const shader = patched(HEIGHTMAP, HEIGHTMAP, fragmentShader).fragmentShader;
    const firstRead = shader.indexOf('#include <map_fragment>');

    expect(shader.indexOf('#define vMapUv ( vMapUv + godotParallaxShift )')).toBeLessThan(firstRead);
    expect(shader.indexOf('#define vNormalMapUv ( vNormalMapUv + godotParallaxShift )')).toBeLessThan(
      firstRead
    );
  });
});

describe('parallaxInjection', () => {
  it("offsets the coordinate by the view direction, the depth and Godot's scale", () => {
    // `material.cpp:1600`.
    expect(patched(HEIGHTMAP).fragmentShader).toContain(
      'uv - viewDir.xy * godotHeightmapDepth( uv ) * godotHeightmapScale * 0.01'
    );
  });

  it("flips the tangent frame by the material's flips", () => {
    expect(patched(HEIGHTMAP).fragmentShader).toContain('dot( view, bitangent * godotHeightmapFlip.y )');
  });

  it('steps through the layers only for deep parallax', () => {
    expect(patched(HEIGHTMAP).fragmentShader).not.toMatch(/^#define GODOT_DEEP_PARALLAX/m);
    expect(patched({ ...HEIGHTMAP, isDeep: true }).fragmentShader).toMatch(/^#define GODOT_DEEP_PARALLAX/m);
  });

  it('reads the texture as height, not depth, for an inverted heightmap', () => {
    expect(patched(HEIGHTMAP).fragmentShader).not.toMatch(/^#define GODOT_HEIGHTMAP_READS_HEIGHT/m);
    expect(patched({ ...HEIGHTMAP, readsHeight: true }).fragmentShader).toMatch(
      /^#define GODOT_HEIGHTMAP_READS_HEIGHT/m
    );
  });

  it('gives the uniforms the height mapping the material records', () => {
    const { uniforms } = patched(HEIGHTMAP);

    expect(uniforms.godotHeightmapScale!.value).toBe(3);
    expect(uniforms.godotHeightmapLayers!.value).toEqual([8, 32]);
    expect(uniforms.godotHeightmapFlip!.value).toEqual([1, -1]);
  });

  it("gives a material that records none Godot's defaults (edge case)", () => {
    const { uniforms } = patched(HEIGHTMAP, null);

    expect(uniforms.godotHeightmapScale!.value).toBe(5);
    expect(uniforms.godotHeightmapFlip!.value).toEqual([1, 1]);
  });

  it("leaves a shader without three's map anchor unshifted (error case)", () => {
    expect(patched(HEIGHTMAP, HEIGHTMAP, 'void main() {}').fragmentShader).toBe('void main() {}');
  });

  it('leaves a material with no heightmap bound unshifted (edge case)', () => {
    const shader: ProgramShader = {
      vertexShader: '',
      fragmentShader: '#include <map_fragment>',
      uniforms: {},
    };
    parallaxInjection(HEIGHTMAP)!.onBeforeCompile.call(new THREE.MeshStandardMaterial(), shader);

    expect(shader.fragmentShader).toBe('#include <map_fragment>');
  });
});

describe('unshadedParallaxInjection', () => {
  function patchedUnshaded(): ProgramShader {
    const material = new UnshadedMaterial({ displacementMap: new THREE.Texture() });
    const shader: ProgramShader = {
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
      uniforms: {},
    };
    unshadedParallaxInjection(HEIGHTMAP)!.onBeforeCompile.call(material, shader);
    return shader;
  }

  it('writes the view position and the normal the parallax reads', () => {
    const { vertexShader } = patchedUnshaded();

    expect(vertexShader).toContain('vViewPosition = - mvPosition.xyz;');
    expect(vertexShader).toContain('vNormal = normalize( transformedNormal );');
  });

  it('shifts the albedo coordinate', () => {
    expect(patchedUnshaded().fragmentShader).toContain('#define vMapUv ( vMapUv + godotParallaxShift )');
  });

  it('gives three the displacement uniforms it fills for the slot', () => {
    expect(patchedUnshaded().uniforms).toHaveProperty('displacementMapTransform');
  });
});

describe('heightmapUserData', () => {
  it('records nothing for a material without height mapping', () => {
    expect(heightmapUserData(null)).toEqual({});
  });
});
