import * as THREE from 'three';
import { warn } from '../../logger';
import { warnOnce } from '../../utils/warnOnce';
import { textToVariant } from '../../godot/variant/reader/variantReader';
import {
  skyDraws,
  transpileParsedSky,
  type SkyPass,
  type TranspiledSky,
} from '../../shaders/sky/transpileSky';
import { compileSky, type SkyCompile } from '../../shaders/sky/compileSky';
import { perObject } from '../../utils/perObject';
import { LRUCache } from '../LRUCache';
import { GODOT_SAMPLING } from '../../shaders/uniforms/samplerState';
import type { TranspiledUniform } from '../../shaders/uniforms/transpiledUniform';
import type { BoundNodeMaterial } from '../../shaders/uniforms/boundMaterial';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';
import type { ProjectShaderOptions } from '../../shaders/rendererShaderOptions';
import { ShaderSkyBackground } from '../../r3f/sky/shaderSkyBackground';
import { ShaderSkyOctmap } from '../../r3f/sky/shaderSkyOctmap';
import { cappedBake } from './radianceBake';
import { disposeSkyLayers } from './skyLayers';
import { OctmapRadiance } from './octmapRadiance';
import { skyUsage } from '../../shaders/sky/skyUsage';
import { GODOT_DEFAULT_SKY } from '../../godot/rendering/environment/skyShader';
import type { ShaderSkyProperties, ShaderSkyText } from './types';
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
  let octmapSky: ShaderSkyOctmap | null = null;
  let radiance: OctmapRadiance;
  try {
    background = asBackground ? new ShaderSkyBackground(transpiled('background'), lights) : null;
    octmapSky = new ShaderSkyOctmap(transpiled('octmap'), lights, material.usage.passColors);
    radiance = new OctmapRadiance(gl, cappedBake(sky), octmapSky, sampling);
  } catch (error) {
    warn('[Sky] could not render the sky environment', error);
    background?.dispose();
    return null;
  }
  const { usage } = material;
  // A sky that reads none of them never bakes again, so it keeps only its layers.
  if (!usage.time && !usage.position && !usage.light) {
    const layers = radiance.releaseLayers();
    const dispose = () => {
      background?.dispose();
      disposeSkyLayers(layers);
    };
    return { background, layers, dispose };
  }
  const shownOctmap = octmapSky;
  return {
    background,
    layers: radiance.layers,
    radianceInPlace: radiance,
    setLights: (next) => {
      background?.setLights(next);
      shownOctmap.setLights(next);
    },
    dispose: () => {
      background?.dispose();
      radiance.dispose();
    },
  };
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
    warnOnce(material, 'refused', `[Sky] ${unDrawnMessage(compile)}`);
    return transpiledDefaultSky(pass);
  }
  const sky = transpileParsedSky(compile.parsed, material.file, sampling, pass);
  setParameters(sky.parameters, material.parameters, textures);
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

/** Writes each value its uniform takes. Godot ignores a value no uniform declares. */
function setParameters(
  uniforms: ReadonlyMap<string, Pick<TranspiledUniform, 'set'>>,
  texts: Readonly<Record<string, string>>,
  textures: Readonly<Record<string, SamplerValue>>
): void {
  for (const [name, text] of Object.entries(texts)) uniforms.get(name)?.set(textToVariant(text));
  for (const [name, texture] of Object.entries(textures)) uniforms.get(name)?.set(texture);
}

/** Why the previewer draws Godot's default sky for `material`, or null when it draws the shader. */
export function shaderSkyRefusal(material: ShaderSkyText, options: ProjectShaderOptions): string | null {
  const compile = skyCompileOf(material.code, options);
  return 'parsed' in compile ? null : unDrawnMessage(compile);
}

type UnDrawnSky = Exclude<SkyCompile, { readonly parsed: unknown }>;

function unDrawnMessage(compile: UnDrawnSky): string {
  if ('failure' in compile)
    return `The previewer failed to translate this sky shader, and draws Godot's default sky: ${String(compile.failure)}`;
  const { refusal } = compile;
  if (refusal.owner === undefined)
    return `Godot does not compile the sky shader, and draws its default sky: ${refusal.message}`;
  return `The previewer does not translate this sky shader yet (${refusal.owner}), and draws Godot's default sky: ${refusal.message}`;
}
