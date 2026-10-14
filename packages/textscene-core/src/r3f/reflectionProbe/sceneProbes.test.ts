import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SCAN_FRAMES_AFTER_SETTLE } from '../environment/useLatchedSceneScan';
import { heading } from '../../parser/testing/parserKit';
import { parseReflectionProbe } from '../../nodes/3d/reflectionprobe/parser';
import { testRenderer } from '../../testing/recordingWebGL';
import { fireSceneRender, fireSceneRenderEnd } from '../testing/fireSceneRender';
import { captureCameras } from './captureCameras';
import { ReflectionProbeObject } from './reflectionProbeObject';
import { SceneProbes } from './sceneProbes';
import { shownProbes } from './probeSlots';

const CLEAR = new THREE.Color(0.3, 0.3, 0.3);

afterEach(() => {
  vi.restoreAllMocks();
  shownProbes.fill(0);
});

function probeObject(properties: Record<string, string> = {}, treeOrder = [0]): ReflectionProbeObject {
  const object = new ReflectionProbeObject();
  object.probe = parseReflectionProbe(heading('ReflectionProbe', { name: 'Probe' }), properties);
  object.treeOrder = treeOrder;
  return object;
}

async function sceneWith(...probes: ReflectionProbeObject[]) {
  const { renderer } = await testRenderer();
  const scene = new THREE.Scene();
  scene.add(...probes);
  scene.updateMatrixWorld();
  const sceneProbes = new SceneProbes(renderer, scene);
  const renders = vi.spyOn(renderer, 'render');
  const sceneRenders = () => renders.mock.calls.filter(([rendered]) => rendered === scene).length;
  /** The capture faces one `update` drew. */
  const facesDrawn = (pending = 0) => {
    const before = sceneRenders();
    sceneProbes.update(pending, CLEAR);
    return sceneRenders() - before;
  };
  const settle = () => {
    for (let frame = 1; frame < SCAN_FRAMES_AFTER_SETTLE; frame += 1) facesDrawn();
  };
  return { renderer, scene, sceneProbes, facesDrawn, settle };
}

describe('SceneProbes.update', () => {
  it('captures nothing while a resource is on its way, nor for a few frames after', async () => {
    const { facesDrawn } = await sceneWith(probeObject());

    expect(facesDrawn(1)).toBe(0);
    expect(Array.from({ length: SCAN_FRAMES_AFTER_SETTLE - 1 }, () => facesDrawn())).not.toContain(6);
  });

  it("captures a probe's six faces once the scene settles", async () => {
    const { facesDrawn, settle } = await sceneWith(probeObject());
    settle();

    expect([facesDrawn(), facesDrawn()]).toEqual([6, 0]);
  });

  it('captures one probe a frame, as Godot captures one at a time', async () => {
    const { facesDrawn, settle } = await sceneWith(probeObject(), probeObject());
    settle();

    expect([facesDrawn(), facesDrawn(), facesDrawn()]).toEqual([6, 6, 0]);
  });

  it('captures the probes in tree order, whatever order they mount in', async () => {
    const second = probeObject({}, [1]);
    const first = probeObject({}, [0]);
    first.position.x = 1;
    const { renderer, facesDrawn, settle } = await sceneWith(second, first);
    settle();
    const renders = vi.spyOn(renderer, 'render');
    facesDrawn();

    expect((renders.mock.calls[0]![1] as THREE.Camera).position.x).toBeCloseTo(1, 6);
  });

  it('captures a probe again when it moves', async () => {
    const probe = probeObject();
    const { facesDrawn, settle } = await sceneWith(probe);
    settle();
    facesDrawn();

    probe.position.x = 3;
    probe.updateMatrixWorld();

    expect(facesDrawn()).toBe(6);
  });

  it('captures every probe again once new content settles (edge case)', async () => {
    const { facesDrawn, settle } = await sceneWith(probeObject());
    settle();
    facesDrawn();

    facesDrawn(1);
    settle();

    expect(facesDrawn()).toBe(6);
  });

  it('keeps showing a stale capture until its probe captures again (edge case)', async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject(), probeObject());
    settle();
    facesDrawn();
    facesDrawn();

    facesDrawn(1);
    settle();
    facesDrawn();
    fireSceneRender(scene, new THREE.PerspectiveCamera());

    expect(shownProbes[0]).toBe(2);
  });

  it('captures no hidden probe (edge case)', async () => {
    const probe = probeObject();
    probe.visible = false;
    const { facesDrawn, settle } = await sceneWith(probe);
    settle();

    expect(facesDrawn()).toBe(0);
  });
});

describe('SceneProbes rendering', () => {
  it("shows the captured probes, the atlas's border and its last layer to a render of the scene", async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject({ update_mode: '1' }));
    settle();
    facesDrawn();

    fireSceneRender(scene, new THREE.PerspectiveCamera());

    expect(Array.from(shownProbes.subarray(0, 3))).toEqual([1, expect.closeTo(0.8, 6), 6]);
  });

  it('uploads the rows when a capture changes them, not every frame', async () => {
    const { renderer, facesDrawn, settle } = await sceneWith(probeObject());
    settle();
    facesDrawn();
    const uploads = vi.spyOn(renderer, 'initTexture');

    facesDrawn();
    facesDrawn();

    expect(uploads).not.toHaveBeenCalled();
  });

  it('stops showing a probe once it hides (edge case)', async () => {
    const hidden = probeObject();
    const { scene, facesDrawn, settle } = await sceneWith(probeObject(), hidden);
    settle();
    facesDrawn();
    facesDrawn();

    hidden.visible = false;
    facesDrawn();
    fireSceneRender(scene, new THREE.PerspectiveCamera());

    expect(shownProbes[0]).toBe(1);
  });

  it('shows no probe to a capture, as Godot captures without them (edge case)', async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject());
    settle();
    facesDrawn();
    const [captureCamera] = captureCameras(new THREE.Matrix4(), { x: 0, y: 0, z: 0 }, [1, 1, 1, 1, 1, 1], {
      isInterior: false,
      hasShadows: true,
    });

    fireSceneRender(scene, captureCamera!);

    expect(shownProbes[0]).toBe(0);
  });

  it('shows no probe once the render ends, so another scene draws none', async () => {
    const { scene, facesDrawn, settle } = await sceneWith(probeObject());
    settle();
    facesDrawn();
    const camera = new THREE.PerspectiveCamera();
    fireSceneRender(scene, camera);

    fireSceneRenderEnd(scene, camera);

    expect(shownProbes[0]).toBe(0);
  });

  it('hides the shadows from a capture without enable_shadows, until its render ends', async () => {
    const { scene } = await sceneWith();
    const light = new THREE.DirectionalLight();
    light.shadow.intensity = 0.8;
    scene.add(light);
    const [captureCamera] = captureCameras(new THREE.Matrix4(), { x: 0, y: 0, z: 0 }, [1, 1, 1, 1, 1, 1], {
      isInterior: false,
      hasShadows: false,
    });

    fireSceneRender(scene, captureCamera!);
    const during = light.shadow.intensity;
    fireSceneRenderEnd(scene, captureCamera!);

    expect([during, light.shadow.intensity]).toEqual([0, 0.8]);
  });
});
