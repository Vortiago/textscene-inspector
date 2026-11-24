import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import * as THREE from 'three';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph.testkit';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { EditorControlsBridge } from './EditorControlsBridge';
import { GodotEditorControls } from './GodotEditorControls';
import { pressKeyOn } from './GodotEditorControls.testkit';
import { editorCameraPosition, editorCameraProjection } from './godotEditorCamera';
import { holdsPointerLock } from './pointerLock';
import { installFakePointerLock } from '../testing/fakePointerLock';
import { r3fStateProbe } from '../testing/R3FStateProbe';
import { createEditorCameras } from './editorCamera/editorCameras';
import { EditorCamerasProvider } from './editorCamera/EditorCamerasContext';
import { ViewStatusProvider } from '../viewStatus/ViewStatusContext';
import { createViewStatusStore } from '../viewStatus/viewStatus';
import { variant } from '../../scene/variant';
import type { EditorControlsHandle } from './EditorControlsHandle';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** Written by `mountBridgedControls`, run and cleared after each test. */
let unmount: (() => Promise<void>) | null = null;

afterEach(async () => {
  await unmount?.();
  unmount = null;
});

async function mountBridgedControls() {
  const canvas = r3fStateProbe();
  const cameras = createEditorCameras();
  const store = createViewStatusStore();
  const sceneAt = (scenePath: string) => (
    <HierarchyProvider
      value={{ sceneGraph: createSceneGraphFromTscnScene({ nodes: [] }, scenePath), panelId: 'panel' }}
    >
      <ViewStatusProvider store={store}>
        <EditorCamerasProvider cameras={cameras}>
          <canvas.Probe />
          <mesh position={[10, 0, 0]}>
            <boxGeometry args={[2, 2, 2]} />
          </mesh>
          <GodotEditorControls />
          <EditorControlsBridge />
        </EditorCamerasProvider>
      </ViewStatusProvider>
    </HierarchyProvider>
  );
  // The editor stage's camera, as `EditorCanvas` gives it.
  const renderer: Renderer = await ReactThreeTestRenderer.create(sceneAt('res://first.tscn'), {
    camera: { position: editorCameraPosition(), ...editorCameraProjection() },
  });
  const openScene = (scenePath: string) => act(async () => renderer.update(sceneAt(scenePath)));
  const element = canvas.state().gl.domElement;
  const removeFakePointerLock = installFakePointerLock(element);
  unmount = async () => {
    await act(async () => renderer.unmount());
    removeFakePointerLock();
  };
  const camera = cameras.of('3D')!;
  return { get: canvas.state, camera, status: store.status, element, openScene };
}

describe('<EditorControlsBridge>', () => {
  it('gives the editor camera’s Godot defaults: fov 70, near 0.05, far 4000, perspective', async () => {
    const { camera } = await mountBridgedControls();

    expect(await camera.get('fov')).toBe(70);
    expect(await camera.get('near')).toBe(0.05);
    expect(await camera.get('far')).toBe(4000);
    expect(await camera.get('projection')).toBe(0);
  });

  it('gives the pose as a Transform3D at the camera’s position', async () => {
    const { get, camera } = await mountBridgedControls();
    get().camera.position.set(1, 2, 3);
    get().camera.quaternion.identity();

    const transform = await camera.get('transform');

    expect(transform).toMatchObject({
      type: 'Transform3D',
      text: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)',
    });
  });

  it('moves the eye on a write of position, and keeps it looking at its focus point', async () => {
    const { get, camera } = await mountBridgedControls();

    expect(await camera.set('position', variant('Vector3(0, 0, 5)'))).toBe(true);

    expect(get().camera.position.toArray()).toEqual([0, 0, 5]);
    const forward = get().camera.getWorldDirection(new THREE.Vector3());
    expect(forward.z).toBeCloseTo(-1);
  });

  it.each([
    ['Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 9)', [2, 3, 9], [0, 0, -1]],
    ['Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 5, 0, 0)', [5, 0, 0], [-1, 0, 0]],
    ['Transform3D(1, 0, 0, 0, 0, -1, 0, 1, 0, 0, 7, 0)', [0, 7, 0], [0, 1, 0]],
  ])('looks from the pose of %s', async (text, position, forward) => {
    const { get, camera } = await mountBridgedControls();

    expect(await camera.set('transform', variant(text))).toBe(true);

    expect(get().camera.position.toArray()).toEqual(position);
    const looking = get().camera.getWorldDirection(new THREE.Vector3()).toArray();
    looking.forEach((component, axis) => expect(component).toBeCloseTo(forward[axis]!));
  });

  it('keeps the orbit distance on a write of transform', async () => {
    const { camera, get } = await mountBridgedControls();
    const handle = get().controls as EditorControlsHandle;
    const distance = handle.cursor().distance;

    await camera.set('transform', variant('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 9)'));

    expect(handle.cursor().distance).toBeCloseTo(distance);
    expect(handle.target.toArray().map((n) => Math.round(n * 1e6) / 1e6)).toEqual([2, 3, 9 - distance]);
  });

  it.each([
    [1, 1],
    [35, 35],
    [179, 179],
    [0.5, 70],
    [180, 70],
    [-5, 70],
  ])('takes a fov of %s only inside Godot’s 1 to 179 range, and gives %s', async (fov, given) => {
    const { get, camera } = await mountBridgedControls();

    expect(await camera.set('fov', fov)).toBe(true);

    expect((get().camera as THREE.PerspectiveCamera).fov).toBe(given);
  });

  it('switches to the orthogonal projection, as Numpad 5 does', async () => {
    const { get, camera } = await mountBridgedControls();

    expect(await camera.set('projection', 1)).toBe(true);

    expect(get().camera).toBeInstanceOf(THREE.OrthographicCamera);
    expect(await camera.get('projection')).toBe(1);
    expect(await camera.set('projection', 2)).toBe(false);
  });

  it('starts and ends freelook on a write of freelook', async () => {
    const { camera, element, status } = await mountBridgedControls();

    await act(async () => void (await camera.set('freelook', true)));
    expect(holdsPointerLock(element)).toBe(true);
    expect(status().freelook).toEqual({ isToggled: true, isAvailable: true });

    await act(async () => void (await camera.set('freelook', false)));
    expect(holdsPointerLock(element)).toBe(false);
    expect(status().freelook).toEqual({ isToggled: false, isAvailable: true });
  });

  it('refuses to start freelook in the orthogonal projection, which has none', async () => {
    const { camera, element } = await mountBridgedControls();
    await camera.set('projection', 1);

    expect(await camera.set('freelook', true)).toBe(false);
    expect(holdsPointerLock(element)).toBe(false);
  });

  it('leaves the read of freelook to the view status', async () => {
    const { camera } = await mountBridgedControls();

    expect(await camera.get('freelook')).toBeNull();
  });

  it('reports that orthographic view has no freelook', async () => {
    const { element, status } = await mountBridgedControls();

    await pressKeyOn(element, 'Numpad5');

    expect(status().freelook).toEqual({ isToggled: false, isAvailable: false });
  });

  it('returns the camera to its opening pose on reset, and ends freelook', async () => {
    const { get, camera, element } = await mountBridgedControls();
    await act(async () => void (await camera.set('freelook', true)));
    get().camera.position.set(9, 9, 9);

    await act(async () => void (await camera.call('reset')));

    expect(get().camera.position.toArray()).toEqual(editorCameraPosition());
    expect(holdsPointerLock(element)).toBe(false);
  });

  it('frames the whole scene on focus with no node', async () => {
    const { get, camera } = await mountBridgedControls();

    await act(async () => void (await camera.call('focus')));

    expect(get().controls).toMatchObject({ target: new THREE.Vector3(10, 0, 0) });
  });

  it('refuses a method the editor camera lacks', async () => {
    const { camera } = await mountBridgedControls();

    await expect(camera.call('make_current')).rejects.toThrow(
      'expected a method of the editor camera (reset, focus), got make_current'
    );
  });

  it('ends the toggle when another scene opens', async () => {
    const { camera, element, openScene } = await mountBridgedControls();
    await act(async () => void (await camera.set('freelook', true)));

    await openScene('res://second.tscn');

    expect(holdsPointerLock(element)).toBe(false);
  });

  it('keeps the toggle through a reload of the same scene', async () => {
    const { camera, element, openScene } = await mountBridgedControls();
    await act(async () => void (await camera.set('freelook', true)));

    await openScene('res://first.tscn');

    expect(holdsPointerLock(element)).toBe(true);
  });

  it('leaves the node and reports no freelook once the canvas unmounts', async () => {
    const { camera, status } = await mountBridgedControls();

    await unmount?.();

    expect(camera.isInsideTree()).toBe(false);
    expect(status().freelook).toBeNull();
  });
});
