/**
 * The reflection probes of one scene: it captures each into its layer of the scene's reflection
 * atlas once the scene settles, and shows the captured probes to each render of the scene but a
 * capture's, which Godot draws without probes (`render_forward_clustered.cpp:1631-1634`).
 */

import * as THREE from 'three';
import {
  captureFarPlanes,
  REFLECTION_ATLAS_COUNT,
  REFLECTION_ATLAS_SIZE,
  reflectionAtlasLayout,
  reflectionProbeOrder,
  ReflectionProbeUpdateMode,
} from '../../godot/reflectionProbe.js';
import type { SkyOctmapLayout } from '../../godot/skyReflection.js';
import {
  bakeAtlasLayers,
  createReflectionAtlas,
  type ReflectionAtlas,
} from '../../resources/sky/skyLayers.js';
import { compareTreeOrder } from '../contexts/TreeOrderContext.js';
import { SCAN_FRAMES_AFTER_SETTLE } from '../environment/useLatchedSceneScan.js';
import { drawOffscreen } from '../offscreen.js';
import { observeSceneCamera, observeSceneCull, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { TrackedObjects } from '../trackedObjects.js';
import { visibleInTree } from '../visibleInTree.js';
import { captureCameras, probeCaptureOf } from './captureCameras.js';
import { stageCapture } from './captureStage.js';
import { PROBE_ROW_TEXELS, probeRows, type DrawnProbe } from './probeRows.js';
import { atlasSlot, rowsSlot, shownProbes } from './probeSlots.js';
import { isReflectionProbe, type ReflectionProbeObject } from './reflectionProbeObject.js';

/** The part of three's per-renderer state of a texture that holds its GL handle. */
interface TextureHandle {
  __webglTexture?: WebGLTexture;
}

/** What a probe's capture shows: changed, it captures again. */
interface Capture {
  layer: number;
  probe: ReflectionProbeObject['probe'];
  matrixWorld: THREE.Matrix4;
}

/** Scratch for one probe's frame, overwritten by each. */
const position = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const scale = new THREE.Vector3();

export class SceneProbes {
  private readonly probes: TrackedObjects<ReflectionProbeObject>;
  /** The capture a face draws into, a cube Godot's capture size wide, in half floats as Godot's. */
  private readonly cube = new THREE.WebGLCubeRenderTarget(REFLECTION_ATLAS_SIZE, {
    type: THREE.HalfFloatType,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
  });
  /** Made by `update` for the probes it holds, null before the first. */
  private atlas: ReflectionAtlas | null = null;
  /** The capture each probe holds in the atlas, written by `capture` and cleared with the atlas. */
  private readonly captures = new Map<ReflectionProbeObject, Capture>();
  /** The rows of the drawn probes, made again when their count changes. */
  private rows = new THREE.DataTexture(probeRows([]), PROBE_ROW_TEXELS, 1, THREE.RGBAFormat, THREE.FloatType);
  private drawnCount = 0;
  /** Frames since the scene last had a resource on its way. */
  private settledFrames = 0;
  /** Whether content arrived since the probes last captured, so each captures again once it settles. */
  private hasNewContent = true;
  /** What the captures saw of the environment, which a sky that bakes later changes. */
  private environment: readonly unknown[] = [];
  private readonly stopObserving: (() => void)[];
  /** The lights whose shadows a capture without shadows hid, put back once the render ends. */
  private readonly hiddenShadows: { shadow: THREE.LightShadow; intensity: number }[] = [];

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene
  ) {
    this.probes = new TrackedObjects(scene, isReflectionProbe);
    this.stopObserving = [
      observeSceneCamera(scene, (camera) => this.show(camera)),
      // After the observers that write each light's shadow for the render.
      observeSceneCull(scene, (camera) => this.hideShadows(camera)),
      observeSceneRenderEnd(scene, () => this.endRender()),
    ];
  }

  /**
   * Captures one probe that needs it, once the scene has had no resource on its way for a few
   * frames, and packs the captured probes. Answers whether it drew, so the caller draws a frame.
   */
  update(pendingResources: number, clearColor: THREE.Color): boolean {
    this.settledFrames = pendingResources > 0 ? 0 : this.settledFrames + 1;
    if (pendingResources > 0) this.hasNewContent = true;
    const probes = this.probes
      .current()
      .filter(visibleInTree)
      .sort((a, b) => compareTreeOrder(a.treeOrder, b.treeOrder))
      .slice(0, REFLECTION_ATLAS_COUNT);
    const atlas = this.atlasFor(probes);
    if (this.settledFrames < SCAN_FRAMES_AFTER_SETTLE) return false;
    this.forgetStaleCaptures(clearColor);
    const stale = probes.findIndex((probe, layer) => !this.isCaptured(probe, layer));
    if (stale !== -1) this.capture(probes[stale]!, stale, atlas, clearColor);
    this.pack(probes.filter((probe) => this.captures.has(probe)));
    return stale !== -1;
  }

  dispose(): void {
    for (const stop of this.stopObserving) stop();
    this.probes.dispose();
    this.leaveSlots();
    this.atlas?.target.dispose();
    this.cube.dispose();
    this.rows.dispose();
  }

  /** The atlas for `probes`, made again with their count and layout, which drops every capture. */
  private atlasFor(probes: readonly ReflectionProbeObject[]): ReflectionAtlas {
    const hasRealTimeProbe = probes.some(
      ({ probe }) => probe.updateMode === ReflectionProbeUpdateMode.ALWAYS
    );
    const layout = reflectionAtlasLayout(hasRealTimeProbe);
    if (
      this.atlas &&
      this.atlas.target.depth === Math.max(probes.length, 1) &&
      sameLayout(this.atlas.layout, layout)
    )
      return this.atlas;
    this.leaveSlots();
    this.atlas?.target.dispose();
    this.captures.clear();
    this.atlas = createReflectionAtlas(layout, probes.length);
    return this.atlas;
  }

  /** Drops every capture once new content settles, or once the environment the captures saw changes. */
  private forgetStaleCaptures(clearColor: THREE.Color): void {
    const environment = [this.scene.environment, this.scene.background, clearColor.getHex()];
    const hasNewEnvironment = environment.some((value, index) => value !== this.environment[index]);
    if (!this.hasNewContent && !hasNewEnvironment) return;
    this.environment = environment;
    this.hasNewContent = false;
    this.captures.clear();
  }

  private isCaptured(object: ReflectionProbeObject, layer: number): boolean {
    const capture = this.captures.get(object);
    return (
      !!capture &&
      capture.layer === layer &&
      capture.probe === object.probe &&
      capture.matrixWorld.equals(object.matrixWorld)
    );
  }

  /** Draws `object`'s six faces into the cube, then bakes them into its layer of the atlas. */
  private capture(
    object: ReflectionProbeObject,
    layer: number,
    atlas: ReflectionAtlas,
    clearColor: THREE.Color
  ): void {
    const { probe } = object;
    const capture = { isInterior: probe.interior, hasShadows: probe.enableShadows };
    const farPlanes = captureFarPlanes(probe.size, probe.originOffset, probe.maxDistance);
    const cameras = captureCameras(object.matrixWorld, probe.originOffset, farPlanes, capture);
    const restore = stageCapture(this.scene, {
      cullMask: probe.cullMask,
      isInterior: probe.interior,
      clearColor,
    });
    try {
      drawOffscreen(this.renderer, () => {
        this.renderer.autoClear = true;
        cameras.forEach((camera, face) => {
          this.renderer.setRenderTarget(this.cube, face);
          this.renderer.render(this.scene, camera);
        });
      });
    } finally {
      restore();
    }
    const radianceFilter =
      probe.updateMode === ReflectionProbeUpdateMode.ALWAYS ? 'fast' : 'importance-sample';
    bakeAtlasLayers(this.renderer, this.cube.texture, atlas, layer, radianceFilter);
    this.captures.set(object, { layer, probe, matrixWorld: object.matrixWorld.clone() });
  }

  /** Writes the rows of `probes` in Godot's order, and uploads them when they change. */
  private pack(probes: readonly ReflectionProbeObject[]): void {
    const drawn = reflectionProbeOrder(probes.map((object) => this.drawnProbe(object)));
    const rows = probeRows(drawn);
    this.drawnCount = drawn.length;
    const current = this.rows.image.data as Float32Array;
    if (current.length === rows.length && current.every((value, index) => value === rows[index])) return;
    if (current.length !== rows.length) {
      this.leaveSlots();
      this.rows.dispose();
      this.rows = new THREE.DataTexture(
        rows,
        PROBE_ROW_TEXELS,
        rows.length / (PROBE_ROW_TEXELS * 4),
        THREE.RGBAFormat,
        THREE.FloatType
      );
    } else {
      current.set(rows);
    }
    this.rows.needsUpdate = true;
    this.renderer.initTexture(this.rows);
  }

  private drawnProbe(object: ReflectionProbeObject): DrawnProbe {
    const { probe } = object;
    object.matrixWorld.decompose(position, rotation, scale);
    const worldToLocal = new THREE.Matrix4().compose(position, rotation, scale.set(1, 1, 1)).invert();
    return { ...probe, worldToLocal, atlasLayer: this.captures.get(object)!.layer };
  }

  /** Points every lit material at this scene's probes for a render, or at none for a capture's. */
  private show(camera: THREE.Camera): void {
    const { atlas } = this;
    if (!atlas || this.drawnCount === 0 || probeCaptureOf(camera)) {
      shownProbes[0] = 0;
      return;
    }
    shownProbes[0] = this.drawnCount;
    shownProbes[1] = atlas.layout.borderSize;
    shownProbes[2] = atlas.layout.layerSizes.length - 1;
    this.handleOf(atlasSlot).__webglTexture = this.handleOf(atlas.target.texture).__webglTexture;
    this.handleOf(rowsSlot).__webglTexture = this.handleOf(this.rows).__webglTexture;
  }

  /** Hides each light's shadow from a capture without shadows. */
  private hideShadows(camera: THREE.Camera): void {
    if (probeCaptureOf(camera)?.hasShadows !== false) return;
    this.scene.traverse((object) => {
      const { shadow } = object as THREE.Object3D & { shadow?: THREE.LightShadow };
      if (!shadow) return;
      this.hiddenShadows.push({ shadow, intensity: shadow.intensity });
      shadow.intensity = 0;
    });
  }

  /** Leaves later renders, of this scene or another, without probes or hidden shadows. */
  private endRender(): void {
    shownProbes[0] = 0;
    for (const { shadow, intensity } of this.hiddenShadows) shadow.intensity = intensity;
    this.hiddenShadows.length = 0;
  }

  /** Leaves no slot on this scene's textures before they are freed: binding a deleted texture is an error. */
  private leaveSlots(): void {
    const owned = [this.atlas?.target.texture, this.rows].map((texture) =>
      texture ? this.handleOf(texture).__webglTexture : undefined
    );
    for (const slot of [atlasSlot, rowsSlot]) {
      const handle = this.handleOf(slot);
      if (handle.__webglTexture !== undefined && owned.includes(handle.__webglTexture))
        delete handle.__webglTexture;
    }
  }

  private handleOf(texture: THREE.Texture): TextureHandle {
    return this.renderer.properties.get(texture) as TextureHandle;
  }
}

function sameLayout(a: SkyOctmapLayout, b: SkyOctmapLayout): boolean {
  return a.size === b.size && a.layerSizes.length === b.layerSizes.length;
}
