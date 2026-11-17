import * as THREE from 'three';
import { warn } from '../../logger';
import { warnOnce } from '../../utils/warnOnce';
import { textToVariant } from '../../godot/variant/reader/variantReader';
import { ShadingLanguageError } from '../../shaders/language/shadingLanguageError';
import { transpileParsedSky, type TranspiledSky } from '../../shaders/sky/transpileSky';
import { parsedShader, type ParsedShader } from '../../shaders/language/parseShader';
import { perObject } from '../../utils/perObject';
import type { TranspiledUniform } from '../../shaders/uniforms/transpiledUniform';
import type { ShaderDecoders } from '../../shaders/preprocessor/decoders';
import { ShaderSkyBackground, ShaderSkyCube } from '../../r3f/sky/shaderSkyBackground';
import { bakeRadiance } from './radianceBake';
import { disposeSkyLayers, type SkyLayers } from './skyLayers';
import type { SkyLight } from './skyUniforms';
import type { ShaderSkyProperties, Sky } from './types';
import type { SkyEnvironment, SkyEnvironmentInput } from './build';

/** The sky Godot draws for a sky material whose shader does not compile (`sky.cpp:807-814`, `:1480-1488`). */
export const GODOT_DEFAULT_SKY = `// Default sky shader.

shader_type sky;

void sky() {
\tCOLOR = vec3(0.0);
}
`;

/** Null when the sky cannot render, as `buildSkyEnvironment` answers. */
export function buildShaderSkyEnvironment(
  gl: THREE.WebGLRenderer,
  material: ShaderSkyProperties,
  { sky, lights, asBackground, textures = {}, decoders = {} }: SkyEnvironmentInput
): SkyEnvironment | null {
  const transpiled = () => transpiledShaderSky(material, { textures, decoders });
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

/** The parse of a text the previewer draws, or why it draws Godot's default sky instead. */
type SkyCompile = { readonly parsed: ParsedShader; readonly refusal: null } | { readonly refusal: string };

/** One compile per material and decoders, which every bake and the node details read. */
const skyCompileOf = perObject((material: ShaderSkyProperties) =>
  perObject((decoders: ShaderDecoders) => compileSky(material.code, decoders))
);

/** The first transpile proves the text: a refusal can come from the parse, the checks or the link. */
function compileSky(code: string, decoders: ShaderDecoders): SkyCompile {
  try {
    const parsed = parsedShader(code, { decoders });
    const { mesh } = transpileParsedSky(parsed, '');
    mesh.geometry.dispose();
    mesh.material.dispose();
    return { parsed, refusal: null };
  } catch (error) {
    if (!(error instanceof ShadingLanguageError)) throw error;
    return { refusal: refusalMessage(error) };
  }
}

/** Written once, by the first sky that draws the default. */
let defaultSkyParse: ParsedShader | undefined;

/** The sky of `material` with its parameters, or Godot's default sky for a shader it cannot draw. */
export function transpiledShaderSky(
  material: ShaderSkyProperties,
  { textures, decoders }: Required<Pick<SkyEnvironmentInput, 'textures' | 'decoders'>>
): TranspiledSky {
  const compile = skyCompileOf(material)(decoders);
  if (compile.refusal !== null) {
    warnOnce(material, 'refused', `[Sky] ${compile.refusal}`);
    defaultSkyParse ??= parsedShader(GODOT_DEFAULT_SKY);
    return transpileParsedSky(defaultSkyParse, '');
  }
  const sky = transpileParsedSky(compile.parsed, '');
  setParameters(sky.parameters, material.parameters, textures);
  return sky;
}

/** Writes each value its uniform takes. Godot ignores a value no uniform declares. */
export function setParameters(
  uniforms: ReadonlyMap<string, Pick<TranspiledUniform, 'set'>>,
  texts: Readonly<Record<string, string>>,
  textures: Readonly<Record<string, THREE.Texture>>
): void {
  for (const [name, text] of Object.entries(texts)) uniforms.get(name)?.set(textToVariant(text));
  for (const [name, texture] of Object.entries(textures)) uniforms.get(name)?.set(texture);
}

/** Why the previewer draws Godot's default sky for `material`, or null when it draws the shader. */
export function shaderSkyRefusal(material: ShaderSkyProperties, decoders: ShaderDecoders): string | null {
  return skyCompileOf(material)(decoders).refusal;
}

function refusalMessage(error: ShadingLanguageError): string {
  if (error.owner === undefined)
    return `Godot does not compile the sky shader, and draws its default sky: ${error.message}`;
  return `The previewer does not translate this sky shader yet (${error.owner}), and draws Godot's default sky: ${error.message}`;
}
