import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import type { NodeMaterial } from 'three/webgpu';
import * as logger from '../../logger';
import * as parseShader from '../../shaders/language/parseShader';
import { generatedFragmentShader } from '../../shaders/generatedShader.testkit';
import { testRenderer } from '../../testing/recordingWebGL';
import { installNodesHandler } from '../../shaders/nodesHandler';
import { TranslatorFault } from '../../shaders/fault/translatorFault';
import type { BoundNodeMaterial } from '../../shaders/uniforms/boundMaterial';
import { ShaderSkyBackground } from '../../r3f/sky/shaderSkyBackground';
import { buildShaderSkyEnvironment, readShaderSky, shaderSkyRefusal } from './shaderSky';
import { buildSkyEnvironment } from './build';
import { decodeSky } from './decode';
import type { ShaderSkyProperties, Sky } from './types';

const SKY_FILE = 'res://tinted_sky.gdshader';

const TINTED_SKY = 'shader_type sky;\nuniform float tint = 0.5;\nvoid sky() {\n\tCOLOR = vec3(tint);\n}\n';

function shaderMaterial(code: string): ShaderSkyProperties {
  return readShaderSky({ kind: 'shader', code, file: SKY_FILE, parameters: {}, textures: {} }, {});
}

/** The environment of `sky` with the transpiler, as the previewer builds it once the transpiler loads. */
function shaderSkyEnvironment(renderer: THREE.WebGLRenderer, sky: Sky) {
  return buildSkyEnvironment(renderer, {
    sky,
    lights: [],
    asBackground: true,
    energy: 1,
    buildShaderSky: buildShaderSkyEnvironment,
  });
}

/** Godot's default sky, which it draws for a shader it does not compile (`sky.cpp:807-814`). */
const DEFAULT_SKY = 'shader_type sky;\n\nvoid sky() {\n\tCOLOR = vec3(0.0);\n}\n';

async function backgroundFragmentOf(code: string): Promise<string> {
  const { renderer } = await testRenderer();
  installNodesHandler(renderer, 'linear');
  const sky: Sky = decodeSky({}, shaderMaterial(code));
  const environment = shaderSkyEnvironment(renderer, sky)!;
  const fragment = generatedFragmentShader((environment.background!.material as NodeMaterial).fragmentNode!);
  environment.dispose();
  return fragment;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildSkyEnvironment of a shader the previewer fails to translate', () => {
  it("draws Godot's default sky", async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const defectiveSky = TINTED_SKY.replace('0.5', '0.75');
    const parse = parseShader.parsedShader;
    vi.spyOn(parseShader, 'parsedShader').mockImplementation((code, options) => {
      if (code === defectiveSky) throw new TypeError('a parser defect');
      return parse(code, options);
    });
    expect(await backgroundFragmentOf(defectiveSky)).toBe(await backgroundFragmentOf(DEFAULT_SKY));
  });
});

describe('buildSkyEnvironment of a shader Godot does not compile', () => {
  it("draws Godot's default sky", async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    expect(await backgroundFragmentOf('shader_type sky;\nvoid sky() { COLOR = 1.0; }\n')).toBe(
      await backgroundFragmentOf(DEFAULT_SKY)
    );
  });

  it("warns with Godot's error and its line", async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await backgroundFragmentOf('shader_type sky;\n\nvoid sky() { COLOR = 1.0; }\n');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[Sky\] Godot does not compile .* 3:\d+: /));
  });
});

describe('shaderSkyRefusal', () => {
  it("gives Godot's error and its line for a shader Godot does not compile", () => {
    expect(shaderSkyRefusal(shaderMaterial('shader_type sky;\n\nvoid sky() { COLOR = 1.0; }\n'), {})).toMatch(
      /^Godot does not compile the sky shader, and draws its default sky: 3:\d+: /
    );
  });

  it('gives nothing for a shader the previewer draws', () => {
    expect(shaderSkyRefusal(shaderMaterial(TINTED_SKY), {})).toBeNull();
  });

  it('names a defect that is no Godot error, as the previewer draws the default sky for it (error case)', () => {
    vi.spyOn(parseShader, 'parsedShader').mockImplementation(() => {
      throw new TypeError('a parser defect');
    });
    const material = shaderMaterial(TINTED_SKY.replace('0.5', '0.25'));
    expect(shaderSkyRefusal(material, {})).toBe(
      "The previewer failed to translate this sky shader, and draws Godot's default sky: TypeError: a parser defect"
    );
  });
});

describe('buildSkyEnvironment of a shader sky', () => {
  it('draws the background with the transpiled shader', async () => {
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const sky: Sky = decodeSky({}, shaderMaterial(TINTED_SKY));
    const environment = shaderSkyEnvironment(renderer, sky);
    expect(environment?.background).toBeInstanceOf(ShaderSkyBackground);
    environment?.dispose();
  });

  it('warns that the previewer failed when the GPU refuses the transpiled program', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const environment = shaderSkyEnvironment(renderer, decodeSky({}, shaderMaterial(TINTED_SKY)))!;
    const material = environment.background!.material as BoundNodeMaterial;
    material.reportFault(new TranslatorFault(material.source, 'fragment: ERROR: 0:1'));
    expect(warn.mock.calls.map(([message]) => message)).toContainEqual(
      expect.stringMatching(
        /^\[Sky\] The previewer failed to draw this sky shader: .*res:\/\/tinted_sky\.gdshader.*ERROR: 0:1/
      )
    );
    environment.dispose();
  });

  it('throws without the transpiler, which a shader sky needs (error case)', async () => {
    const { renderer } = await testRenderer();
    const sky: Sky = decodeSky({}, shaderMaterial(TINTED_SKY));
    expect(() => buildSkyEnvironment(renderer, { sky, lights: [], asBackground: true, energy: 1 })).toThrow(
      'expected the sky transpiler for a shader sky, got none'
    );
  });
});
