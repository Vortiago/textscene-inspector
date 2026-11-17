import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { NodeMaterial } from 'three/webgpu';
import * as logger from '../../logger';
import { generatedFragmentShader } from '../../shaders/generatedShader.testkit';
import { transpileSky } from '../../shaders/sky/transpileSky';
import { testRenderer } from '../../testing/recordingWebGL';
import { installNodesHandler } from '../../shaders/nodesHandler';
import { ShaderSkyBackground } from '../../r3f/sky/shaderSkyBackground';
import { GODOT_DEFAULT_SKY, setParameters, shaderSkyRefusal, transpiledShaderSky } from './shaderSky';
import { buildSkyEnvironment } from './build';
import { decodeSky } from './decode';
import type { ShaderSkyProperties, Sky } from './types';

const TINTED_SKY = 'shader_type sky;\nuniform float tint = 0.5;\nvoid sky() {\n\tCOLOR = vec3(tint);\n}\n';

function shaderMaterial(code: string): ShaderSkyProperties {
  return {
    kind: 'shader',
    code,
    parameters: {},
    textures: {},
    usage: { light: false, time: false, position: false, samplers: {} },
  };
}

const fragmentOf = (code: string) =>
  generatedFragmentShader(
    (transpiledShaderSky(shaderMaterial(code)).mesh.material as NodeMaterial).fragmentNode!
  );

describe('transpiledShaderSky', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("draws Godot's default sky for a shader Godot does not compile", () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    expect(fragmentOf('shader_type sky;\nvoid sky() { COLOR = 1.0; }\n')).toBe(
      generatedFragmentShader((transpileSky(GODOT_DEFAULT_SKY).mesh.material as NodeMaterial).fragmentNode!)
    );
  });

  it("warns with Godot's error and its line for a shader Godot does not compile", () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    transpiledShaderSky(shaderMaterial('shader_type sky;\n\nvoid sky() { COLOR = 1.0; }\n'));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[Sky\] Godot does not compile .* 3:\d+: /));
  });
});

describe('shaderSkyRefusal', () => {
  it("gives Godot's error and its line for a shader Godot does not compile", () => {
    expect(shaderSkyRefusal('shader_type sky;\n\nvoid sky() { COLOR = 1.0; }\n')).toMatch(
      /^Godot does not compile the sky shader, and draws its default sky: 3:\d+: /
    );
  });

  it('gives nothing for a shader the previewer draws', () => {
    expect(shaderSkyRefusal(TINTED_SKY)).toBeNull();
  });
});

describe('setParameters', () => {
  it('writes the Variant of each text to its uniform', () => {
    const tint = { set: vi.fn() };
    setParameters(new Map([['tint', tint]]), { tint: '0.25' }, {});
    expect(tint.set).toHaveBeenCalledWith({ type: 'FLOAT', value: 0.25 });
  });

  it('ignores a value no uniform declares', () => {
    expect(() => setParameters(new Map(), { gone: '1.0' }, { alsoGone: new THREE.Texture() })).not.toThrow();
  });

  it('writes each loaded texture to its sampler', () => {
    const stars = { set: vi.fn() };
    const texture = new THREE.Texture();
    setParameters(new Map([['stars', stars]]), {}, { stars: texture });
    expect(stars.set).toHaveBeenCalledWith(texture);
  });
});

describe('buildSkyEnvironment of a shader sky', () => {
  it('draws the background with the transpiled shader', async () => {
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const sky: Sky = decodeSky({}, shaderMaterial(TINTED_SKY));
    const environment = buildSkyEnvironment(renderer, { sky, lights: [], asBackground: true, energy: 1 });
    expect(environment?.background).toBeInstanceOf(ShaderSkyBackground);
    environment?.dispose();
  });
});
