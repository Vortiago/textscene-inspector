import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { NodeMaterial } from 'three/webgpu';
import * as logger from '../../logger';
import * as parseShader from '../../shaders/language/parseShader';
import * as transpileSky from '../../shaders/sky/transpileSky';
import * as skyBindings from '../../shaders/sky/skyBindings';
import { generatedFragmentShader } from '../../shaders/generatedShader.testkit';
import { testRenderer } from '../../testing/recordingWebGL';
import { installNodesHandler } from '../../shaders/nodesHandler';
import { TranslatorFault } from '../../shaders/fault/translatorFault';
import type { BoundNodeMaterial } from '../../shaders/uniforms/boundMaterial';
import { ShaderSkyBackground } from '../../r3f/sky/shaderSkyBackground';
import { buildShaderSkyEnvironment, readShaderSky, shaderSkyRefusal } from './shaderSky';
import { decodeSky } from './decode';
import { skyMaterialText } from './skyMaterialText';
import type { ShaderSkyProperties, Sky } from './types';

const SKY_FILE = 'res://tinted_sky.gdshader';

const TIME_SKY = 'shader_type sky;\nvoid sky() {\n\tCOLOR = vec3(fract(TIME));\n}\n';

const SUN_SKY = 'shader_type sky;\nvoid sky() {\n\tCOLOR = vec3(LIGHT0_ENERGY);\n}\n';

const TINTED_SKY = 'shader_type sky;\nuniform float tint = 0.5;\nvoid sky() {\n\tCOLOR = vec3(tint);\n}\n';

function shaderMaterial(code: string): ShaderSkyProperties {
  return readShaderSky({ code, file: SKY_FILE, parameters: {}, textures: {} }, { decoders: {} });
}

/** The environment of `sky` as the background, as the previewer builds it once the transpiler loads. */
function shaderSkyEnvironment(renderer: THREE.WebGLRenderer, sky: Sky, asBackground = true) {
  return buildShaderSkyEnvironment(renderer, { sky, lights: [], asBackground, energy: 1 });
}

/** A Sky of `properties` over `type`, a material whose shader Godot generates, at its defaults. */
function builtInSky(type: string, properties: Record<string, string> = {}): Sky {
  return decodeSky(properties, readShaderSky(skyMaterialText(type, {}, {})!, { decoders: {} }));
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
    expect(
      shaderSkyRefusal(shaderMaterial('shader_type sky;\n\nvoid sky() { COLOR = 1.0; }\n'), { decoders: {} })
    ).toMatch(/^Godot does not compile the sky shader, and draws its default sky: 3:\d+: /);
  });

  it('gives nothing for a shader the previewer draws', () => {
    expect(shaderSkyRefusal(shaderMaterial(TINTED_SKY), { decoders: {} })).toBeNull();
  });

  it("parses with the project's rendering method", () => {
    const material = shaderMaterial(
      'shader_type sky;\nuniform sampler2D t : hint_normal_roughness_texture;\nvoid sky() {}\n'
    );
    const refusals = ['forward_plus', 'mobile', 'Forward_Plus'].map((renderingMethod) =>
      shaderSkyRefusal(material, { decoders: {}, renderingMethod })
    );
    expect(refusals).toEqual([
      expect.stringContaining("'hint_normal_roughness_texture' is not supported in 'sky' shaders."),
      expect.stringContaining(
        "'hint_normal_roughness_texture' is only available when using the Forward+ renderer."
      ),
      expect.stringContaining(
        "'hint_normal_roughness_texture' is only available when using the Forward+ renderer."
      ),
    ]);
  });

  it('names a defect that is no Godot error, as the previewer draws the default sky for it (error case)', () => {
    vi.spyOn(parseShader, 'parsedShader').mockImplementation(() => {
      throw new TypeError('a parser defect');
    });
    const material = shaderMaterial(TINTED_SKY.replace('0.5', '0.25'));
    expect(shaderSkyRefusal(material, { decoders: {} })).toBe(
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

  it('warns with the shader named when the GPU refuses the program of a half resolution pass', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const transpile = vi.spyOn(transpileSky, 'transpileParsedSky');
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const halfResSky = TINTED_SKY.replace(
      'shader_type sky;',
      'shader_type sky;\nrender_mode use_half_res_pass;'
    );
    const environment = shaderSkyEnvironment(renderer, decodeSky({}, shaderMaterial(halfResSky)))!;
    // The background draw of this shader, not the compile check, which has no file and is disposed.
    const background = transpile.mock.calls.findIndex(
      ([, file, , pass]) => file === SKY_FILE && pass === 'background'
    );
    const half = transpile.mock.results[background]!.value.half.mesh.material as BoundNodeMaterial;
    half.reportFault(new TranslatorFault(half.source, 'fragment: ERROR: 0:7'));
    expect(warn.mock.calls.map(([message]) => message)).toContainEqual(
      expect.stringMatching(
        /^\[Sky\] The previewer failed to draw .*res:\/\/tinted_sky\.gdshader.*ERROR: 0:7/
      )
    );
    environment.dispose();
  });

  it('bakes the radiance again into the layers its readers sample', async () => {
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const environment = shaderSkyEnvironment(renderer, decodeSky({}, shaderMaterial(TIME_SKY)))!;
    const copy = vi.spyOn(renderer, 'copyTextureToTexture');
    environment.radianceInPlace!.bakeAgain(new THREE.Vector3(0, 1, 0), 1);
    expect(copy.mock.calls.map(([, into]) => into)).toContain(environment.layers.target.texture);
    environment.dispose();
  });

  it('bakes the radiance again with the lights it is shown after the build', async () => {
    const writes = vi.spyOn(skyBindings, 'writeSkyBindings');
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const environment = shaderSkyEnvironment(renderer, decodeSky({}, shaderMaterial(SUN_SKY)))!;
    const sun = {
      direction: new THREE.Vector3(0, 1, 0),
      color: new THREE.Color(1, 1, 1),
      energy: 2,
      size: 0,
    };
    environment.setLights!([sun]);
    writes.mockClear();

    environment.radianceInPlace!.bakeFirstLayerAgain(new THREE.Vector3(), 1);

    expect(writes.mock.calls.map(([, scene]) => scene.lights[0]?.energy)).toContain(2);
    environment.dispose();
  });

  it('keeps nothing to bake again for a sky that reads no light, TIME or POSITION (edge case)', async () => {
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const environment = shaderSkyEnvironment(renderer, decodeSky({}, shaderMaterial(TINTED_SKY)))!;

    expect([environment.radianceInPlace, environment.setLights]).toEqual([undefined, undefined]);
    environment.dispose();
  });
});

describe('buildShaderSkyEnvironment of a sky material whose shader Godot generates', () => {
  it("bakes the sky's layers without reading a pixel back", async () => {
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const readBack = vi.spyOn(renderer.getContext(), 'readPixels');
    const environment = shaderSkyEnvironment(renderer, builtInSky('ProceduralSkyMaterial'));

    expect(environment).not.toBeNull();
    expect(readBack).not.toHaveBeenCalled();
    environment?.dispose();
  });

  it('bakes the layers of a radiance above 256 at 256, 640 texels wide (edge case)', async () => {
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const sky = builtInSky('ProceduralSkyMaterial', { radiance_size: '5' });
    const environment = shaderSkyEnvironment(renderer, sky, false)!;

    expect(environment.layers.target.width).toBe(640);
    environment.dispose();
  });

  it('builds no background for a sky that is not the background', async () => {
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const environment = shaderSkyEnvironment(renderer, builtInSky('PhysicalSkyMaterial'), false)!;

    expect(environment.background).toBeNull();
    environment.dispose();
  });

  it('keeps nothing to bake again for a PanoramaSkyMaterial, whose shader reads no light (edge case)', async () => {
    const { renderer } = await testRenderer();
    installNodesHandler(renderer, 'linear');
    const environment = shaderSkyEnvironment(renderer, builtInSky('PanoramaSkyMaterial'))!;

    expect([environment.radianceInPlace, environment.setLights]).toEqual([undefined, undefined]);
    environment.dispose();
  });
});
