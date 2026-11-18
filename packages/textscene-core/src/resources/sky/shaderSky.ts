import * as THREE from 'three';
import { warn } from '../../logger';
import { warnOnce } from '../../utils/warnOnce';
import {
  skyDraws,
  transpileParsedSky,
  type SkyPass,
  type TranspiledSky,
} from '../../shaders/sky/transpileSky';
import { compileSky, type SkyCompile } from '../../shaders/sky/compileSky';
import { unDrawnMessage } from '../../shaders/fault/shaderRefusal';
import { perObject } from '../../utils/perObject';
import { LRUCache } from '../LRUCache';
import { GODOT_SAMPLING, type ProjectSampling } from '../../shaders/uniforms/samplerState';
import { setMaterialParameters } from '../../shaders/uniforms/materialParameters';
import type { BoundNodeMaterial } from '../../shaders/uniforms/boundMaterial';
import type { ProjectShaderOptions } from '../../shaders/rendererShaderOptions';
import { ShaderSkyBackground } from '../../r3f/sky/shaderSkyBackground';
import { ShaderSkyOctmap } from '../../r3f/sky/shaderSkyOctmap';
import { cappedBake } from './radianceBake';
import { bakeSkyLayersDrawnBy, disposeSkyLayers, type SkyLayers } from './skyLayers';
import type { SkyLight } from './skyUniforms';
import { skyUsage } from '../../shaders/sky/skyUsage';
import { GODOT_DEFAULT_SKY } from '../../godot/rendering/environment/skyShader';
import type { ShaderSkyProperties, ShaderSkyText, Sky } from './types';
import type { SkyEnvironment, SkyEnvironmentInput } from './build';

/** The sky shader with the built-ins it reads, which decide what draws and bakes it again. */
export function readShaderSky(material: ShaderSkyText, options: ProjectShaderOptions): ShaderSkyProperties {
  const compile = skyCompileOf(material.code, options);
  return { ...material, usage: skyUsage('parsed' in compile ? compile.parsed.tree : null) };
}

/** Null when the sky cannot render, as `buildSkyEnvironment` answers. */
export function buildShaderSkyEnvironment(
  gl: THREE.WebGLRenderer,
  material: ShaderSkyProperties,
  {
    sky,
    lights,
    asBackground,
    textures = {},
    shaderOptions = NO_OPTIONS,
    sampling = GODOT_SAMPLING,
  }: SkyEnvironmentInput
): SkyEnvironment | null {
  const transpiled = (pass: SkyPass) =>
    transpiledShaderSky(material, { textures, shaderOptions, sampling }, pass);
  let background: ShaderSkyBackground | null = null;
  let layers: SkyLayers;
  try {
    background = asBackground ? new ShaderSkyBackground(transpiled('background'), lights) : null;
    layers = bakeShaderRadiance(gl, { sky, transpiled: transpiled('octmap'), lights, sampling });
  } catch (error) {
    warn('[Sky] could not render the sky environment', error);
    background?.dispose();
    return null;
  }
  return {
    background,
    layers,
    dispose: () => {
      background?.dispose();
      disposeSkyLayers(layers);
    },
  };
}

/** What a shader sky's bake reads. */
interface ShaderRadiance {
  sky: Sky;
  transpiled: TranspiledSky;
  lights: readonly SkyLight[];
  sampling: ProjectSampling;
}

/** The sky's octmap pass drawn into the radiance, as Godot bakes a sky shader (`sky.cpp:1322-1331`). */
function bakeShaderRadiance(
  gl: THREE.WebGLRenderer,
  { sky, transpiled, lights, sampling }: ShaderRadiance
): SkyLayers {
  const octmapSky = new ShaderSkyOctmap(transpiled, lights);
  try {
    return bakeSkyLayersDrawnBy(
      gl,
      (octmap, layout) => octmapSky.draw(gl, octmap, layout.borderSize),
      cappedBake(sky),
      sampling
    );
  } finally {
    octmapSky.dispose();
  }
}

/** Sky texts kept compiled for each options: the Source pane makes a new text at each keystroke. */
const KEPT_SKY_COMPILES = 8;

/** Written only by `skyCompileOf`: one compile per text, for the usage, every bake and the node details. */
const skyCompiles = perObject(
  (_options: ProjectShaderOptions) => new LRUCache<SkyCompile>(KEPT_SKY_COMPILES)
);

/** The options of a caller that gives none: Forward+ and no decoders. */
const NO_OPTIONS: ProjectShaderOptions = { decoders: {} };

function skyCompileOf(code: string, options: ProjectShaderOptions): SkyCompile {
  const compiles = skyCompiles(options);
  const kept = compiles.get(code);
  if (kept) return kept;
  const compile = compileSky(code, options);
  compiles.set(code, compile);
  return compile;
}

/** The default sky's compile, written once by the first sky that draws it. */
let defaultSky: SkyCompile | undefined;

/** The sky of `material` for `pass` with its parameters, or Godot's default sky for one it cannot draw. */
function transpiledShaderSky(
  material: ShaderSkyProperties,
  {
    textures,
    shaderOptions,
    sampling,
  }: Required<Pick<SkyEnvironmentInput, 'textures' | 'shaderOptions' | 'sampling'>>,
  pass: SkyPass
): TranspiledSky {
  const compile = skyCompileOf(material.code, shaderOptions);
  if (!('parsed' in compile)) {
    warnOnce(material, 'refused', `[Sky] ${unDrawnMessage(compile, 'sky', 'sky')}`);
    return transpiledDefaultSky(pass);
  }
  const sky = transpileParsedSky(compile.parsed, material.file, sampling, pass);
  setMaterialParameters(sky.parameters, material.parameters, textures);
  for (const draw of skyDraws(sky))
    (draw.mesh.material as BoundNodeMaterial).onTranslatorFault = (fault) =>
      warnOnce(
        material,
        'translator fault',
        `[Sky] The previewer failed to draw this sky shader: ${fault.message}`
      );
  return sky;
}

function transpiledDefaultSky(pass: SkyPass): TranspiledSky {
  defaultSky ??= compileSky(GODOT_DEFAULT_SKY, NO_OPTIONS);
  if (!('parsed' in defaultSky)) throw new Error("expected Godot's default sky to compile");
  return transpileParsedSky(defaultSky.parsed, '', GODOT_SAMPLING, pass);
}

/** Why the previewer draws Godot's default sky for `material`, or null when it draws the shader. */
export function shaderSkyRefusal(material: ShaderSkyText, options: ProjectShaderOptions): string | null {
  const compile = skyCompileOf(material.code, options);
  return 'parsed' in compile ? null : unDrawnMessage(compile, 'sky', 'sky');
}
