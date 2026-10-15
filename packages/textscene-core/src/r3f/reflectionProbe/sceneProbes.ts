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
} from '../../godot/rendering/environment/reflectionProbe.js';
import {
  bakeAtlasLayers,
  createReflectionAtlas,
  type ReflectionAtlas,
} from '../../resources/sky/skyLayers.js';
import { compareTreeOrder } from '../contexts/TreeOrderContext.js';
import { SCAN_FRAMES_AFTER_SETTLE } from '../environment/useLatchedSceneScan.js';
import { drawOffscreen } from '../offscreen.js';
import { observeSceneCamera, observeSceneCull, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { leaveSlot, showInSlot } from '../sharedTexture.js';
import { TrackedObjects } from '../trackedObjects.js';
import { visibleInTree } from '../visibleInTree.js';
import { captureCameras, probeCaptureOf, probeFrame } from './captureCameras.js';
import { stageCapture } from './captureStage.js';
import { PROBE_ROW_TEXELS, probeRows, type DrawnProbe } from './probeRows.js';
import { atlasSlot, rowsSlot, shownProbes } from './probeSlots.js';
import { isReflectionProbe, type ReflectionProbeObject } from './reflectionProbeObject.js';

/** What a probe's capture shows: changed, it captures again. */
interface Capture {
  layer: number;
  /** The `generation` it was captured in. An earlier one draws until the probe captures again. */
  generation: number;
  probe: ReflectionProbeObject['probe'];
  matrixWorld: THREE.Matrix4;
}

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
  /** What the atlas was made for: changed, it is made again. */
  private atlasProbeCount = 0;
  private atlasHasRealTimeProbe = false;
  /** The capture each probe holds in the atlas, written by `capture` and cleared with the atlas. */
  private readonly captures = new Map<ReflectionProbeObject, Capture>();
  /** Advanced only by `markCapturesStale`, so each probe captures again. */
  private generation = 0;
  /** The rows of the drawn probes, made again when their count changes. */
  private rows = rowsTexture(probeRows([]));
  /** The probes the rows hold, written only by `pack`. */
  private packed: readonly ReflectionProbeObject[] = [];
  /** Frames since the scene last had a resource on its way. */
  private settledFrames = 0;
  /** Whether content arrived since the probes last captured, so each captures again once it settles. */
  private hasNewContent = true;
  /** What the captures saw of the environment, which a sky that bakes later changes. */
  private seen: { environment: unknown; background: unknown; clearColor: number } = {
    environment: undefined,
    background: undefined,
    clearColor: -1,
  };
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
    this.markCapturesStale(clearColor);
    const stale = probes.findIndex((probe, layer) => !this.isCaptured(probe, layer));
    if (stale !== -1) this.capture(probes[stale]!, stale, atlas, clearColor);
    const captured = probes.filter((probe) => this.captures.has(probe));
    if (stale !== -1 || !sameProbes(captured, this.packed)) this.pack(captured);
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
    if (
      this.atlas &&
      this.atlasProbeCount === probes.length &&
      this.atlasHasRealTimeProbe === hasRealTimeProbe
    )
      return this.atlas;
    this.leaveSlots();
    this.atlas?.target.dispose();
    this.captures.clear();
    this.packed = [];
    this.atlas = createReflectionAtlas(reflectionAtlasLayout(hasRealTimeProbe), probes.length);
    this.atlasProbeCount = probes.length;
    this.atlasHasRealTimeProbe = hasRealTimeProbe;
    return this.atlas;
  }

  /**
   * Marks every capture stale once new content settles, or once the environment the captures saw
   * changes. A stale capture still draws, so no probe vanishes until it captures again.
   */
  private markCapturesStale(clearColor: THREE.Color): void {
    const { environment, background } = this.scene;
    const { seen } = this;
    const hasNewEnvironment =
      environment !== seen.environment ||
      background !== seen.background ||
      clearColor.getHex() !== seen.clearColor;
    if (!this.hasNewContent && !hasNewEnvironment) return;
    this.seen = { environment, background, clearColor: clearColor.getHex() };
    this.hasNewContent = false;
    this.generation += 1;
  }

  /**
   * Whether `object`'s capture still shows what it would capture now. A probe that updates ALWAYS
   * captures again only then too, where Godot captures it every frame, so a node that moves under
   * it is not reflected until the scene's content changes.
   */
  private isCaptured(object: ReflectionProbeObject, layer: number): boolean {
    const capture = this.captures.get(object);
    return (
      !!capture &&
      capture.layer === layer &&
      capture.generation === this.generation &&
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
    const restore = stageCapture(this.scene, probe, clearColor);
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
    const { generation } = this;
    this.captures.set(object, { layer, generation, probe, matrixWorld: object.matrixWorld.clone() });
  }

  /** Writes the rows of `probes` in Godot's order, and uploads them. */
  private pack(probes: readonly ReflectionProbeObject[]): void {
    const rows = probeRows(reflectionProbeOrder(probes.map((object) => this.drawnProbe(object))));
    this.packed = probes;
    const current = this.rows.image.data as Float32Array;
    if (current.length === rows.length) {
      current.set(rows);
      this.rows.needsUpdate = true;
    } else {
      this.leaveSlots();
      this.rows.dispose();
      this.rows = rowsTexture(rows);
    }
    this.renderer.initTexture(this.rows);
  }

  private drawnProbe(object: ReflectionProbeObject): DrawnProbe {
    const worldToLocal = probeFrame(object.matrixWorld).invert();
    return { ...object.probe, worldToLocal, atlasLayer: this.captures.get(object)!.layer };
  }

  /** Points every lit material at this scene's probes for a render, or at none for a capture's. */
  private show(camera: THREE.Camera): void {
    const { atlas } = this;
    if (!atlas || this.packed.length === 0 || probeCaptureOf(camera)) {
      shownProbes[0] = 0;
      return;
    }
    shownProbes[0] = this.packed.length;
    shownProbes[1] = atlas.layout.borderSize;
    shownProbes[2] = atlas.layout.layerSizes.length - 1;
    showInSlot(this.renderer, atlasSlot, atlas.target.texture);
    showInSlot(this.renderer, rowsSlot, this.rows);
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

  /** Leaves no slot on this scene's textures before they are freed. */
  private leaveSlots(): void {
    if (this.atlas) leaveSlot(this.renderer, atlasSlot, this.atlas.target.texture);
    leaveSlot(this.renderer, rowsSlot, this.rows);
  }
}

/** A texture of `rows`, a probe's row of texels per line, marked for its first upload. */
function rowsTexture(rows: Float32Array): THREE.DataTexture {
  const height = rows.length / (PROBE_ROW_TEXELS * 4);
  const texture = new THREE.DataTexture(rows, PROBE_ROW_TEXELS, height, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  return texture;
}

function sameProbes(a: readonly ReflectionProbeObject[], b: readonly ReflectionProbeObject[]): boolean {
  return a.length === b.length && a.every((probe, index) => probe === b[index]);
}
