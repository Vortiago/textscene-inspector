import * as THREE from 'three';
import { warn } from '../../logger';
import { warnOnce } from '../../utils/warnOnce';
import { textToVariant } from '../../godot/variant/reader/variantReader';
import { ShadingLanguageError } from '../../shaders/language/shadingLanguageError';
import { transpileSky, type TranspiledSky } from '../../shaders/sky/transpileSky';
import type { TranspiledUniform } from '../../shaders/uniforms/transpiledUniform';
import { ShaderSkyBackground } from '../../r3f/sky/shaderSkyBackground';
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
  { sky, lights, asBackground }: SkyEnvironmentInput
): SkyEnvironment | null {
  let background: ShaderSkyBackground | null = null;
  let layers: SkyLayers;
  try {
    background = asBackground ? new ShaderSkyBackground(transpiledShaderSky(material), lights) : null;
    layers = bakeShaderRadiance(gl, sky, material, lights);
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
  material: ShaderSkyProperties,
  lights: readonly SkyLight[]
): SkyLayers {
  const skyScene = new THREE.Scene();
  const cubeSky = new ShaderSkyBackground(transpiledShaderSky(material), lights);
  cubeSky.drawIn(skyScene, 1, new THREE.Euler());
  try {
    return bakeRadiance(gl, skyScene, sky, 0);
  } finally {
    cubeSky.dispose();
  }
}

/** The sky of `material` with its parameters, or Godot's default sky for a shader it cannot draw. */
export function transpiledShaderSky(material: ShaderSkyProperties): TranspiledSky {
  let sky: TranspiledSky;
  try {
    sky = transpileSky(material.code);
  } catch (error) {
    if (!(error instanceof ShadingLanguageError)) throw error;
    warnOnce(material, 'refused', refusalMessage(error));
    return transpileSky(GODOT_DEFAULT_SKY);
  }
  setParameters(sky.parameters, material.parameters);
  return sky;
}

/** Writes each value of `texts` its uniform takes. Godot ignores a value no uniform declares. */
export function setParameters(
  uniforms: ReadonlyMap<string, Pick<TranspiledUniform, 'set'>>,
  texts: Readonly<Record<string, string>>
): void {
  for (const [name, text] of Object.entries(texts)) uniforms.get(name)?.set(textToVariant(text));
}

function refusalMessage(error: ShadingLanguageError): string {
  if (error.owner === undefined)
    return `[Sky] Godot does not compile the sky shader, and draws its default sky: ${error.message}`;
  return `[Sky] the previewer does not translate this sky shader yet (${error.owner}), and draws Godot's default sky: ${error.message}`;
}
