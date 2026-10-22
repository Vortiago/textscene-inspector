import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  bindHeightmap,
  heightmapUserData,
  parallaxInjection,
  unshadedParallaxInjection,
} from './godotParallax';
import type { ProgramShader } from '../materialProgramInputs';
import type { Heightmap } from '../../resources/materials/standardmaterial3d/types';
import { UV2_CHANNEL } from '../../resources/meshes/uv2';

const HEIGHTMAP: Heightmap = { scale: 3, isDeep: false, layers: [8, 32], flip: [1, -1], readsHeight: false };

/** The shader `parallaxInjection(heightmap)` leaves for a material recording `recorded`. */
function patched(
  heightmap: Heightmap,
  recorded: Heightmap | null = heightmap,
  fragmentShader = THREE.ShaderLib.physical.fragmentShader
): ProgramShader {
  const material = new THREE.MeshPhysicalMaterial({ userData: heightmapUserData(recorded) });
  const shader: ProgramShader = {
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader,
    uniforms: {},
  };
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

  it('leaves a map on UV2 unshifted, as Godot shifts only base_uv', () => {
    const material = new THREE.MeshStandardMaterial({ userData: heightmapUserData(HEIGHTMAP) });
    material.emissiveMap = new THREE.Texture();
    material.emissiveMap.channel = UV2_CHANNEL;
    const shader: ProgramShader = {
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
      uniforms: {},
    };

    parallaxInjection(HEIGHTMAP)!.onBeforeCompile.call(material, shader);

    expect(shader.fragmentShader).not.toContain('#define vEmissiveMapUv');
    expect(shader.fragmentShader).toContain('#define vAoMapUv ( vAoMapUv + godotParallaxShift )');
  });

  it("throws, naming the anchor, for a shader without three's declarations (error case)", () => {
    expect(() => patched(HEIGHTMAP, HEIGHTMAP, 'void main() {}')).toThrow(
      'expected the fragment shader of the parallax to hold "#include <clipping_planes_pars_fragment>" once'
    );
  });

  it("writes the heightmap's coordinate under its texture's transform", () => {
    expect(patched(HEIGHTMAP).vertexShader).toContain(
      'vGodotHeightmapUv = ( godotHeightmapTransform * vec3( uv, 1.0 ) ).xy;'
    );
  });
});

describe('bindHeightmap', () => {
  function uniformsOf(material: THREE.Material): ProgramShader['uniforms'] {
    const shader: ProgramShader = {
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
      uniforms: {},
    };
    parallaxInjection(HEIGHTMAP)!.onBeforeCompile.call(material, shader);
    return shader.uniforms;
  }

  it('gives the parallax the texture bound to the material', () => {
    const material = new THREE.MeshStandardMaterial();
    const texture = new THREE.Texture();
    bindHeightmap(material, texture);

    expect(uniformsOf(material).godotHeightmap!.value).toBe(texture);
  });

  it('carries the texture transform the slot gives it', () => {
    const material = new THREE.MeshStandardMaterial();
    const texture = new THREE.Texture();
    texture.repeat.set(2, 3);
    bindHeightmap(material, texture);

    const { elements } = uniformsOf(material).godotHeightmapTransform!.value as THREE.Matrix3;
    expect([elements[0], elements[4]]).toEqual([2, 3]);
  });

  it("reads black for a material with no texture, as Godot's hint_default_black does (edge case)", () => {
    const material = new THREE.MeshStandardMaterial();
    bindHeightmap(material, new THREE.Texture());
    bindHeightmap(material, null);

    const { image } = uniformsOf(material).godotHeightmap!.value as THREE.DataTexture;
    expect(Array.from(image.data as Uint8Array)).toEqual([0, 0, 0, 255]);
  });
});

describe('unshadedParallaxInjection', () => {
  function patchedUnshaded(): ProgramShader {
    const material = new THREE.MeshBasicMaterial();
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

  it("writes the heightmap's coordinate", () => {
    expect(patchedUnshaded().vertexShader).toContain('vGodotHeightmapUv = ');
  });
});

describe('heightmapUserData', () => {
  it('records nothing for a material without height mapping', () => {
    expect(heightmapUserData(null)).toEqual({});
  });
});
