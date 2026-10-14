/**
 * What the volume pass draws for each render: the light pass's sampling and history blend, and the
 * copy into the volume every fog program reads. A recording renderer stands in for WebGL.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { VOLUMETRIC_FOG_TEMPORAL_JITTERS } from '../../godot/volumetricFog';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { decodeEnvironment } from '../../resources/environment/decode';
import { directionalShadowAtlasDepth } from '../directionalShadow/shadowAtlas';
import { castingSun } from '../testing/castingSun';
import { FogVolumePass } from './fogVolumePass';
import { areaLightAtlasTexture } from '../areaLight/areaLightAtlas';
import { AREA_LIGHT_ATLAS_UNIFORM } from '../areaLight/areaTextureFetch';

type FogVolumeInputs = Parameters<FogVolumePass['prepare']>[3];

/** One light pass slice as it was drawn. */
interface LightDraw {
  sampleCount: number;
  firstOffset: THREE.Vector3;
  historyAmount: number;
  frustumBegin: THREE.Vector2;
  frustumEnd: THREE.Vector2;
  directionalShadowAtlas: THREE.Texture | null;
  areaLightAtlas: THREE.Texture | null;
}

/** A renderer that records each draw instead of drawing it. */
class RecordingRenderer {
  autoClear = true;
  lightDraws: LightDraw[] = [];
  copies = 0;
  private target: THREE.WebGLRenderTarget | null = null;

  constructor(private readonly size = new THREE.Vector2(64, 32)) {}

  getCurrentViewport(viewport: THREE.Vector4): THREE.Vector4 {
    return viewport.set(0, 0, this.size.x, this.size.y);
  }
  getRenderTarget(): THREE.WebGLRenderTarget | null {
    return this.target;
  }
  getActiveCubeFace(): number {
    return 0;
  }
  getActiveMipmapLevel(): number {
    return 0;
  }
  setRenderTarget(target: THREE.WebGLRenderTarget | null): void {
    this.target = target;
  }
  render(quad: THREE.Mesh): void {
    const material = quad.material as THREE.ShaderMaterial;
    if (material.name === 'VolumetricFog.Copy') this.copies++;
    if (material.name !== 'VolumetricFog.Light') return;
    const uniforms = material.uniforms;
    this.lightDraws.push({
      sampleCount: uniforms['sampleCount']!.value as number,
      firstOffset: (uniforms['sampleOffsets']!.value as THREE.Vector3[])[0]!.clone(),
      historyAmount: uniforms['historyAmount']!.value as number,
      frustumBegin: (uniforms['frustumBegin']!.value as THREE.Vector2).clone(),
      frustumEnd: (uniforms['frustumEnd']!.value as THREE.Vector2).clone(),
      directionalShadowAtlas: uniforms['directionalShadowAtlas']!.value as THREE.Texture | null,
      areaLightAtlas: uniforms[AREA_LIGHT_ATLAS_UNIFORM]!.value as THREE.Texture | null,
    });
  }

  /** The light draws since the last call, and the copies, then forgets them. */
  take(): { lightDraws: LightDraw[]; copies: number } {
    const taken = { lightDraws: this.lightDraws, copies: this.copies };
    this.lightDraws = [];
    this.copies = 0;
    return taken;
  }

  /** No atlas has a texture here, so the raw depth read binds nothing. */
  getContext(): object {
    return {};
  }
  readonly properties = { get: () => ({}) };

  get asWebGL(): THREE.WebGLRenderer {
    return this as unknown as THREE.WebGLRenderer;
  }
}

/** A small grid, so each draw is two slices. */
const PROJECT = { volumeSize: 4, volumeDepth: 2, useFilter: true, useLegacyBlending: false };

function inputs(properties: Record<string, string> = {}): FogVolumeInputs {
  const environment = decodeEnvironment({ volumetric_fog_enabled: 'true', ...properties });
  return {
    fog: createEnvironmentSettings(environment, DEFAULT_CLEAR_COLOR).volumetricFog!,
    project: PROJECT,
    worldToSky: new THREE.Matrix3(),
    skyEnergy: 1,
    lights: [],
    casters: [],
  };
}

function camera(): THREE.PerspectiveCamera {
  const view = new THREE.PerspectiveCamera(75, 2, 0.05, 4000);
  view.updateMatrixWorld();
  return view;
}

function moved(view: THREE.Camera): void {
  view.position.x += 1;
  view.updateMatrixWorld();
}

const CENTRE = new THREE.Vector3(0.5, 0.5, 0.5);

describe('FogVolumePass.prepare', () => {
  it('samples each cell centre with no history on the first render', () => {
    const renderer = new RecordingRenderer();
    new FogVolumePass().prepare(renderer.asWebGL, new THREE.Scene(), camera(), inputs());

    const { lightDraws } = renderer.take();
    expect(lightDraws).toHaveLength(PROJECT.volumeDepth);
    expect(lightDraws[0]).toMatchObject({ sampleCount: 1, firstOffset: CENTRE, historyAmount: 0 });
  });

  it("binds the area light atlas, which an area light's texture colours the fog through", () => {
    const renderer = new RecordingRenderer();
    new FogVolumePass().prepare(renderer.asWebGL, new THREE.Scene(), camera(), inputs());

    expect(renderer.take().lightDraws[0]!.areaLightAtlas).toBe(areaLightAtlasTexture());
  });

  it('draws no volume into a viewport with no area, as Godot draws no frame there', () => {
    const renderer = new RecordingRenderer(new THREE.Vector2(0, 0));

    const isSettling = new FogVolumePass().prepare(renderer.asWebGL, new THREE.Scene(), camera(), inputs());

    expect(isSettling).toBe(false);
    expect(renderer.take()).toEqual({ lightDraws: [], copies: 0 });
  });

  it('draws no volume into a viewport so narrow that the grid has no column (edge case)', () => {
    // 1x40 against a side of 4: the ratio is 1 / 20, so the grid's width truncates to 0.
    const renderer = new RecordingRenderer(new THREE.Vector2(1, 40));

    const isSettling = new FogVolumePass().prepare(renderer.asWebGL, new THREE.Scene(), camera(), inputs());

    expect(isSettling).toBe(false);
    expect(renderer.take()).toEqual({ lightDraws: [], copies: 0 });
  });

  it('draws the mean of the 16 jitters once the view holds still, as Godot converges', () => {
    const renderer = new RecordingRenderer();
    const pass = new FogVolumePass();
    const scene = new THREE.Scene();
    const view = camera();
    const fog = inputs();
    expect(pass.prepare(renderer.asWebGL, scene, view, fog)).toBe(true);
    renderer.take();

    expect(pass.prepare(renderer.asWebGL, scene, view, fog)).toBe(false);
    expect(renderer.take().lightDraws[0]?.sampleCount).toBe(VOLUMETRIC_FOG_TEMPORAL_JITTERS.length);
  });

  it('draws nothing more for a view that has converged', () => {
    const renderer = new RecordingRenderer();
    const pass = new FogVolumePass();
    const scene = new THREE.Scene();
    const view = camera();
    const fog = inputs();
    pass.prepare(renderer.asWebGL, scene, view, fog);
    pass.prepare(renderer.asWebGL, scene, view, fog);
    renderer.take();

    expect(pass.prepare(renderer.asWebGL, scene, view, fog)).toBe(false);
    expect(renderer.take()).toEqual({ lightDraws: [], copies: 0 });
  });

  it('blends a moving view into its history at the reprojection amount, one jitter a frame', () => {
    const renderer = new RecordingRenderer();
    const pass = new FogVolumePass();
    const scene = new THREE.Scene();
    const view = camera();
    const fog = inputs({ volumetric_fog_temporal_reprojection_amount: '0.6' });
    pass.prepare(renderer.asWebGL, scene, view, fog);
    renderer.take();

    moved(view);
    expect(pass.prepare(renderer.asWebGL, scene, view, fog)).toBe(true);
    const [draw] = renderer.take().lightDraws;
    const [x, y, z] = VOLUMETRIC_FOG_TEMPORAL_JITTERS[1]!;
    expect(draw).toMatchObject({ sampleCount: 1, historyAmount: 0.6 });
    expect(draw!.firstOffset.x).toBe(x);
    expect(draw!.firstOffset.y).toBeCloseTo(1 - y, 6);
    expect(draw!.firstOffset.z).toBe(z);
  });

  it('samples the centres and keeps no history without temporal reprojection', () => {
    const renderer = new RecordingRenderer();
    const pass = new FogVolumePass();
    const scene = new THREE.Scene();
    const view = camera();
    const fog = inputs({ volumetric_fog_temporal_reprojection_enabled: 'false' });
    expect(pass.prepare(renderer.asWebGL, scene, view, fog)).toBe(false);

    moved(view);
    pass.prepare(renderer.asWebGL, scene, view, fog);
    expect(renderer.take().lightDraws.at(-1)).toMatchObject({
      sampleCount: 1,
      firstOffset: CENTRE,
      historyAmount: 0,
    });
  });

  it('copies the volume of whichever scene renders next, without drawing it again', () => {
    const renderer = new RecordingRenderer();
    const pass = new FogVolumePass();
    const first = new THREE.Scene();
    const second = new THREE.Scene();
    const view = camera();
    const fog = inputs({ volumetric_fog_temporal_reprojection_enabled: 'false' });
    pass.prepare(renderer.asWebGL, first, view, fog);
    pass.prepare(renderer.asWebGL, second, view, fog);
    renderer.take();

    pass.prepare(renderer.asWebGL, first, view, fog);
    expect(renderer.take()).toEqual({ lightDraws: [], copies: PROJECT.volumeDepth });
  });

  it('keeps each camera its own history, so two still cameras on one scene both settle', () => {
    const renderer = new RecordingRenderer();
    const pass = new FogVolumePass();
    const scene = new THREE.Scene();
    const main = camera();
    const other = camera();
    moved(other);
    const fog = inputs();
    for (let frame = 0; frame < 2; frame++) {
      pass.prepare(renderer.asWebGL, scene, main, fog);
      pass.prepare(renderer.asWebGL, scene, other, fog);
    }
    renderer.take();

    expect(pass.prepare(renderer.asWebGL, scene, main, fog)).toBe(false);
    expect(pass.prepare(renderer.asWebGL, scene, other, fog)).toBe(false);
    expect(renderer.take().lightDraws).toEqual([]);
  });

  it("frees every camera's volume and history when the scene is forgotten", () => {
    const renderer = new RecordingRenderer();
    const pass = new FogVolumePass();
    const scene = new THREE.Scene();
    pass.prepare(renderer.asWebGL, scene, camera(), inputs());
    pass.prepare(renderer.asWebGL, scene, camera(), inputs());
    const dispose = vi.spyOn(THREE.WebGL3DRenderTarget.prototype, 'dispose');

    pass.forget(scene);

    expect(dispose).toHaveBeenCalledTimes(4);
    dispose.mockRestore();
  });

  it('draws again when the sky turns', () => {
    const renderer = new RecordingRenderer();
    const pass = new FogVolumePass();
    const scene = new THREE.Scene();
    const view = camera();
    const toSky = new THREE.Matrix3();
    const fog = { ...inputs({ volumetric_fog_temporal_reprojection_enabled: 'false' }), worldToSky: toSky };
    pass.prepare(renderer.asWebGL, scene, view, fog);
    renderer.take();

    toSky.makeRotation(0.5);
    pass.prepare(renderer.asWebGL, scene, view, fog);
    expect(renderer.take().lightDraws).toHaveLength(PROJECT.volumeDepth);
  });

  it('spans one section at both ends for an orthographic camera (edge case)', () => {
    const renderer = new RecordingRenderer();
    const view = new THREE.OrthographicCamera(-3, 3, 2, -2, 0.5, 50);
    view.updateMatrixWorld();
    new FogVolumePass().prepare(renderer.asWebGL, new THREE.Scene(), view, inputs());

    const [draw] = renderer.take().lightDraws;
    expect(draw!.frustumBegin).toEqual(draw!.frustumEnd);
    expect(draw!.frustumEnd.x).toBeCloseTo(3, 6);
  });

  it('reads the directional atlas when a light shadows the fog', () => {
    const renderer = new RecordingRenderer();
    new FogVolumePass().prepare(renderer.asWebGL, new THREE.Scene(), camera(), {
      ...inputs(),
      lights: [castingSun()],
    });

    expect(renderer.take().lightDraws[0]!.directionalShadowAtlas).toBe(directionalShadowAtlasDepth());
  });

  it('reads no atlas when no light shadows the fog (edge case)', () => {
    const renderer = new RecordingRenderer();
    new FogVolumePass().prepare(renderer.asWebGL, new THREE.Scene(), camera(), {
      ...inputs(),
      lights: [new THREE.DirectionalLight()],
    });

    expect(renderer.take().lightDraws[0]!.directionalShadowAtlas).toBeNull();
  });

  it('draws a still view again when a caster of a shadowed light moves', () => {
    const renderer = new RecordingRenderer();
    const pass = new FogVolumePass();
    const scene = new THREE.Scene();
    const view = camera();
    const box = Object.assign(new THREE.Mesh(), { castShadow: true });
    const fog = { ...inputs(), lights: [castingSun()], casters: [box] };
    pass.prepare(renderer.asWebGL, scene, view, fog);
    pass.prepare(renderer.asWebGL, scene, view, fog);
    renderer.take();

    box.position.y = 1;
    box.updateMatrixWorld();
    pass.prepare(renderer.asWebGL, scene, view, fog);
    expect(renderer.take().lightDraws).toHaveLength(PROJECT.volumeDepth);
  });

  it('holds a still view when a mesh moves and no light shadows the fog (edge case)', () => {
    const renderer = new RecordingRenderer();
    const pass = new FogVolumePass();
    const scene = new THREE.Scene();
    const view = camera();
    const box = Object.assign(new THREE.Mesh(), { castShadow: true });
    const fog = { ...inputs(), casters: [box] };
    pass.prepare(renderer.asWebGL, scene, view, fog);
    pass.prepare(renderer.asWebGL, scene, view, fog);
    renderer.take();

    box.position.y = 1;
    box.updateMatrixWorld();
    pass.prepare(renderer.asWebGL, scene, view, fog);
    expect(renderer.take().lightDraws).toEqual([]);
  });
});
