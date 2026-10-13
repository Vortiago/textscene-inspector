/**
 * One renderer's volumetric fog volume: Godot's froxel passes, drawn slice by slice into a 3D
 * target whose texture every fog program samples. A render redraws the volume only when its
 * camera, frame, lights or fog changed since the last one.
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
  volumetricFogSkyRoughness,
  volumetricFogSliceDepths,
  type FogProjection,
  type VolumetricFogGrid,
  type VolumetricFogProjectSettings,
} from '../../godot/volumetricFog.js';
import type { EnvironmentSettings } from '../../resources/environment/types.js';
import { godotColorToLinear } from '../godotColor.js';
import { FULL_SCREEN_VERTEX } from '../lighting2d/fullScreenQuad.js';
import { volumetricFogUniforms } from './fogComposite.js';
import { FOG_LIGHT_TEXELS, packFogLights } from './fogLights.js';
import {
  FOG_FILTER_FRAGMENT,
  FOG_INTEGRATE_FRAGMENT,
  FOG_LIGHT_FRAGMENT,
  FOG_SAMPLE_OFFSETS_MAX,
} from './fogVolumeShaders.js';

export type VolumetricFog = NonNullable<EnvironmentSettings['volumetricFog']>;

export interface FogVolumeInputs {
  fog: VolumetricFog;
  project: VolumetricFogProjectSettings;
}

/**
 * Where each froxel samples, as fractions of the cell: Godot's 16 jitters while temporal
 * reprojection converges a still frame, else the centre. The volume's rows run bottom-up, so a
 * jitter's top-down y flips.
 */
export function froxelSampleOffsets(temporalReprojection: boolean): THREE.Vector3[] {
  if (!temporalReprojection) return [new THREE.Vector3(...VOLUMETRIC_FOG_CELL_CENTRE)];
  return VOLUMETRIC_FOG_TEMPORAL_JITTERS.map(([x, y, z]) => new THREE.Vector3(x, 1 - y, z));
}

/** The camera's frustum as the fog reads it: its near and far sections in view space. */
export function fogProjection(camera: THREE.Camera): FogProjection {
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

/** The view-space corner of the frustum at the clip-space depth `ndcZ`. */
function sectionAt(camera: THREE.Camera, ndcZ: number): THREE.Vector3 {
  return new THREE.Vector3(1, 1, ndcZ).applyMatrix4(camera.projectionMatrixInverse);
}

/** Every value a volume depends on, compared by value or by reference. */
interface VolumeKey {
  view: Float64Array;
  width: number;
  height: number;
  lights: Float32Array;
  fog: VolumetricFog;
  project: VolumetricFogProjectSettings;
  sky: THREE.Texture | null;
}

function sameKey(a: VolumeKey, b: VolumeKey): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.fog === b.fog &&
    a.project === b.project &&
    a.sky === b.sky &&
    sameNumbers(a.view, b.view) &&
    sameNumbers(a.lights, b.lights)
  );
}

function sameNumbers(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** The sky's prefiltered radiance, which the ambient inject reads, or null for none. */
function skyRadiance(scene: THREE.Scene): THREE.Texture | null {
  const environment = scene.environment;
  return environment?.mapping === THREE.CubeUVReflectionMapping ? environment : null;
}

/** three's defines for sampling a PMREM texture of `imageHeight` (r186 `WebGLProgram.js:398-412`). */
function cubeUvDefines(imageHeight: number): Record<string, string | number> {
  const maxMip = Math.log2(imageHeight) - 2;
  return {
    ENVMAP_TYPE_CUBE_UV: '',
    CUBEUV_TEXEL_WIDTH: 1 / (3 * Math.max(2 ** maxMip, 7 * 16)),
    CUBEUV_TEXEL_HEIGHT: 1 / imageHeight,
    CUBEUV_MAX_MIP: `${maxMip}.0`,
  };
}

function sliceMaterial(name: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    name: `VolumetricFog.${name}`,
    uniforms: { slice: { value: 0 }, ...uniforms },
    vertexShader: FULL_SCREEN_VERTEX,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
}

/** The packed lights, one row of texels per light, for `rows` lights. */
function lightTexture(rows: number): THREE.DataTexture {
  const texels = new Float32Array(FOG_LIGHT_TEXELS * 4 * rows);
  return new THREE.DataTexture(texels, FOG_LIGHT_TEXELS, rows, THREE.RGBAFormat, THREE.FloatType);
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

export class FogVolumePass {
  /** The medium per froxel, and the filter's second step. */
  private readonly density = volumeTarget('VolumetricFogDensity');
  /** The integrated fog, through the texture every fog program samples, and the filter's first step. */
  private readonly volume = volumeTarget('VolumetricFogVolume');
  private readonly quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  private readonly quadCamera = new THREE.Camera();
  private lights = lightTexture(1);
  private readonly lightMaterial = sliceMaterial('Light', FOG_LIGHT_FRAGMENT, {
    gridSize: { value: new THREE.Vector3() },
    frustumBegin: { value: new THREE.Vector2() },
    frustumEnd: { value: new THREE.Vector2() },
    fogLength: { value: 0 },
    detailSpread: { value: 1 },
    density: { value: 0 },
    litDensityMin: { value: VOLUMETRIC_FOG_LIT_DENSITY_MIN },
    scattering: { value: new THREE.Color() },
    emission: { value: new THREE.Color() },
    phaseG: { value: 0 },
    ambientColor: { value: new THREE.Color() },
    ambientInject: { value: 0 },
    skyContribution: { value: 0 },
    skyRoughness: { value: 0 },
    viewToWorld: { value: new THREE.Matrix3() },
    envMap: { value: null },
    fogLights: { value: null },
    lightCount: { value: 0 },
    sampleOffsets: { value: Array.from({ length: FOG_SAMPLE_OFFSETS_MAX }, () => new THREE.Vector3()) },
    sampleCount: { value: 1 },
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
  /** What the volume was last drawn from, null before the first draw. */
  private drawnKey: VolumeKey | null = null;

  constructor() {
    this.volume.texture = volumetricFogUniforms.volume;
    this.quad.frustumCulled = false;
  }

  /**
   * Readies the volume and the composite uniforms for a render of `scene` through `camera`, into
   * the renderer's current target and viewport. Call `finish` after that render.
   */
  prepare(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    inputs: FogVolumeInputs
  ): void {
    const viewport = renderer.getCurrentViewport(new THREE.Vector4());
    const key: VolumeKey = {
      view: Float64Array.from([...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]),
      width: viewport.z,
      height: viewport.w,
      lights: packFogLights(scene, camera),
      fog: inputs.fog,
      project: inputs.project,
      sky: skyRadiance(scene),
    };
    if (this.drawnKey === null || !sameKey(this.drawnKey, key)) {
      this.draw(renderer, camera, key);
      this.drawnKey = key;
    }
    const { inverseLength, inverseSpread } = volumetricFogLookup(inputs.fog);
    volumetricFogUniforms.lookup.set([
      inverseLength,
      inverseSpread,
      inputs.fog.skyAffect,
      inputs.project.useLegacyBlending ? 1 : 0,
    ]);
    volumetricFogUniforms.viewport.set([viewport.x, viewport.y, 1 / viewport.z, 1 / viewport.w]);
  }

  /** Leaves later renders, of this scene or another, without a volume. */
  finish(): void {
    volumetricFogUniforms.lookup[0] = 0;
  }

  dispose(): void {
    this.density.dispose();
    this.volume.dispose();
    this.quad.geometry.dispose();
    this.lights.dispose();
    this.lightMaterial.dispose();
    this.filterMaterial.dispose();
    this.integrateMaterial.dispose();
  }

  private draw(renderer: THREE.WebGLRenderer, camera: THREE.Camera, key: VolumeKey): void {
    const grid = volumetricFogGrid(key, key.project);
    this.resize(grid);
    this.writeLight(camera, key, grid);
    this.writeIntegrate(key.fog, grid);

    const previousTarget = renderer.getRenderTarget();
    const previousLayer = renderer.getActiveCubeFace();
    const previousMipmapLevel = renderer.getActiveMipmapLevel();
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      this.fill(renderer, this.density, this.lightMaterial, grid);
      if (key.project.useFilter) {
        this.filter(renderer, this.density, this.volume, new THREE.Vector3(1, 0, 0), grid);
        this.filter(renderer, this.volume, this.density, new THREE.Vector3(0, 1, 0), grid);
      }
      this.integrateMaterial.uniforms['source']!.value = this.density.texture;
      this.fill(renderer, this.volume, this.integrateMaterial, grid);
    } finally {
      renderer.autoClear = previousAutoClear;
      renderer.setRenderTarget(previousTarget, previousLayer, previousMipmapLevel);
    }
  }

  private resize({ width, height, depth }: VolumetricFogGrid): void {
    this.density.setSize(width, height, depth);
    this.volume.setSize(width, height, depth);
  }

  /** The light pass's inputs (`environment/fog.cpp:1047-1094`). */
  private writeLight(camera: THREE.Camera, key: VolumeKey, grid: VolumetricFogGrid): void {
    const { fog } = key;
    const uniforms = this.lightMaterial.uniforms;
    const { begin, end } = volumetricFogFrustum(fogProjection(camera), fog.length);
    (uniforms['gridSize']!.value as THREE.Vector3).set(grid.width, grid.height, grid.depth);
    (uniforms['frustumBegin']!.value as THREE.Vector2).set(begin.x, begin.y);
    (uniforms['frustumEnd']!.value as THREE.Vector2).set(end.x, end.y);
    uniforms['fogLength']!.value = fog.length;
    uniforms['detailSpread']!.value = fog.detailSpread;
    uniforms['density']!.value = Math.max(0, fog.density);
    (uniforms['scattering']!.value as THREE.Color)
      .copy(godotColorToLinear(fog.albedo))
      .multiplyScalar(fog.density);
    (uniforms['emission']!.value as THREE.Color)
      .copy(godotColorToLinear(fog.emission))
      .multiplyScalar(fog.emissionEnergy * fog.density);
    uniforms['phaseG']!.value = fog.anisotropy;
    (uniforms['ambientColor']!.value as THREE.Color).copy(godotColorToLinear(fog.ambient.color));
    uniforms['ambientInject']!.value = fog.ambient.inject;
    uniforms['skyContribution']!.value = fog.ambient.skyContribution;
    uniforms['skyRoughness']!.value = volumetricFogSkyRoughness(Math.max(0, fog.density));
    (uniforms['viewToWorld']!.value as THREE.Matrix3).setFromMatrix4(camera.matrixWorld);
    const offsets = froxelSampleOffsets(fog.temporalReprojection);
    (uniforms['sampleOffsets']!.value as THREE.Vector3[]).forEach((offset, i) =>
      offset.copy(offsets[i] ?? offset)
    );
    uniforms['sampleCount']!.value = offsets.length;
    this.writeSky(key.sky);
    this.writeLights(key.lights);
  }

  private writeSky(sky: THREE.Texture | null): void {
    const defines = sky ? cubeUvDefines((sky.image as { height: number }).height) : {};
    if (!sameDefines(this.lightMaterial.defines, defines)) {
      this.lightMaterial.defines = defines;
      this.lightMaterial.needsUpdate = true;
    }
    this.lightMaterial.uniforms['envMap']!.value = sky;
  }

  /** One row of texels per light. A new light count needs a texture of another height. */
  private writeLights(rows: Float32Array): void {
    const count = rows.length / (FOG_LIGHT_TEXELS * 4);
    const height = Math.max(1, count);
    if (this.lights.image.height !== height) {
      this.lights.dispose();
      this.lights = lightTexture(height);
    }
    (this.lights.image.data as Float32Array).set(rows);
    this.lights.needsUpdate = true;
    this.lightMaterial.uniforms['fogLights']!.value = this.lights;
    this.lightMaterial.uniforms['lightCount']!.value = count;
  }

  /** The integration's slice depths, one uniform per slice, so a new slice count recompiles. */
  private writeIntegrate(fog: VolumetricFog, grid: VolumetricFogGrid): void {
    const depths = volumetricFogSliceDepths({
      depth: grid.depth,
      length: fog.length,
      detailSpread: fog.detailSpread,
    });
    if (this.integrateMaterial.defines['FOG_DEPTH'] !== grid.depth) {
      this.integrateMaterial.defines = { FOG_DEPTH: grid.depth };
      this.integrateMaterial.needsUpdate = true;
    }
    this.integrateMaterial.uniforms['sliceDepths']!.value = depths;
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

  /** Draws `material` once into each slice of `target`. */
  private fill(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGL3DRenderTarget,
    material: THREE.ShaderMaterial,
    grid: VolumetricFogGrid
  ): void {
    this.quad.material = material;
    for (let slice = 0; slice < grid.depth; slice++) {
      material.uniforms['slice']!.value = slice;
      renderer.setRenderTarget(target, slice);
      renderer.render(this.quad, this.quadCamera);
    }
  }
}

function sameDefines(a: Record<string, unknown> | undefined, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a ?? {});
  return aKeys.length === Object.keys(b).length && aKeys.every((name) => a![name] === b[name]);
}

/** Written only by `acquireFogVolumePass` and the release it returns. */
const passes = new WeakMap<THREE.WebGLRenderer, { pass: FogVolumePass; users: number }>();

/**
 * The renderer's one fog pass. Every fog program reads one volume texture, so two scenes that one
 * renderer draws share the pass, each preparing it before its own render. The last release
 * disposes it.
 */
export function acquireFogVolumePass(renderer: THREE.WebGLRenderer): {
  pass: FogVolumePass;
  release: () => void;
} {
  const entry = passes.get(renderer) ?? { pass: new FogVolumePass(), users: 0 };
  passes.set(renderer, entry);
  entry.users++;
  let isReleased = false;
  return {
    pass: entry.pass,
    release: () => {
      if (isReleased) return;
      isReleased = true;
      entry.users--;
      if (entry.users > 0) return;
      entry.pass.dispose();
      passes.delete(renderer);
    },
  };
}
