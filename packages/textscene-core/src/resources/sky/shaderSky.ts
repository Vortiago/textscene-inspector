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
import {
  createSkyLayers,
  disposeSkyLayers,
  SkyLayerBaker,
  type DrawRadiance,
  type SkyLayers,
} from './skyLayers';
import { skyUsage } from '../../shaders/sky/skyUsage';
import { VECTOR3_ZERO, type Vector3 } from '../../godot/math/vector';
import { GODOT_DEFAULT_SKY } from '../../godot/rendering/environment/skyShader';
import type { ShaderSkyProperties, ShaderSkyText, SkyBake } from './types';
import type { RadianceInPlace, SkyEnvironment, SkyEnvironmentInput } from './build';

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
  let radiance: ShaderRadiance;
  try {
    background = asBackground ? new ShaderSkyBackground(transpiled('background'), lights) : null;
    radiance = new ShaderRadiance(
      gl,
      cappedBake(sky),
      new ShaderSkyOctmap(transpiled('octmap'), lights, material.usage.passColors),
      sampling
    );
  } catch (error) {
    warn('[Sky] could not render the sky environment', error);
    background?.dispose();
    return null;
  }
  // A sky that reads neither never bakes again, so it keeps only its layers.
  if (!material.usage.time && !material.usage.position) {
    const layers = radiance.releaseLayers();
    const dispose = () => {
      background?.dispose();
      disposeSkyLayers(layers);
    };
    return { background, layers, dispose };
  }
  return {
    background,
    layers: radiance.layers,
    radianceInPlace: radiance,
    dispose: () => {
      background?.dispose();
      radiance.dispose();
    },
  };
}

/** A shader sky's radiance from its octmap pass (`sky.cpp:1322`), kept for a dirty render to bake. */
class ShaderRadiance implements RadianceInPlace {
  readonly layers: SkyLayers;
  private readonly baker: SkyLayerBaker;

  /** Bakes the first radiance with `POSITION` at the origin. Disposes `octmapSky` if that fails. */
  constructor(
    private readonly gl: THREE.WebGLRenderer,
    bake: SkyBake,
    private readonly octmapSky: ShaderSkyOctmap,
    sampling: ProjectSampling
  ) {
    let layers: SkyLayers | undefined;
    try {
      layers = createSkyLayers(bake, sampling);
      this.baker = new SkyLayerBaker(gl, layers, bake.radianceFilter);
    } catch (error) {
      if (layers) disposeSkyLayers(layers);
      octmapSky.dispose();
      throw error;
    }
    this.layers = layers;
    try {
      this.bakeAgain(VECTOR3_ZERO);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  bakeAgain(position: Readonly<Vector3>): void {
    this.baker.bakeEveryLayer(this.drawnAt(position));
    this.octmapSky.keepRadianceMips(this.gl, this.layers);
  }

  bakeFirstLayerAgain(position: Readonly<Vector3>): void {
    this.baker.bakeFirstLayer(this.drawnAt(position));
    this.octmapSky.keepRadianceMips(this.gl, this.layers);
  }

  filterLayer(layer: number): void {
    this.baker.filterLayer(layer);
  }

  /** Frees what bakes the layers, and hands the layers to the caller, who frees them. */
  releaseLayers(): SkyLayers {
    this.baker.dispose();
    this.octmapSky.dispose();
    return this.layers;
  }

  dispose(): void {
    disposeSkyLayers(this.releaseLayers());
  }

  private drawnAt(position: Readonly<Vector3>): DrawRadiance {
    return (octmap, layout) => this.octmapSky.draw(this.gl, octmap, layout.borderSize, position);
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
