/**
 * Mounts `<GodotEditorControls>` in a test canvas and sends it the pointer and key events a
 * browser would. Shared by the navigation and freelook tests.
 */
import * as THREE from 'three';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import type { RootState } from '@react-three/fiber';
import { r3fStateProbe } from './testing/R3FStateProbe';
import { EditorControlsHandle, GodotEditorControls } from './GodotEditorControls';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** Written only by `mountEditorControls`, cleared by `unmountEditorControls`. */
const mounted = new Set<Renderer>();

/** For `afterEach`: every canvas a test mounted unmounts, so no window listener leaks. */
export async function unmountEditorControls(): Promise<void> {
  for (const renderer of mounted) await act(async () => renderer.unmount());
  mounted.clear();
}

export async function mountEditorControls() {
  const { Probe, state: get } = r3fStateProbe();
  const renderer = await ReactThreeTestRenderer.create(
    <>
      <Probe />
      <GodotEditorControls />
    </>
  );
  mounted.add(renderer);
  const state = get();
  const controls = state.controls;
  if (!(controls instanceof EditorControlsHandle)) {
    throw new Error('controls were not published to the R3F store');
  }
  return { renderer, get, controls, element: state.gl.domElement };
}

export function drag(
  element: HTMLCanvasElement,
  button: number,
  from: [number, number],
  to: [number, number],
  modifiers: { shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean } = {}
): void {
  const common = { pointerId: 1, bubbles: true, cancelable: true, ...modifiers };
  element.dispatchEvent(
    new PointerEvent('pointerdown', { ...common, button, clientX: from[0], clientY: from[1] })
  );
  element.dispatchEvent(
    new PointerEvent('pointermove', { ...common, button, clientX: to[0], clientY: to[1] })
  );
  element.dispatchEvent(new PointerEvent('pointerup', { ...common, button }));
}

/** A keydown from the page's body, as a key pressed with no field focused. Returns the event. */
export function keyDown(code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
  document.body.dispatchEvent(event);
  return event;
}

export function keyUp(code: string, init: KeyboardEventInit = {}): void {
  document.body.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true, ...init }));
}

export async function pressKey(code: string, init: KeyboardEventInit = {}): Promise<void> {
  await act(async () => {
    keyDown(code, init);
  });
  keyUp(code, init);
}

/** Where the camera is pointing, in world space. */
export function viewDirection(camera: THREE.Camera): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
}

/** Makes an authored camera the one R3F renders, as previewing a Camera3D does. */
export async function previewAuthoredCamera(get: () => RootState): Promise<THREE.PerspectiveCamera> {
  const authored = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  authored.position.set(3, 1, 2);
  await act(async () => {
    get().set({ camera: authored });
  });
  return authored;
}
