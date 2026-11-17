import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NodeMaterial } from 'three/webgpu';
import * as logger from '../../logger';
import * as parseShader from '../../shaders/language/parseShader';
import { generatedFragmentShader } from '../../shaders/generatedShader.testkit';
import { testRenderer } from '../../testing/recordingWebGL';
import { installNodesHandler } from '../../shaders/nodesHandler';
import { ShaderSkyBackground } from '../../r3f/sky/shaderSkyBackground';
import { shaderSkyRefusal } from './shaderSky';
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
    usage: { light: false, samplers: {} },
  };
}

/** Godot's default sky, which it draws for a shader it does not compile (`sky.cpp:807-814`). */
const DEFAULT_SKY = 'shader_type sky;\n\nvoid sky() {\n\tCOLOR = vec3(0.0);\n}\n';

async function backgroundFragmentOf(code: string): Promise<string> {
  const { renderer } = await testRenderer();
  installNodesHandler(renderer, 'linear');
  const sky: Sky = decodeSky({}, shaderMaterial(code));
  const environment = buildSkyEnvironment(renderer, { sky, lights: [], asBackground: true, energy: 1 })!;
  const fragment = generatedFragmentShader((environment.background!.material as NodeMaterial).fragmentNode!);
  environment.dispose();
  return fragment;
}

afterEach(() => {
  vi.restoreAllMocks();
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

  it('gives nothing, and throws nothing, for a defect that is no Godot error (error case)', () => {
    vi.spyOn(parseShader, 'parsedShader').mockImplementation(() => {
      throw new TypeError('a parser defect');
    });
    const material = shaderMaterial(TINTED_SKY);
    expect(shaderSkyRefusal(material, {})).toBeNull();
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
