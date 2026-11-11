/**
 * Freelook through the canvas's own events: the held right-drag and the Shift+F toggle fly at one
 * speed, the wheel changes that speed, and each of Godot's end conditions ends the toggle.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  drag,
  keyDown,
  mountEditorControls,
  pressKey,
  previewAuthoredCamera,
  unmountEditorControls,
  viewDirection,
} from './GodotEditorControls.testkit';
import { holdsPointerLock } from './pointerLock';
import { endFakePointerLock, installFakePointerLock } from './testing/fakePointerLock';

/** `editors/3d/freelook/freelook_base_speed` (`editor_settings.cpp:961`). */
const FREELOOK_BASE_SPEED = 5.0;

/** `ZOOM_FREELOOK_MULTIPLIER` (`node_3d_editor_plugin.cpp:120`): one wheel notch, for zoom and speed. */
const WHEEL_NOTCH_MULTIPLIER = 1.08;

/** `_update_freelook`'s slow modifier (`node_3d_editor_plugin.cpp:3126`). */
const FREELOOK_SLOW_MULTIPLIER = 0.333333;

/** `editors/3d/freelook/freelook_sensitivity` (`editor_settings.cpp:959`), in degrees per pixel. */
const FREELOOK_DEGREES_PER_PIXEL = 0.25;

/** One frame of the test renderer, whose `advanceFrames` takes its delta in seconds. */
const FRAME_SECONDS = 0.016;

/** What a test set up outside its canvas. Filled by the helpers below, run and emptied after each test. */
const cleanups: (() => void)[] = [];

afterEach(async () => {
  await unmountEditorControls();
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** A canvas in a browser that grants pointer locks. */
async function mountFreelook() {
  const mounted = await mountEditorControls();
  cleanups.push(installFakePointerLock(mounted.element));
  return mounted;
}

/** An element in the page for the length of one test. */
function addToPage<T extends HTMLElement>(element: T): T {
  document.body.appendChild(element);
  cleanups.push(() => element.remove());
  return element;
}

type Mounted = Awaited<ReturnType<typeof mountEditorControls>>;

function toggleFreelook(): Promise<void> {
  return pressKey('KeyF', { key: 'F', shiftKey: true });
}

function holdRightButton(element: HTMLCanvasElement): void {
  element.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 2, clientX: 0, clientY: 0 }));
}

function wheel(element: HTMLCanvasElement, deltaY: number): void {
  element.dispatchEvent(new WheelEvent('wheel', { deltaY, cancelable: true }));
}

/** How far the camera travels in one frame with the keys now held. */
async function travelInOneFrame({ renderer, get }: Mounted): Promise<THREE.Vector3> {
  const camera = get().camera;
  const before = camera.position.clone();
  await renderer.advanceFrames(1, FRAME_SECONDS);
  return camera.position.clone().sub(before);
}

describe('held freelook', () => {
  it('changes the flight speed on the wheel, and leaves the orbit radius alone', async () => {
    const mounted = await mountFreelook();
    const { get, controls, element } = mounted;
    const radius = get().camera.position.distanceTo(controls.target);
    holdRightButton(element);

    wheel(element, -200);
    keyDown('KeyW');

    const travelled = (await travelInOneFrame(mounted)).length();
    expect(travelled).toBeCloseTo(FREELOOK_BASE_SPEED * WHEEL_NOTCH_MULTIPLIER ** 2 * FRAME_SECONDS, 9);
    expect(get().camera.position.distanceTo(controls.target)).toBeCloseTo(radius, 9);
  });

  it('slows the flight on a wheel-down notch', async () => {
    const mounted = await mountFreelook();
    holdRightButton(mounted.element);

    wheel(mounted.element, 100);
    keyDown('KeyW');

    const travelled = (await travelInOneFrame(mounted)).length();
    expect(travelled).toBeCloseTo((FREELOOK_BASE_SPEED / WHEEL_NOTCH_MULTIPLIER) * FRAME_SECONDS, 9);
  });

  it('keeps the wheel’s zoom when no freelook is on', async () => {
    const { get, controls, element } = await mountFreelook();
    const radius = get().camera.position.distanceTo(controls.target);

    wheel(element, -100);

    expect(get().camera.position.distanceTo(controls.target)).toBeCloseTo(radius / WHEEL_NOTCH_MULTIPLIER, 9);
  });

  it('flies at a third of the speed while Alt is held', async () => {
    const mounted = await mountFreelook();
    holdRightButton(mounted.element);

    keyDown('KeyW', { altKey: true });

    const travelled = (await travelInOneFrame(mounted)).length();
    expect(travelled).toBeCloseTo(FREELOOK_BASE_SPEED * FREELOOK_SLOW_MULTIPLIER * FRAME_SECONDS, 9);
  });

  it.each([
    ['ArrowUp', new THREE.Vector3(0, 0, -1)],
    ['ArrowDown', new THREE.Vector3(0, 0, 1)],
    ['ArrowLeft', new THREE.Vector3(-1, 0, 0)],
    ['ArrowRight', new THREE.Vector3(1, 0, 0)],
    ['Space', new THREE.Vector3(0, 1, 0)],
    ['KeyE', new THREE.Vector3(0, 1, 0)],
    ['KeyQ', new THREE.Vector3(0, -1, 0)],
  ])('flies on %s along the camera’s own axis', async (code, cameraAxis) => {
    const mounted = await mountFreelook();
    holdRightButton(mounted.element);

    keyDown(code);

    const expected = cameraAxis.applyQuaternion(mounted.get().camera.quaternion);
    const travelled = await travelInOneFrame(mounted);
    expect(travelled.normalize().distanceTo(expected)).toBeLessThan(1e-9);
  });

  it('pans on a right-drag in orthographic view, and does not turn the camera', async () => {
    const { get, controls, element } = await mountFreelook();
    await pressKey('Numpad5');
    const direction = viewDirection(get().camera);
    const target = controls.target.clone();

    drag(element, 2, [100, 100], [180, 120]);

    expect(viewDirection(get().camera).distanceTo(direction)).toBeLessThan(1e-9);
    expect(controls.target.distanceTo(target)).toBeGreaterThan(0);
  });

  it('does not fly on a right-drag in orthographic view', async () => {
    const mounted = await mountFreelook();
    await pressKey('Numpad5');
    holdRightButton(mounted.element);

    keyDown('KeyW');

    expect((await travelInOneFrame(mounted)).length()).toBe(0);
  });
});

describe('toggled freelook', () => {
  it('captures the pointer on Shift+F and flies with no button held', async () => {
    const mounted = await mountFreelook();

    await toggleFreelook();
    keyDown('KeyW');

    expect(holdsPointerLock(mounted.element)).toBe(true);
    expect((await travelInOneFrame(mounted)).length()).toBeCloseTo(FREELOOK_BASE_SPEED * FRAME_SECONDS, 9);
  });

  it('turns the camera in place by the mouse’s own motion', async () => {
    const { get, element } = await mountFreelook();
    const camera = get().camera;
    const eye = camera.position.clone();
    const direction = viewDirection(camera);
    await toggleFreelook();

    element.dispatchEvent(new PointerEvent('pointermove', { movementX: 40, movementY: 0 }));

    const turned = viewDirection(camera).angleTo(direction);
    const pitch = Math.asin(direction.y);
    // A yaw of 10 degrees sweeps a pitched view direction through a smaller angle.
    const expected =
      2 *
      Math.asin(Math.cos(pitch) * Math.sin(THREE.MathUtils.degToRad(40 * FREELOOK_DEGREES_PER_PIXEL) / 2));
    expect(turned).toBeCloseTo(expected, 9);
    expect(camera.position.distanceTo(eye)).toBeLessThan(1e-9);
  });

  it('leaves the camera alone on mouse motion while freelook is off', async () => {
    const { get, element } = await mountFreelook();
    const direction = viewDirection(get().camera);

    element.dispatchEvent(new PointerEvent('pointermove', { movementX: 40, movementY: 10 }));

    expect(viewDirection(get().camera).distanceTo(direction)).toBe(0);
  });

  it('ends on a second Shift+F', async () => {
    const { element } = await mountFreelook();
    await toggleFreelook();

    await toggleFreelook();

    expect(holdsPointerLock(element)).toBe(false);
  });

  it('ends on Escape', async () => {
    const { element } = await mountFreelook();
    await toggleFreelook();

    keyDown('Escape', { key: 'Escape' });

    expect(holdsPointerLock(element)).toBe(false);
  });

  it('ends when the window loses focus', async () => {
    const { element } = await mountFreelook();
    await toggleFreelook();

    window.dispatchEvent(new Event('blur'));

    expect(holdsPointerLock(element)).toBe(false);
  });

  it('ends when a camera preview starts', async () => {
    const mounted = await mountFreelook();
    await toggleFreelook();

    await previewAuthoredCamera(mounted.get);
    await mounted.renderer.advanceFrames(1, FRAME_SECONDS);

    expect(holdsPointerLock(mounted.element)).toBe(false);
  });

  it('ends when the canvas unmounts', async () => {
    const { element } = await mountFreelook();
    await toggleFreelook();

    await unmountEditorControls();

    expect(holdsPointerLock(element)).toBe(false);
  });

  it('stops flying when the browser ends the lock with a key still held', async () => {
    const mounted = await mountFreelook();
    await toggleFreelook();
    keyDown('KeyW');

    endFakePointerLock();

    expect((await travelInOneFrame(mounted)).length()).toBe(0);
  });

  it('does not start during a camera preview', async () => {
    const { get, element } = await mountFreelook();
    await previewAuthoredCamera(get);

    await toggleFreelook();

    expect(holdsPointerLock(element)).toBe(false);
  });

  it('does not start in orthographic view', async () => {
    const { element } = await mountFreelook();
    await pressKey('Numpad5');

    await toggleFreelook();

    expect(holdsPointerLock(element)).toBe(false);
  });

  it('does not start from a Shift+F typed into a text field', async () => {
    const { element } = await mountFreelook();
    const input = addToPage(document.createElement('input'));

    input.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyF', key: 'F', shiftKey: true, bubbles: true })
    );

    expect(holdsPointerLock(element)).toBe(false);
  });

  it('stays off, and does not fly, when the browser refuses the lock', async () => {
    const mounted = await mountEditorControls();

    await toggleFreelook();
    keyDown('KeyW');

    expect((await travelInOneFrame(mounted)).length()).toBe(0);
  });

  it('keeps the speed the wheel set for the next freelook', async () => {
    const mounted = await mountFreelook();
    await toggleFreelook();
    wheel(mounted.element, -100);
    await toggleFreelook();

    holdRightButton(mounted.element);
    keyDown('KeyW');

    const travelled = (await travelInOneFrame(mounted)).length();
    expect(travelled).toBeCloseTo(FREELOOK_BASE_SPEED * WHEEL_NOTCH_MULTIPLIER * FRAME_SECONDS, 9);
  });

  it('takes focus from the control that started it, so Space cannot press that control', async () => {
    const { element } = await mountFreelook();
    const button = addToPage(document.createElement('button'));
    addToPage(element);
    button.focus();

    await toggleFreelook();

    expect(document.activeElement).toBe(element);
  });
});

describe('picking while freelook is toggled', () => {
  it('turns the canvas’s pointer picking off, since a locked pointer has no position', async () => {
    const { get } = await mountFreelook();

    await toggleFreelook();

    expect(get().events.enabled).toBe(false);
  });

  it('turns the picking on again when freelook ends', async () => {
    const { get } = await mountFreelook();
    await toggleFreelook();

    await toggleFreelook();

    expect(get().events.enabled).toBe(true);
  });
});

describe('keys while freelook is on', () => {
  /** The key codes a listener on `window` hears: what every other shortcut of the page would get. */
  function hearKeys(): string[] {
    const heard: string[] = [];
    const listener = (event: KeyboardEvent): void => {
      heard.push(event.code);
    };
    window.addEventListener('keydown', listener);
    cleanups.push(() => window.removeEventListener('keydown', listener));
    return heard;
  }

  it('keeps every key from the page’s other shortcuts, as Godot accepts each event', async () => {
    await mountFreelook();
    await toggleFreelook();
    const heard = hearKeys();

    keyDown('KeyW');
    keyDown('ArrowUp');
    keyDown('KeyF', { key: 'f' });
    keyDown('Numpad7');

    expect(heard).toEqual([]);
  });

  it('gives the keys back when freelook ends', async () => {
    await mountFreelook();
    await toggleFreelook();
    await toggleFreelook();
    const heard = hearKeys();

    keyDown('ArrowUp');

    expect(heard).toEqual(['ArrowUp']);
  });

  it.each(['Space', 'ArrowDown', 'AltLeft'])('stops the browser’s own action on %s', async (code) => {
    await mountFreelook();
    await toggleFreelook();

    expect(keyDown(code).defaultPrevented).toBe(true);
  });

  it('does not move the view on a numpad key', async () => {
    const { get } = await mountFreelook();
    const direction = viewDirection(get().camera);
    await toggleFreelook();

    keyDown('Numpad7');

    expect(viewDirection(get().camera).distanceTo(direction)).toBe(0);
  });
});
