import * as THREE from 'three';
import { warn } from '../../logger';
import { warnOnce } from '../../utils/warnOnce';
import { textToVariant } from '../../godot/variant/reader/variantReader';
import { transpileParsedSky, type TranspiledSky } from '../../shaders/sky/transpileSky';
import { compileSky, type SkyCompile } from '../../shaders/sky/compileSky';
import { perObject } from '../../utils/perObject';
import { LRUCache } from '../LRUCache';
import { GODOT_SAMPLING } from '../../shaders/uniforms/samplerState';
import type { TranspiledUniform } from '../../shaders/uniforms/transpiledUniform';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';
import type { ShaderDecoders } from '../../shaders/preprocessor/decoders';
import { ShaderSkyBackground, ShaderSkyCube } from '../../r3f/sky/shaderSkyBackground';
import { bakeRadiance } from './radianceBake';
import { disposeSkyLayers, type SkyLayers } from './skyLayers';
import type { SkyLight } from './skyUniforms';
import { skyUsage } from '../../shaders/sky/skyUsage';
import { GODOT_DEFAULT_SKY } from '../../godot/rendering/environment/skyShader';
import type { ShaderSkyProperties, ShaderSkyText, Sky } from './types';
import type { SkyEnvironment, SkyEnvironmentInput } from './build';

/** The sky shader with the built-ins it reads, which decide what draws and bakes it again. */
export function readShaderSky(material: ShaderSkyText, decoders: ShaderDecoders): ShaderSkyProperties {
  const compile = skyCompileOf(material.code, decoders);
  return { ...material, usage: skyUsage('parsed' in compile ? compile.parsed.tree : null) };
}

/** Null when the sky cannot render, as `buildSkyEnvironment` answers. */
export function buildShaderSkyEnvironment(
  gl: THREE.WebGLRenderer,
  material: ShaderSkyProperties,
  { sky, lights, asBackground, textures = {}, decoders = {}, sampling = GODOT_SAMPLING }: SkyEnvironmentInput
): SkyEnvironment | null {
  const transpiled = () => transpiledShaderSky(material, { textures, decoders, sampling });
  let background: ShaderSkyBackground | null = null;
  let layers: SkyLayers;
  try {
    background = asBackground ? new ShaderSkyBackground(transpiled(), lights) : null;
    layers = bakeShaderRadiance(gl, sky, transpiled(), lights);
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

/** Brightness 1 and no rotation (`sky.cpp:1275-1330`). The sky's own debanding noise is in the cube. */
function bakeShaderRadiance(
  gl: THREE.WebGLRenderer,
  sky: Sky,
  transpiled: TranspiledSky,
  lights: readonly SkyLight[]
): SkyLayers {
  const skyScene = new THREE.Scene();
  const cubeSky = new ShaderSkyCube(transpiled, lights);
  cubeSky.drawIn(skyScene, 1, new THREE.Euler());
  try {
    return bakeRadiance(gl, skyScene, sky, 0);
  } finally {
    cubeSky.dispose();
  }
}

/** Sky texts kept compiled for each decoders: the Source pane makes a new text at each keystroke. */
const KEPT_SKY_COMPILES = 8;

/** Written only by `skyCompileOf`: one compile per text, for the usage, every bake and the node details. */
const skyCompiles = perObject((_decoders: ShaderDecoders) => new LRUCache<SkyCompile>(KEPT_SKY_COMPILES));

function skyCompileOf(code: string, decoders: ShaderDecoders): SkyCompile {
  const compiles = skyCompiles(decoders);
  const kept = compiles.get(code);
  if (kept) return kept;
  const compile = compileSky(code, decoders);
  compiles.set(code, compile);
  return compile;
}

/** The default sky's compile, written once by the first sky that draws it. */
let defaultSky: SkyCompile | undefined;

/** The sky of `material` with its parameters, or Godot's default sky for a shader it cannot draw. */
function transpiledShaderSky(
  material: ShaderSkyProperties,
  { textures, decoders, sampling }: Required<Pick<SkyEnvironmentInput, 'textures' | 'decoders' | 'sampling'>>
): TranspiledSky {
  const compile = skyCompileOf(material.code, decoders);
  if (!('parsed' in compile)) {
    warnOnce(material, 'refused', `[Sky] ${unDrawnMessage(compile)}`);
    return transpiledDefaultSky();
  }
  const sky = transpileParsedSky(compile.parsed, '', sampling);
  setParameters(sky.parameters, material.parameters, textures);
  return sky;
}

function transpiledDefaultSky(): TranspiledSky {
  defaultSky ??= compileSky(GODOT_DEFAULT_SKY, {});
  if (!('parsed' in defaultSky)) throw new Error("expected Godot's default sky to compile");
  return transpileParsedSky(defaultSky.parsed, '');
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
export function shaderSkyRefusal(material: ShaderSkyText, decoders: ShaderDecoders): string | null {
  const compile = skyCompileOf(material.code, decoders);
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
