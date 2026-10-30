/**
 * One renderer's volumetric fog: Godot's froxel passes, drawn slice by slice into 3D targets, and
 * the volume every fog program samples. Each scene keeps its own volume and history, so a scene
 * that holds still redraws nothing once it converges, and the renderer's volume takes a copy of
 * whichever scene renders next.
 */

import * as THREE from 'three';
import {
  VOLUMETRIC_FOG_CELL_CENTRE,
  VOLUMETRIC_FOG_FILTER_WEIGHTS,
  VOLUMETRIC_FOG_LIT_DENSITY_MIN,
  VOLUMETRIC_FOG_TEMPORAL_JITTERS,
  volumetricFogFrustum,
  volumetricFogGrid,
  volumetricFogLookup,
  volumetricFogSliceDepths,
  type FogProjection,
  type VolumetricFogGrid,
  type VolumetricFogProjectSettings,
} from '../../godot/rendering/environment/volumetricFog.js';
import type { VolumetricFog } from '../../resources/environment/types.js';
import { directionalShadowAtlasDepth } from '../directionalShadow/shadowAtlas.js';
import { drawFullScreen, fullScreenPass } from '../fullScreenPass.js';
import { setGodotColorLinear } from '../godotColor.js';
import { drawOffscreen } from '../offscreen.js';
import { positionalShadowAtlasDepth } from '../positionalShadow/shadowAtlasTarget.js';
import { drawWithUncomparedDepth } from '../shadowFilter/uncomparedDepth.js';
import { areaLightAtlasTexture } from '../areaLight/areaLightAtlas.js';
import { AREA_LIGHT_ATLAS_UNIFORM } from '../areaLight/areaTextureFetch.js';
import { CasterPose } from './casterPose.js';
import { FOG_LIGHT_TEXELS, FogLightRows } from './fogLights.js';
import { FogDensityAtlas } from './fogDensityAtlas.js';
import { RowTexture } from '../rowTexture/rowTexture.js';
import type { FogVolumeObject } from './fogVolumeObject.js';
import { FOG_VOLUME_TEXELS, FogVolumeRows, type FogVolumeView } from './fogVolumeRows.js';
import { SHOWN_ENERGY, shownLayers, shownSky, skyRadianceUniforms, skyRotation } from '../sky/skyRadiance.js';
import { fogUniforms } from './fogUniforms.js';
import {
  FOG_COPY_FRAGMENT,
  FOG_FILTER_FRAGMENT,
  FOG_INTEGRATE_FRAGMENT,
  FOG_LIGHT_FRAGMENT,
} from './volumetricFogShaders.js';

interface VolumetricFogInputs {
  fog: VolumetricFog;
  project: VolumetricFogProjectSettings;
  /** The scene's lights, hidden ones included. */
  lights: readonly THREE.Light[];
  /** The scene's meshes, whose pose moves the shadows the fog reads. */
  casters: readonly THREE.Mesh[];
  /** The scene's FogVolumes, hidden ones included. */
  volumes: readonly FogVolumeObject[];
}

/** The volume's rows run bottom-up, so a jitter's top-down y flips. */
const JITTER_OFFSETS = VOLUMETRIC_FOG_TEMPORAL_JITTERS.map(([x, y, z]) => new THREE.Vector3(x, 1 - y, z));
const CENTRE_OFFSET = new THREE.Vector3(...VOLUMETRIC_FOG_CELL_CENTRE);

const FILTER_X = new THREE.Vector3(1, 0, 0);
const FILTER_Y = new THREE.Vector3(0, 1, 0);

/** The camera's frustum as the fog reads it: its near and far sections in view space. */
function fogProjection(camera: THREE.Camera): FogProjection {
  const near = sectionAt(camera, -1);
  const far = sectionAt(camera, 1);
  return {
    near: -near.z,
    far: -far.z,
    nearHalfExtents: { x: Math.abs(near.x), y: Math.abs(near.y) },
    farHalfExtents: { x: Math.abs(far.x), y: Math.abs(far.y) },
    isOrthographic: (camera as THREE.OrthographicCamera).isOrthographicCamera === true,
  };
}

/** The fog of `camera`'s view as its FogVolumes find their froxels (`environment/fog.cpp:582-596`). */
function fogVolumeView(camera: THREE.Camera, fog: VolumetricFog, grid: VolumetricFogGrid): FogVolumeView {
  const projection = fogProjection(camera);
  const { x, y } = projection.nearHalfExtents;
  return {
    ...volumetricFogFrustum(projection, fog.length),
    grid,
    length: fog.length,
    detailSpread: fog.detailSpread,
    nearCornerDistance: Math.hypot(x, y, projection.near),
  };
}

/** Scratch for the shown sky's world to sky space, overwritten by each draw. */
const worldToSky = new THREE.Matrix3();

/** Written by `densityTexturesOf`, overwritten by each render. */
const densityTextures: THREE.Data3DTexture[] = [];

/** The built density textures of the FogMaterial volumes, in a list each render reuses. */
function densityTexturesOf(volumes: readonly FogVolumeObject[]): THREE.Data3DTexture[] {
  densityTextures.length = 0;
  for (const { fill } of volumes) {
    if (fill.kind === 'material' && fill.densityTexture) densityTextures.push(fill.densityTexture);
  }
  return densityTextures;
}

/** The view-space corner of the frustum at the clip-space depth `ndcZ`. */
function sectionAt(camera: THREE.Camera, ndcZ: number): THREE.Vector3 {
  return new THREE.Vector3(1, 1, ndcZ).applyMatrix4(camera.projectionMatrixInverse);
}

function sliceMaterial(name: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return fullScreenPass(`VolumetricFog.${name}`, fragmentShader, { slice: { value: 0 }, ...uniforms });
}

function volumeTarget(name: string): THREE.WebGL3DRenderTarget {
  const target = new THREE.WebGL3DRenderTarget(1, 1, 1, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.name = name;
  return target;
}

function resize(target: THREE.WebGL3DRenderTarget, { width, height, depth }: VolumetricFogGrid): void {
  target.setSize(width, height, depth);
}

/**
 * Every value a view's volume depends on but its lights. A key compares and copies in place, so a
 * render that changes nothing allocates nothing.
 */
class VolumeKey {
  /**
   * The camera's world and projection matrices, then the shown sky's rotation. The volume reads the
   * sky's energy too, and its layout, which comes with its `layers`, but not its share of the ambient.
   */
  private readonly view = new Float64Array(16 + 16 + skyRotation.length);
  private skyEnergy = 0;
  private width = 0;
  private height = 0;
  private inputs: Omit<VolumetricFogInputs, 'lights' | 'casters' | 'volumes'> | null = null;
  private sky: WebGLTexture | undefined;

  /**
   * Takes the render's values and the shown sky's `layers`, and answers whether any differs from
   * the last ones.
   */
  update(
    camera: THREE.Camera,
    viewport: THREE.Vector4,
    inputs: VolumetricFogInputs,
    layers: WebGLTexture | undefined
  ): boolean {
    let hasChanged =
      this.inputs === null ||
      this.width !== viewport.z ||
      this.height !== viewport.w ||
      this.sky !== layers ||
      this.skyEnergy !== shownSky[SHOWN_ENERGY] ||
      this.inputs.fog !== inputs.fog ||
      this.inputs.project !== inputs.project;
    if (this.take(0, camera.matrixWorld.elements)) hasChanged = true;
    if (this.take(16, camera.projectionMatrix.elements)) hasChanged = true;
    if (this.take(32, skyRotation)) hasChanged = true;
    this.width = viewport.z;
    this.height = viewport.w;
    this.sky = layers;
    this.skyEnergy = shownSky[SHOWN_ENERGY]!;
    this.inputs = inputs;
    return hasChanged;
  }

  /** Copies `values` into `view` from `offset`, and answers whether any differed. */
  private take(offset: number, values: ArrayLike<number>): boolean {
    let hasChanged = false;
    for (let i = 0; i < values.length; i++) {
      if (this.view[offset + i] !== values[i]) hasChanged = true;
      this.view[offset + i] = values[i]!;
    }
    return hasChanged;
  }
}

/** A view's volume, the history its temporal reprojection blends into, and what drew them. */
class ViewVolume {
  readonly integrated = volumeTarget('VolumetricFogViewVolume');
  readonly history = volumeTarget('VolumetricFogHistory');
  readonly key = new VolumeKey();
  readonly lights = new FogLightRows();
  readonly volumes = new FogVolumeRows();
  /** The view's own, so views of scenes with other density textures never restack each other's. */
  readonly densityAtlas = new FogDensityAtlas();
  readonly casters = new CasterPose();
  /** The camera's world matrix at the last draw, which the next reprojects from. */
  readonly previousCamera = new THREE.Matrix4();
  grid: VolumetricFogGrid = { width: 0, height: 0, depth: 0 };
  /** Whether `history` holds a draw of the current grid. */
  hasHistory = false;
  /** Each step's jitter is the next of Godot's 16 (`environment/fog.cpp:1113`). */
  frame = 0;
  /** The jitters a still view has yet to add to its mean: all 16 after a moving camera's step. */
  jittersToConverge = 0;

  /** Whether the view still converges, which a still render continues. */
  get isSettling(): boolean {
    return this.jittersToConverge > 0;
  }

  dispose(): void {
    this.integrated.dispose();
    this.history.dispose();
    this.densityAtlas.dispose();
  }
}

/** How a draw samples each froxel. */
type Sampling = 'centre' | 'converge' | 'step';

/**
 * A changed view samples centres, or steps its history. A still one after a step converges one
 * jitter a render, so no render costs more than a moving camera's.
 */
function samplingFor(hasChanged: boolean, temporal: number | null, isSettling: boolean): Sampling | null {
  if (hasChanged) return temporal === null ? 'centre' : 'step';
  return isSettling ? 'converge' : null;
}

/**
 * The jitter a draw samples and the weight of the history it blends into. A step reprojects into
 * the last draw's history (`.glsl:311-335`), and its cell that cannot reproject samples its centre,
 * so a step without history samples centres. A still view adds the next jitter to the mean in its
 * history: the mean of n jitters weighs n / (n + 1) against the next. All 16 is the mean Godot's
 * history converges to.
 */
function sampleOf(
  state: ViewVolume,
  temporal: number | null,
  sampling: Sampling
): { offset: THREE.Vector3; historyAmount: number } {
  if (sampling === 'converge') {
    const averaged = JITTER_OFFSETS.length - state.jittersToConverge;
    return { offset: JITTER_OFFSETS[averaged]!, historyAmount: averaged / (averaged + 1) };
  }
  const reprojects = sampling === 'step' && state.hasHistory && temporal !== null;
  if (!reprojects) return { offset: CENTRE_OFFSET, historyAmount: 0 };
  return { offset: JITTER_OFFSETS[state.frame % JITTER_OFFSETS.length]!, historyAmount: temporal };
}

export class VolumetricFogPass {
  /** The medium per froxel, and the filter's second step. */
  private readonly density = volumeTarget('VolumetricFogDensity');
  /** The filter's first step. */
  private readonly filtered = volumeTarget('VolumetricFogFiltered');
  /** The integrated fog of the view that rendered last, through the texture every fog program samples. */
  private readonly volume = volumeTarget('VolumetricFogVolume');
  private readonly viewport = new THREE.Vector4();
  private readonly lights = new RowTexture(FOG_LIGHT_TEXELS);
  private readonly volumes = new RowTexture(FOG_VOLUME_TEXELS);
  private readonly lightMaterial = sliceMaterial('Light', FOG_LIGHT_FRAGMENT, {
    gridSize: { value: new THREE.Vector3() },
    frustumBegin: { value: new THREE.Vector2() },
    frustumEnd: { value: new THREE.Vector2() },
    fogLength: { value: 0 },
    detailSpread: { value: 1 },
    baseDensity: { value: 0 },
    litDensityMin: { value: VOLUMETRIC_FOG_LIT_DENSITY_MIN },
    baseScattering: { value: new THREE.Color() },
    baseEmission: { value: new THREE.Color() },
    phaseG: { value: 0 },
    ambientColor: { value: new THREE.Color() },
    ambientInject: { value: 0 },
    skyContribution: { value: 0 },
    viewToSky: { value: new THREE.Matrix3() },
    ...skyRadianceUniforms(),
    fogLights: { value: null },
    lightCount: { value: 0 },
    fogVolumes: { value: null },
    fogVolumeCount: { value: 0 },
    fogDensityTextures: { value: null },
    fogDensityTexturesSize: { value: new THREE.Vector3(1, 1, 1) },
    directionalShadowAtlas: { value: null },
    positionalShadowAtlas: { value: null },
    [AREA_LIGHT_ATLAS_UNIFORM]: { value: areaLightAtlasTexture() },
    sampleOffset: { value: new THREE.Vector3() },
    history: { value: null },
    toPreviousView: { value: new THREE.Matrix4() },
    historyAmount: { value: 0 },
  });
  private readonly filterMaterial = sliceMaterial('Filter', FOG_FILTER_FRAGMENT, {
    source: { value: null },
    axis: { value: new THREE.Vector3() },
    weights: { value: [...VOLUMETRIC_FOG_FILTER_WEIGHTS] },
  });
  private readonly integrateMaterial = sliceMaterial('Integrate', FOG_INTEGRATE_FRAGMENT, {
    source: { value: null },
    sliceDepths: { value: new Float32Array(1) },
  });
  private readonly copyMaterial = sliceMaterial('Copy', FOG_COPY_FRAGMENT, { source: { value: null } });
  /** What `sliceDepths` holds the depths of. */
  private slices = { depth: 0, length: 0, detailSpread: 0 };
  /** Each scene's volume per camera, so each camera keeps its own history, as each Godot viewport does. */
  private readonly views = new WeakMap<THREE.Scene, WeakMap<THREE.Camera, ViewVolume>>();
  /** Every live view volume of each scene, which `forget` disposes. */
  private readonly liveViews = new WeakMap<THREE.Scene, Set<ViewVolume>>();
  /** Disposes a view's targets once its camera is collected, so a camera that is gone holds no GPU memory. */
  private readonly cameraGone = new FinalizationRegistry<{ live: Set<ViewVolume>; state: ViewVolume }>(
    ({ live, state }) => {
      live.delete(state);
      this.drop(state);
    }
  );
  /** The view volume the renderer's volume holds a copy of, null before the first copy. */
  private copied: ViewVolume | null = null;

  constructor() {
    this.volume.texture = fogUniforms.volume;
  }

  /**
   * Readies the volume and the composite's uniforms for a render of `scene` through `camera`, into
   * the renderer's current target and viewport. Answers whether the volume is still settling, when
   * the next frame redraws it. A grid with an empty side leaves the composite without a volume.
   */
  prepare(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    inputs: VolumetricFogInputs
  ): boolean {
    renderer.getCurrentViewport(this.viewport);
    if (this.viewport.z < 1 || this.viewport.w < 1) return false;
    const grid = volumetricFogGrid({ width: this.viewport.z, height: this.viewport.w }, inputs.project);
    if (grid.width < 1 || grid.height < 1) return false;
    const state = this.viewOf(scene, camera);
    const hasLightsChanged = state.lights.pack(inputs.lights, camera);
    if (hasLightsChanged) this.lights.invalidate(state.lights);
    const hasDensityChanged = state.densityAtlas.update(densityTexturesOf(inputs.volumes));
    const view = fogVolumeView(camera, inputs.fog, grid);
    const haveVolumesChanged = state.volumes.pack(inputs.volumes, camera, view, state.densityAtlas);
    if (haveVolumesChanged) this.volumes.invalidate(state.volumes);
    const haveShadowsMoved = state.lights.readsShadowAtlas && state.casters.update(inputs.casters);
    const hasViewChanged = state.key.update(camera, this.viewport, inputs, shownLayers(renderer));
    const hasChanged =
      hasViewChanged || hasLightsChanged || haveVolumesChanged || hasDensityChanged || haveShadowsMoved;
    const sampling = samplingFor(hasChanged, inputs.fog.temporalReprojection, state.isSettling);
    if (sampling || this.copied !== state) {
      drawOffscreen(renderer, () => {
        if (sampling) this.draw(renderer, camera, state, inputs, { sampling, grid });
        resize(this.volume, state.grid);
        this.copy(renderer, state.integrated, this.volume, state.grid);
      });
    }
    this.copied = state;
    this.writeLookup(inputs);
    return state.isSettling;
  }

  /** Drops `scene`'s volumes and histories. */
  forget(scene: THREE.Scene): void {
    for (const state of this.liveViews.get(scene) ?? []) {
      this.cameraGone.unregister(state);
      this.drop(state);
    }
    this.views.delete(scene);
    this.liveViews.delete(scene);
  }

  dispose(): void {
    this.density.dispose();
    this.filtered.dispose();
    this.volume.dispose();
    this.lights.dispose();
    this.volumes.dispose();
    this.lightMaterial.dispose();
    this.filterMaterial.dispose();
    this.integrateMaterial.dispose();
    this.copyMaterial.dispose();
  }

  private viewOf(scene: THREE.Scene, camera: THREE.Camera): ViewVolume {
    let views = this.views.get(scene);
    let live = this.liveViews.get(scene);
    if (!views || !live) {
      views = new WeakMap();
      live = new Set();
      this.views.set(scene, views);
      this.liveViews.set(scene, live);
    }
    const existing = views.get(camera);
    if (existing) return existing;
    const state = new ViewVolume();
    views.set(camera, state);
    live.add(state);
    this.cameraGone.register(camera, { live, state }, state);
    return state;
  }

  private drop(state: ViewVolume): void {
    state.dispose();
    if (this.copied === state) this.copied = null;
    this.lights.invalidate(state.lights);
    this.volumes.invalidate(state.volumes);
  }

  private writeLookup({ fog, project }: VolumetricFogInputs): void {
    const { inverseLength, inverseSpread } = volumetricFogLookup(fog);
    const { volumeLookup, viewport } = fogUniforms;
    volumeLookup[0] = inverseLength;
    volumeLookup[1] = inverseSpread;
    volumeLookup[2] = fog.skyAffect;
    volumeLookup[3] = project.useLegacyBlending ? 1 : 0;
    viewport[0] = this.viewport.x;
    viewport[1] = this.viewport.y;
    viewport[2] = 1 / this.viewport.z;
    viewport[3] = 1 / this.viewport.w;
  }

  private draw(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    state: ViewVolume,
    inputs: VolumetricFogInputs,
    { sampling, grid }: { sampling: Sampling; grid: VolumetricFogGrid }
  ): void {
    this.fitToGrid(state, grid);
    this.writeMedium(inputs);
    this.writeView(camera, inputs, grid);
    this.writeRows(state);
    this.writeIntegrate(inputs.fog, grid);
    const atlases = this.writeShadowAtlases(state.lights);

    this.writeSampling(state, camera, inputs.fog.temporalReprojection, sampling);
    drawWithUncomparedDepth(renderer, atlases, () =>
      this.fill(renderer, this.density, this.lightMaterial, grid)
    );
    if (inputs.fog.temporalReprojection !== null) {
      // Godot keeps the medium before the filter, so the history is never blurred twice (`fog.cpp:1163`).
      this.copy(renderer, this.density, state.history, grid);
      state.hasHistory = true;
    }
    if (inputs.project.useFilter) {
      this.filter(renderer, this.density, this.filtered, FILTER_X, grid);
      this.filter(renderer, this.filtered, this.density, FILTER_Y, grid);
    }
    this.integrateMaterial.uniforms['source']!.value = this.density.texture;
    this.fill(renderer, state.integrated, this.integrateMaterial, grid);
  }

  private fitToGrid(state: ViewVolume, grid: VolumetricFogGrid): void {
    resize(this.density, grid);
    resize(this.filtered, grid);
    const { width, height, depth } = state.grid;
    if (width === grid.width && height === grid.height && depth === grid.depth) return;
    resize(state.integrated, grid);
    resize(state.history, grid);
    state.grid = grid;
    state.hasHistory = false;
  }

  /**
   * The Environment's medium (`environment/fog.cpp:1047-1094`), which each froxel adds its volumes
   * to. Godot clamps only the sum, so a negative density takes from the volumes (`.glsl:362`).
   */
  private writeMedium({ fog }: VolumetricFogInputs): void {
    const uniforms = this.lightMaterial.uniforms;
    uniforms['fogLength']!.value = fog.length;
    uniforms['detailSpread']!.value = fog.detailSpread;
    uniforms['baseDensity']!.value = fog.density;
    setGodotColorLinear(uniforms['baseScattering']!.value as THREE.Color, fog.albedo).multiplyScalar(
      fog.density
    );
    setGodotColorLinear(uniforms['baseEmission']!.value as THREE.Color, fog.emission).multiplyScalar(
      fog.emissionEnergy * fog.density
    );
    uniforms['phaseG']!.value = fog.anisotropy;
    setGodotColorLinear(uniforms['ambientColor']!.value as THREE.Color, fog.ambient.color);
    uniforms['ambientInject']!.value = fog.ambient.inject;
    uniforms['skyContribution']!.value = fog.ambient.skyContribution;
  }

  /** The frustum the grid spans and the camera's turn into the sky. */
  private writeView(camera: THREE.Camera, { fog }: VolumetricFogInputs, grid: VolumetricFogGrid): void {
    const uniforms = this.lightMaterial.uniforms;
    const { begin, end } = volumetricFogFrustum(fogProjection(camera), fog.length);
    (uniforms['gridSize']!.value as THREE.Vector3).set(grid.width, grid.height, grid.depth);
    (uniforms['frustumBegin']!.value as THREE.Vector2).set(begin.x, begin.y);
    (uniforms['frustumEnd']!.value as THREE.Vector2).set(end.x, end.y);
    (uniforms['viewToSky']!.value as THREE.Matrix3)
      .setFromMatrix4(camera.matrixWorld)
      .premultiply(worldToSky.fromArray(skyRotation));
  }

  private writeRows({ lights, volumes, densityAtlas }: ViewVolume): void {
    const uniforms = this.lightMaterial.uniforms;
    uniforms['fogLights']!.value = this.lights.hold(lights);
    uniforms['lightCount']!.value = lights.count;
    uniforms['fogVolumes']!.value = this.volumes.hold(volumes);
    uniforms['fogVolumeCount']!.value = volumes.count;
    const { texture } = densityAtlas;
    uniforms['fogDensityTextures']!.value = texture;
    const { width, height, depth } = texture.image;
    (uniforms['fogDensityTexturesSize']!.value as THREE.Vector3).set(width, height, depth);
  }

  /** Binds the atlases the rows' shadows read, and answers them. An atlas no row reads is null. */
  private writeShadowAtlases(rows: FogLightRows): (THREE.DepthTexture | null)[] {
    const directional = rows.readsDirectionalAtlas ? directionalShadowAtlasDepth() : null;
    const positional = rows.readsPositionalAtlas ? positionalShadowAtlasDepth() : null;
    this.lightMaterial.uniforms['directionalShadowAtlas']!.value = directional;
    this.lightMaterial.uniforms['positionalShadowAtlas']!.value = positional;
    return [directional, positional];
  }

  /** Writes how the light pass samples each froxel, and moves the view's sampling on. */
  private writeSampling(
    state: ViewVolume,
    camera: THREE.Camera,
    temporal: number | null,
    sampling: Sampling
  ): void {
    const uniforms = this.lightMaterial.uniforms;
    const { offset, historyAmount } = sampleOf(state, temporal, sampling);
    (uniforms['sampleOffset']!.value as THREE.Vector3).copy(offset);
    uniforms['historyAmount']!.value = historyAmount;
    uniforms['history']!.value = historyAmount > 0 ? state.history.texture : null;
    (uniforms['toPreviousView']!.value as THREE.Matrix4)
      .copy(state.previousCamera)
      .invert()
      .multiply(camera.matrixWorld);
    state.previousCamera.copy(camera.matrixWorld);
    if (sampling === 'step') state.frame++;
    state.jittersToConverge =
      sampling === 'converge' ? state.jittersToConverge - 1 : sampling === 'step' ? JITTER_OFFSETS.length : 0;
  }

  /** The integration's slice depths, one uniform per slice, so a new slice count recompiles. */
  private writeIntegrate(fog: VolumetricFog, grid: VolumetricFogGrid): void {
    const slices = { depth: grid.depth, length: fog.length, detailSpread: fog.detailSpread };
    const { depth, length, detailSpread } = this.slices;
    if (depth === slices.depth && length === slices.length && detailSpread === slices.detailSpread) return;
    this.slices = slices;
    if (this.integrateMaterial.defines['FOG_DEPTH'] !== grid.depth) {
      this.integrateMaterial.defines = { FOG_DEPTH: grid.depth };
      this.integrateMaterial.needsUpdate = true;
    }
    this.integrateMaterial.uniforms['sliceDepths']!.value = volumetricFogSliceDepths(slices);
  }

  private filter(
    renderer: THREE.WebGLRenderer,
    source: THREE.WebGL3DRenderTarget,
    target: THREE.WebGL3DRenderTarget,
    axis: THREE.Vector3,
    grid: VolumetricFogGrid
  ): void {
    this.filterMaterial.uniforms['source']!.value = source.texture;
    (this.filterMaterial.uniforms['axis']!.value as THREE.Vector3).copy(axis);
    this.fill(renderer, target, this.filterMaterial, grid);
  }

  private copy(
    renderer: THREE.WebGLRenderer,
    source: THREE.WebGL3DRenderTarget,
    target: THREE.WebGL3DRenderTarget,
    grid: VolumetricFogGrid
  ): void {
    this.copyMaterial.uniforms['source']!.value = source.texture;
    this.fill(renderer, target, this.copyMaterial, grid);
  }

  /** Draws `material` once into each slice of `target`. */
  private fill(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGL3DRenderTarget,
    material: THREE.ShaderMaterial,
    grid: VolumetricFogGrid
  ): void {
    for (let slice = 0; slice < grid.depth; slice++) {
      material.uniforms['slice']!.value = slice;
      drawFullScreen(renderer, material, target, slice);
    }
  }
}
