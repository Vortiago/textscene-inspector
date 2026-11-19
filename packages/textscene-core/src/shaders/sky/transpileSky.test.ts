import * as THREE from 'three';
import type { NodeMaterial, TextureNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedFragmentShader } from '../generatedShader.testkit';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { bindRadiance, disposeSky, transpileSky, type SkyDraw } from './transpileSky.js';
import { DEFAULT_SKY } from './defaultSky.testkit';

function errorOf(source: string): ShadingLanguageError {
  try {
    transpileSky(source, { file: 'user.gdshader' });
  } catch (error) {
    if (error instanceof ShadingLanguageError) return error;
    throw error;
  }
  throw new Error('expected a ShadingLanguageError, got none');
}

describe('transpileSky', () => {
  it('refuses a shader of another type, at its first line', () => {
    expect(errorOf('shader_type spatial;\n').position).toEqual({ file: 'user.gdshader', line: 1, column: 1 });
  });

  it("names the user's line for an error in the sky function", () => {
    const source = 'shader_type sky;\n\nvoid sky() {\n\tCOLOR = 1.0;\n}\n';
    expect(errorOf(source).position).toMatchObject({ file: 'user.gdshader', line: 4 });
  });

  it("emits the ALPHA a half pass writes in that pass's program", () => {
    const source =
      'shader_type sky;\nrender_mode use_half_res_pass;\nvoid sky() {\n' +
      '\tALPHA = AT_HALF_RES_PASS ? 0.375 : 1.0;\n\tCOLOR = vec3(0.5);\n}\n';
    const fragment = (transpileSky(source).half!.mesh.material as NodeMaterial).fragmentNode!;
    expect(generatedFragmentShader(fragment)).toMatch(/0\.375/);
  });

  it("reads RADIANCE through its octmap coordinate, as Godot's compiler writes the call", () => {
    const sky = transpileSky('shader_type sky;\nvoid sky() { COLOR = texture(RADIANCE, EYEDIR).rgb; }');
    const fragment = generatedFragmentShader((sky.mesh.material as NodeMaterial).fragmentNode!);
    expect(fragment).toMatch(/vec3_to_oct_with_border/);
  });

  it('reads the bias of a RADIANCE texture call as its level', () => {
    const sky = transpileSky(
      'shader_type sky;\nvoid sky() { COLOR = texture(RADIANCE, EYEDIR, 2.625).rgb; }'
    );
    const fragment = generatedFragmentShader((sky.mesh.material as NodeMaterial).fragmentNode!);
    expect(fragment).toMatch(/textureLod\([^;]*2\.625/);
  });

  it('reads a black RADIANCE in the octmap pass, as Godot binds there', () => {
    const sky = transpileSky('shader_type sky;\nvoid sky() { COLOR = texture(RADIANCE, EYEDIR).rgb; }', {
      pass: 'octmap',
    });
    expect(sky.textures.get('radiance')!.value).toBe(sky.unsetRadianceTexture);
  });

  it('reads the radiance bound to a sky behind the scene', () => {
    const sky = transpileSky('shader_type sky;\nvoid sky() { COLOR = texture(RADIANCE, EYEDIR).rgb; }');
    const radiance = new THREE.DataArrayTexture(new Uint8Array(4), 1, 1, 1);
    bindRadiance(sky, radiance);
    expect(sky.textures.get('radiance')!.value).toBe(radiance);
  });

  it('writes no depth', () => {
    expect(transpileSky(DEFAULT_SKY).mesh.material.depthWrite).toBe(false);
  });

  it('tests depth, so it draws only where no surface drew', () => {
    expect(transpileSky(DEFAULT_SKY).mesh.material.depthTest).toBe(true);
  });

  it('draws after every opaque surface, as Godot draws the sky after its opaque pass', () => {
    expect(transpileSky(DEFAULT_SKY).mesh.renderOrder).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('draws no sky while a samplerExternalOES has no texture, as Godot draws none', () => {
    const source =
      'shader_type sky;\nuniform samplerExternalOES s;\nvoid sky() {\n\tCOLOR = texture(s, vec2(0.5)).rgb;\n}\n';
    expect((transpileSky(source).mesh.material as THREE.Material).visible).toBe(false);
  });

  it('draws no clone of the sky mesh while a samplerExternalOES has no texture', () => {
    const source =
      'shader_type sky;\nuniform samplerExternalOES s;\nvoid sky() {\n\tCOLOR = texture(s, vec2(0.5)).rgb;\n}\n';
    expect((transpileSky(source).mesh.clone().material as THREE.Material).visible).toBe(false);
  });

  it('gives one uniform for a member both stages read', () => {
    expect(transpileSky(DEFAULT_SKY).uniforms.has('params.orientation')).toBe(true);
  });

  it('reads a uniform of the material from its slot of bits', () => {
    const sky = transpileSky(
      'shader_type sky;\nuniform vec3 tint : source_color;\nvoid sky() { COLOR = tint; }'
    );
    expect([...sky.parameters.keys()]).toEqual(['tint']);
    expect(generatedFragmentShader((sky.mesh.material as NodeMaterial).fragmentNode!)).toMatch(
      /uvec4 \w+\[1\];/
    );
  });

  it("calls a built-in by its own name and a function of the shader by Godot's id", () => {
    const source =
      'shader_type sky;\nfloat half_of(float x) { return x * 0.5; }\nvoid sky() { COLOR = vec3(fract(half_of(TIME))); }';
    const fragment = (transpileSky(source).mesh.material as NodeMaterial).fragmentNode!;
    expect(generatedFragmentShader(fragment)).toMatch(/fract\(/);
  });

  it("gives each texel of the octmap pass the direction through it, as Godot's octmap pass does", () => {
    const fragment = (transpileSky(DEFAULT_SKY, { pass: 'octmap' }).mesh.material as NodeMaterial)
      .fragmentNode!;
    expect(generatedFragmentShader(fragment)).toMatch(/oct_to_vec3_with_border\(/);
  });

  it('gives each pixel behind the scene the direction of the camera through it', () => {
    const fragment = (transpileSky(DEFAULT_SKY).mesh.material as NodeMaterial).fragmentNode!;
    expect(generatedFragmentShader(fragment)).not.toMatch(/oct_to_vec3_with_border\(/);
  });

  it("reads Godot's default samplers, at 4x anisotropy whatever the project's level", () => {
    const sky = transpileSky(
      'shader_type sky;\nuniform sampler2D v : filter_linear_mipmap_anisotropic;\nvoid sky() { COLOR = texture(v, SKY_COORDS).rgb; }',
      { sampling: { anisotropicFilteringLevel: 0, useNearestMipmapFilter: false } }
    );
    const binding = sky.parameters.get('v')!;
    binding.set(new THREE.DataTexture(new Uint8Array(4), 1, 1));
    expect(((binding as unknown as { value: TextureNode }).value.value as THREE.Texture).anisotropy).toBe(4);
  });

  it('gives equal GLSL for two runs of one text', () => {
    const fragmentOf = () =>
      generatedFragmentShader((transpileSky(DEFAULT_SKY).mesh.material as NodeMaterial).fragmentNode!);
    expect(fragmentOf()).toBe(fragmentOf());
  });

  it('draws no half or quarter pass for a sky without their render modes', () => {
    const sky = transpileSky(DEFAULT_SKY);
    expect([sky.half, sky.quarter]).toEqual([undefined, undefined]);
  });

  it.each(['half', 'quarter'] as const)('draws a %s resolution pass for its render mode', (resolution) => {
    const sky = transpileSky(`shader_type sky;\nrender_mode use_${resolution}_res_pass;\nvoid sky() {}`);
    expect(sky[resolution]?.mesh.material).not.toBe(sky.mesh.material);
  });

  it.each([
    ['background', 255],
    ['octmap', 0],
  ] as const)("reads HALF_RES_COLOR with no half pass from Godot's default in the %s", (pass, red) => {
    const sky = transpileSky('shader_type sky;\nvoid sky() { COLOR = HALF_RES_COLOR.rgb; }', { pass });
    const texture = sky.textures.get('half_res')!.value as THREE.DataTexture;
    expect((texture.image.data as Uint8Array)[0]).toBe(red);
  });

  it("frees the sky's default pass texture with the sky", () => {
    const sky = transpileSky('shader_type sky;\nvoid sky() { COLOR = HALF_RES_COLOR.rgb; }');
    const texture = sky.textures.get('half_res')!.value as THREE.Texture;
    let isDisposed = false;
    texture.addEventListener('dispose', () => (isDisposed = true));
    disposeSky(sky);
    expect(isDisposed).toBe(true);
  });

  it("holds the material's uniforms in one buffer, as Godot's material block, so 20 fit WebGL's 12", () => {
    const blocksWith = (count: number) => {
      const names = Array.from({ length: count }, (_, index) => `u${index}`);
      const source = `shader_type sky;\n${names.map((name) => `uniform float ${name};`).join('\n')}
void sky() { COLOR = vec3(${names.join(' + ')}); }`;
      const fragment = (transpileSky(source).mesh.material as NodeMaterial).fragmentNode!;
      return generatedFragmentShader(fragment).match(/uniform NodeBuffer_\w+ \{/g)?.length;
    };
    expect(blocksWith(1)).toBeGreaterThan(0);
    expect(blocksWith(20)).toBe(blocksWith(1));
  });

  it('reads each LIGHTn_COLOR from a slot of its own', () => {
    const fragments = [0, 1, 2, 3].map((slot) =>
      generatedFragmentShader(
        (
          transpileSky(`shader_type sky;\nvoid sky() { COLOR = LIGHT${slot}_COLOR; }`).mesh
            .material as NodeMaterial
        ).fragmentNode!
      )
    );
    expect(new Set(fragments).size).toBe(4);
  });

  it.each([
    ['half', 'AT_HALF_RES_PASS'],
    ['quarter', 'AT_QUARTER_RES_PASS'],
  ] as const)('draws the %s pass with %s true, and the full pass with it false', (resolution, flag) => {
    const sky = transpileSky(
      `shader_type sky;\nrender_mode use_${resolution}_res_pass;\nvoid sky() { COLOR = ${flag} ? vec3(1.0) : vec3(0.0); }`
    );
    const fragmentOf = (draw = sky as SkyDraw) =>
      generatedFragmentShader((draw.mesh.material as NodeMaterial).fragmentNode!);
    expect(fragmentOf(sky[resolution])).not.toBe(fragmentOf(sky));
  });
});
