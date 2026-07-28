/**
 * The event wiring around the navigation maths: what the canvas listens to,
 * what it deliberately ignores (plain left-drag belongs to selection, keys
 * typed into a text field belong to the field), that it stops listening when
 * it unmounts, and that the handle it publishes as R3F's `state.controls`
 * honours the framing contract `frameSceneBounds` depends on.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { useThree, type RootState } from '@react-three/fiber';
import { EditorControlsHandle, GodotEditorControls } from './GodotEditorControls';
import { editorCameraPosition } from './godotEditorCamera';

let getState: (() => RootState) | null = null;

function StateProbe() {
  getState = useThree((s) => s.get);
  return null;
}

async function mount() {
  const renderer = await ReactThreeTestRenderer.create(
    <>
      <StateProbe />
      <GodotEditorControls />
    </>
  );
  const get = getState;
  if (!get) throw new Error('probe never rendered');
  const state = get();
  const controls = state.controls;
  if (!(controls instanceof EditorControlsHandle)) {
    throw new Error('controls were not published to the R3F store');
  }
  return { renderer, get, controls, element: state.gl.domElement };
}

function drag(
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

async function pressKey(code: string, init: KeyboardEventInit = {}): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...init }));
  });
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
}

/** Where the camera is pointing, in world space. */
function viewDirection(camera: THREE.Camera): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
}

describe('<GodotEditorControls> mounting', () => {
  it('publishes a handle with a focus point and aims the camera at it', async () => {
    const { get, controls } = await mount();
    const camera = get().camera;
    expect(controls.target).toBeInstanceOf(THREE.Vector3);
    const toTarget = controls.target.clone().sub(camera.position).normalize();
    expect(viewDirection(camera).distanceTo(toTarget)).toBeLessThan(1e-6);
  });

  it('stops navigating once it unmounts', async () => {
    const { renderer, get, element } = await mount();
    const camera = get().camera;
    await act(async () => {
      renderer.unmount();
    });
    const before = camera.position.clone();
    drag(element, 1, [0, 0], [60, 20]);
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    expect(camera.position.distanceTo(before)).toBe(0);
  });

  it('hands R3F back the controls it found on unmount', async () => {
    const { renderer, get } = await mount();
    await act(async () => {
      renderer.unmount();
    });
    expect(get().controls).toBeNull();
  });
});

describe('<GodotEditorControls> mouse navigation', () => {
  it('orbits on a middle-drag, keeping the focus point and the radius', async () => {
    const { get, controls, element } = await mount();
    const camera = get().camera;
    const before = camera.position.clone();
    const radius = before.distanceTo(controls.target);

    drag(element, 1, [100, 100], [180, 120]);

    expect(camera.position.distanceTo(before)).toBeGreaterThan(0.01);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(radius, 6);
    expect(controls.target.length()).toBe(0);
  });

  it('pans on shift+middle-drag, moving the focus point with the camera', async () => {
    const { get, controls, element } = await mount();
    const camera = get().camera;
    const cameraBefore = camera.position.clone();

    drag(element, 1, [100, 100], [180, 120], { shiftKey: true });

    const targetDelta = controls.target.clone();
    expect(targetDelta.length()).toBeGreaterThan(0);
    expect(camera.position.clone().sub(cameraBefore).distanceTo(targetDelta)).toBeLessThan(1e-6);
  });

  it('zooms on ctrl+middle-drag and on the wheel', async () => {
    const { get, controls, element } = await mount();
    const camera = get().camera;
    const radius = camera.position.distanceTo(controls.target);

    drag(element, 1, [100, 100], [100, 180], { ctrlKey: true });
    const dragged = camera.position.distanceTo(controls.target);
    expect(dragged).toBeGreaterThan(radius);

    element.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    expect(camera.position.distanceTo(controls.target)).toBeLessThan(dragged);
  });

  it('freelooks on a right-drag: the eye turns but never moves', async () => {
    const { get, element } = await mount();
    const camera = get().camera;
    const position = camera.position.clone();
    const direction = viewDirection(camera);

    drag(element, 2, [100, 100], [180, 100]);

    expect(camera.position.distanceTo(position)).toBeLessThan(1e-6);
    expect(viewDirection(camera).distanceTo(direction)).toBeGreaterThan(0.01);
  });

  it('emulates the middle button on alt+left', async () => {
    const { get, element } = await mount();
    const camera = get().camera;
    const before = camera.position.clone();
    drag(element, 0, [100, 100], [180, 120], { altKey: true });
    expect(camera.position.distanceTo(before)).toBeGreaterThan(0.01);
  });

  it('leaves plain left-drag alone, so the viewport can select with it', async () => {
    const { get, element } = await mount();
    const camera = get().camera;
    const before = camera.position.clone();
    drag(element, 0, [100, 100], [180, 120]);
    expect(camera.position.distanceTo(before)).toBe(0);
  });

  it('suppresses the context menu so a right-drag can freelook', async () => {
    const { element } = await mount();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

/**
 * happy-dom's `WheelEvent` drops the MouseEvent modifier flags — they read back
 * `undefined` however the init is spelled — so the two the wheel bindings
 * depend on are defined onto the instance. `deltaX`/`deltaY` do survive.
 */
function wheelEvent(init: {
  deltaX?: number;
  deltaY: number;
  deltaMode?: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
}): WheelEvent {
  const event = new WheelEvent('wheel', {
    deltaX: init.deltaX ?? 0,
    deltaY: init.deltaY,
    deltaMode: init.deltaMode,
    cancelable: true,
  });
  Object.defineProperty(event, 'shiftKey', { value: init.shiftKey ?? false });
  Object.defineProperty(event, 'ctrlKey', { value: init.ctrlKey ?? false });
  return event;
}

describe('<GodotEditorControls> wheel navigation', () => {
  it('pans on shift+wheel — Godot’s pan-gesture modifier, for trackpads', async () => {
    const { get, controls, element } = await mount();
    const camera = get().camera;
    const cameraBefore = camera.position.clone();
    const radius = camera.position.distanceTo(controls.target);

    element.dispatchEvent(wheelEvent({ deltaY: 100, shiftKey: true }));

    const targetDelta = controls.target.clone();
    expect(targetDelta.length()).toBeGreaterThan(0);
    // A pan moves eye and focus together and leaves the radius untouched.
    expect(camera.position.clone().sub(cameraBefore).distanceTo(targetDelta)).toBeLessThan(1e-6);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(radius, 6);
  });

  it('reads BOTH axes on a shift+wheel pan', async () => {
    // With shift held on a mouse wheel, Chrome and Firefox deliver the notch on
    // deltaX; a handler reading only deltaY would silently do nothing.
    const { controls, element } = await mount();
    element.dispatchEvent(wheelEvent({ deltaX: 100, deltaY: 0, shiftKey: true }));
    expect(controls.target.length()).toBeGreaterThan(0);
  });

  it('still zooms on ctrl+wheel, which is how a browser reports a trackpad pinch', async () => {
    const { get, controls, element } = await mount();
    const camera = get().camera;
    const radius = camera.position.distanceTo(controls.target);

    element.dispatchEvent(wheelEvent({ deltaY: -100, ctrlKey: true }));

    expect(camera.position.distanceTo(controls.target)).toBeLessThan(radius);
    expect(controls.target.length()).toBe(0);
  });

  it('normalises line-mode deltas so Firefox zooms at Chrome’s rate', async () => {
    const pixels = await mount();
    const lines = await mount();
    pixels.element.dispatchEvent(wheelEvent({ deltaY: 100 }));
    lines.element.dispatchEvent(wheelEvent({ deltaY: 3, deltaMode: 1 }));
    expect(pixels.get().camera.position.distanceTo(pixels.controls.target)).toBeCloseTo(
      lines.get().camera.position.distanceTo(lines.controls.target),
      6
    );
  });
});

/** Drive touch pointers from `from` to `to`, one move each, then lift them. */
function touchDrag(
  element: HTMLCanvasElement,
  points: readonly { from: [number, number]; to: [number, number] }[]
): void {
  const common = { pointerType: 'touch', bubbles: true, cancelable: true, isPrimary: true };
  const fire = (type: string, index: number, at?: [number, number]) =>
    element.dispatchEvent(
      new PointerEvent(type, {
        ...common,
        pointerId: index + 1,
        clientX: at?.[0],
        clientY: at?.[1],
      })
    );

  points.forEach((point, index) => fire('pointerdown', index, point.from));
  // Every finger reports its start once, so the gesture has an origin before
  // any of them has moved — otherwise the first move reads as a jump.
  points.forEach((point, index) => fire('pointermove', index, point.from));
  points.forEach((point, index) => fire('pointermove', index, point.to));
  points.forEach((_point, index) => fire('pointerup', index));
}

describe('<GodotEditorControls> touch navigation', () => {
  it('orbits on a one-finger drag, keeping the focus point and the radius', async () => {
    const { get, controls, element } = await mount();
    const camera = get().camera;
    const before = camera.position.clone();
    const radius = before.distanceTo(controls.target);

    touchDrag(element, [{ from: [100, 100], to: [180, 120] }]);

    expect(camera.position.distanceTo(before)).toBeGreaterThan(0.01);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(radius, 6);
    expect(controls.target.length()).toBe(0);
  });

  it('pans on a two-finger drag that keeps the fingers the same distance apart', async () => {
    const { get, controls, element } = await mount();
    const camera = get().camera;
    const cameraBefore = camera.position.clone();
    const radius = camera.position.distanceTo(controls.target);

    touchDrag(element, [
      { from: [100, 100], to: [160, 100] },
      { from: [200, 100], to: [260, 100] },
    ]);

    const targetDelta = controls.target.clone();
    expect(targetDelta.length()).toBeGreaterThan(0);
    expect(camera.position.clone().sub(cameraBefore).distanceTo(targetDelta)).toBeLessThan(1e-6);
    // The span never changed, so the pinch rode along as a no-op.
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(radius, 6);
  });

  it('zooms in as two fingers spread, about an unmoved midpoint', async () => {
    const { get, controls, element } = await mount();
    const camera = get().camera;
    const radius = camera.position.distanceTo(controls.target);

    touchDrag(element, [
      { from: [140, 100], to: [100, 100] },
      { from: [160, 100], to: [200, 100] },
    ]);

    const zoomed = camera.position.distanceTo(controls.target);
    expect(zoomed).toBeLessThan(radius / 2);
    // The focus point barely moves, but not exactly not at all: a browser
    // fires one pointermove PER POINTER, so the fingers pass through states
    // where only one has moved and the midpoint is briefly off-centre. Those
    // opposite nudges do not quite cancel, because pan speed scales with the
    // orbit radius and the pinch is changing it in between.
    expect(controls.target.length()).toBeLessThan((radius - zoomed) / 10);
  });

  it('ignores three fingers rather than guessing at a gesture', async () => {
    const { get, element } = await mount();
    const camera = get().camera;
    const before = camera.position.clone();

    touchDrag(element, [
      { from: [100, 100], to: [160, 140] },
      { from: [200, 100], to: [260, 140] },
      { from: [300, 100], to: [360, 140] },
    ]);

    expect(camera.position.distanceTo(before)).toBe(0);
  });

  it('does not preventDefault a touch, so a tap still reaches viewport selection', async () => {
    const { element } = await mount();
    const event = new PointerEvent('pointerdown', {
      pointerType: 'touch',
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('<GodotEditorControls> keyboard', () => {
  it('snaps to the top view on Numpad 7 and to the bottom with Ctrl', async () => {
    const { get, controls } = await mount();
    const camera = get().camera;

    await pressKey('Numpad7');
    expect(camera.position.clone().sub(controls.target).normalize().y).toBeCloseTo(1, 6);

    await pressKey('Numpad7', { ctrlKey: true });
    expect(camera.position.clone().sub(controls.target).normalize().y).toBeCloseTo(-1, 6);
  });

  it('snaps to the front on Numpad 1 and the right on Numpad 3', async () => {
    const { get, controls } = await mount();
    const camera = get().camera;

    await pressKey('Numpad1');
    expect(camera.position.clone().sub(controls.target).normalize().z).toBeCloseTo(1, 6);

    await pressKey('Numpad3');
    expect(camera.position.clone().sub(controls.target).normalize().x).toBeCloseTo(1, 6);
  });

  it('toggles orthographic and back on Numpad 5, keeping the pose', async () => {
    const { get, controls } = await mount();
    const perspective = get().camera;
    if (!('isPerspectiveCamera' in perspective)) throw new Error('canvas is not perspective');
    const position = perspective.position.clone();

    await pressKey('Numpad5');
    const ortho = get().camera;
    if (!('isOrthographicCamera' in ortho)) throw new Error('camera did not switch projection');
    expect(ortho.position.distanceTo(position)).toBeLessThan(1e-6);
    expect(controls.isOrthographic).toBe(true);
    // The frustum is sized to what the perspective camera saw at the focus point.
    const expectedHeight =
      2 *
      position.distanceTo(controls.target) *
      Math.tan(((perspective.fov / 2) * Math.PI) / 180);
    expect(ortho.top - ortho.bottom).toBeCloseTo(expectedHeight, 6);

    await pressKey('Numpad5');
    expect(get().camera).toBe(perspective);
    expect(controls.isOrthographic).toBe(false);
  });

  it('ignores navigation keys typed into a text field', async () => {
    const { get } = await mount();
    const camera = get().camera;
    const before = camera.position.clone();
    const input = document.createElement('input');
    document.body.appendChild(input);

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Numpad7', bubbles: true }));
    });

    expect(camera.position.distanceTo(before)).toBe(0);
    input.remove();
  });

  it('flies with W only while a right-drag freelook is held', async () => {
    const { renderer, get, element } = await mount();
    const camera = get().camera;
    const before = camera.position.clone();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    await renderer.advanceFrames(2, 16);
    expect(camera.position.distanceTo(before)).toBe(0);

    element.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, button: 2, clientX: 0, clientY: 0 })
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    await renderer.advanceFrames(2, 16);
    const flown = camera.position.distanceTo(before);
    expect(flown).toBeGreaterThan(0);

    // Releasing the button ends freelook and drops every held key with it.
    element.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, button: 2 }));
    const afterRelease = camera.position.clone();
    await renderer.advanceFrames(2, 16);
    expect(camera.position.distanceTo(afterRelease)).toBe(0);
  });
});

/** Fly forward for two frames and report how far the camera travelled. */
async function flyForward(shiftKey: boolean): Promise<number> {
  const { renderer, get, element } = await mount();
  const camera = get().camera;
  const before = camera.position.clone();
  if (shiftKey) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', shiftKey }));
  element.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, button: 2, clientX: 0, clientY: 0 })
  );
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', shiftKey }));
  await renderer.advanceFrames(2, 16);
  return camera.position.distanceTo(before);
}

describe('<GodotEditorControls> freelook sprint', () => {
  it('sprints on Shift, including when Shift went down before freelook started', async () => {
    const walked = await flyForward(false);
    const sprinted = await flyForward(true);
    expect(walked).toBeGreaterThan(0);
    expect(sprinted).toBeCloseTo(walked * 3, 6);
  });
});

describe('EditorControlsHandle framing contract', () => {
  it('re-aims at a target written from outside without moving the camera', async () => {
    const { get, controls } = await mount();
    const camera = get().camera;
    // What `frameSceneBounds` does: write both, then call update().
    camera.position.set(0, 10, 10);
    controls.target.set(2, 0, -3);
    controls.update();

    expect(camera.position.distanceTo(new THREE.Vector3(0, 10, 10))).toBeLessThan(1e-9);
    const toTarget = controls.target.clone().sub(camera.position).normalize();
    expect(viewDirection(camera).distanceTo(toTarget)).toBeLessThan(1e-6);
  });

  it('orbits around an externally written target rather than the old one', async () => {
    const { get, controls, element } = await mount();
    const camera = get().camera;
    camera.position.set(10, 0, 10);
    controls.target.set(10, 0, 0);
    controls.update();

    drag(element, 1, [100, 100], [160, 100]);

    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(10, 6);
    expect(controls.target.distanceTo(new THREE.Vector3(10, 0, 0))).toBe(0);
  });

  it('reset() returns to the pose Godot opens every scene at', async () => {
    const { get, controls, element } = await mount();
    const camera = get().camera;
    drag(element, 1, [100, 100], [220, 160]);
    controls.target.set(4, 4, 4);

    controls.reset();

    expect(camera.position.distanceTo(new THREE.Vector3(...editorCameraPosition()))).toBeLessThan(
      1e-6
    );
    expect(controls.target.length()).toBe(0);
  });

  it('reset() leaves orthographic mode as well as the pose', async () => {
    const { get, controls } = await mount();
    const perspective = get().camera;
    await pressKey('Numpad5');
    expect(controls.isOrthographic).toBe(true);

    await act(async () => {
      controls.reset();
    });

    expect(get().camera).toBe(perspective);
    expect(controls.isOrthographic).toBe(false);
  });
});
