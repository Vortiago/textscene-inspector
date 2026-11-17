import * as THREE from 'three';
import { warn } from '../../logger';
import { warnOnce } from '../../utils/warnOnce';
import { textToVariant } from '../../godot/variant/reader/variantReader';
import { transpileParsedSky, type TranspiledSky } from '../../shaders/sky/transpileSky';
import { compileSky, type SkyCompile, type SkyRefusal } from '../../shaders/sky/compileSky';
import { perObject } from '../../utils/perObject';
import { GODOT_SAMPLING } from '../../shaders/uniforms/samplerState';
import type { TranspiledUniform } from '../../shaders/uniforms/transpiledUniform';
import type { ShaderDecoders } from '../../shaders/preprocessor/decoders';
import { ShaderSkyBackground, ShaderSkyCube } from '../../r3f/sky/shaderSkyBackground';
import { bakeRadiance } from './radianceBake';
import { disposeSkyLayers, type SkyLayers } from './skyLayers';
import type { SkyLight } from './skyUniforms';
import { skyUsage } from '../../shaders/sky/skyUsage';
import type { ShaderSkyProperties, ShaderSkyText, Sky } from './types';
import type { SkyEnvironment, SkyEnvironmentInput } from './build';

/** The sky Godot draws for a sky material whose shader does not compile (`sky.cpp:807-814`, `:1480-1488`). */
const GODOT_DEFAULT_SKY = `// Default sky shader.

shader_type sky;

void sky() {
\tCOLOR = vec3(0.0);
}
`;

/** The sky shader with the built-ins it reads, which decide what draws and bakes it again. */
export function readShaderSky(material: ShaderSkyText, decoders: ShaderDecoders): ShaderSkyProperties {
  return { ...material, usage: skyUsage(material.code, { decoders }) };
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

/** One compile per material and decoders, which every bake and the node details read. */
const skyCompileOf = perObject((material: ShaderSkyText) =>
  perObject((decoders: ShaderDecoders): SkyCompile => compileSky(material.code, decoders))
);

/** The default sky's compile, written once by the first sky that draws it. */
let defaultSky: SkyCompile | undefined;

/** The sky of `material` with its parameters, or Godot's default sky for a shader it cannot draw. */
function transpiledShaderSky(
  material: ShaderSkyProperties,
  { textures, decoders, sampling }: Required<Pick<SkyEnvironmentInput, 'textures' | 'decoders' | 'sampling'>>
): TranspiledSky {
  const compile = skyCompileOf(material)(decoders);
  if (compile.refusal !== null) {
    warnOnce(material, 'refused', `[Sky] ${refusalMessage(compile.refusal)}`);
    defaultSky ??= compileSky(GODOT_DEFAULT_SKY, {});
    if (!('parsed' in defaultSky)) throw new Error("expected Godot's default sky to compile");
    return transpileParsedSky(defaultSky.parsed, '');
  }
  if ('failure' in compile) throw compile.failure;
  const sky = transpileParsedSky(compile.parsed, '', sampling);
  setParameters(sky.parameters, material.parameters, textures);
  return sky;
}

/** Writes each value its uniform takes. Godot ignores a value no uniform declares. */
function setParameters(
  uniforms: ReadonlyMap<string, Pick<TranspiledUniform, 'set'>>,
  texts: Readonly<Record<string, string>>,
  textures: Readonly<Record<string, THREE.Texture>>
): void {
  for (const [name, text] of Object.entries(texts)) uniforms.get(name)?.set(textToVariant(text));
  for (const [name, texture] of Object.entries(textures)) uniforms.get(name)?.set(texture);
}

/** Why the previewer draws Godot's default sky for `material`, or null when it draws the shader. */
export function shaderSkyRefusal(material: ShaderSkyText, decoders: ShaderDecoders): string | null {
  const { refusal } = skyCompileOf(material)(decoders);
  return refusal && refusalMessage(refusal);
}

function refusalMessage(error: SkyRefusal): string {
  if (error.owner === undefined)
    return `Godot does not compile the sky shader, and draws its default sky: ${error.message}`;
  return `The previewer does not translate this sky shader yet (${error.owner}), and draws Godot's default sky: ${error.message}`;
}
