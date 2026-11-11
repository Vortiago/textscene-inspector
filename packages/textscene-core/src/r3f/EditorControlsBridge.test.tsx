/**
 * `<EditorControlsBridge>` gives the shell outside the canvas the reset and the freelook of the
 * canvas's navigation handle.
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext';
import { EditorControlsBridge } from './EditorControlsBridge';
import { GodotEditorControls } from './GodotEditorControls';
import { editorCameraPosition } from './godotEditorCamera';
import { holdsPointerLock } from './pointerLock';
import { installFakePointerLock } from './testing/fakePointerLock';
import { r3fStateProbe } from './testing/R3FStateProbe';
import { viewportActionsProbe } from './testing/ViewportActionsProbe';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** Written by `mountBridgedControls`, run and cleared after each test. */
let unmount: (() => Promise<void>) | null = null;

afterEach(async () => {
  await unmount?.();
  unmount = null;
});

async function mountBridgedControls() {
  const canvas = r3fStateProbe();
  const shell = viewportActionsProbe();
  const renderer: Renderer = await ReactThreeTestRenderer.create(
    <ViewportActionsProvider>
      <canvas.Probe />
      <shell.Probe />
      <GodotEditorControls />
      <EditorControlsBridge />
    </ViewportActionsProvider>
  );
  const element = canvas.state().gl.domElement;
  const removeFakePointerLock = installFakePointerLock(element);
  unmount = async () => {
    await act(async () => renderer.unmount());
    removeFakePointerLock();
  };
  return { get: canvas.state, actions: shell.actions, element };
}

describe('<EditorControlsBridge>', () => {
  it('starts the canvas’s freelook from the shell’s toggle', async () => {
    const { actions, element } = await mountBridgedControls();

    await act(async () => actions().toggleFreelook());

    expect(holdsPointerLock(element)).toBe(true);
    expect(actions().freelookState()?.isToggled).toBe(true);
  });

  it('gives the shell no freelook once the canvas unmounts', async () => {
    const { actions } = await mountBridgedControls();

    await unmount?.();

    expect(actions().freelookState()).toBeNull();
  });

  it('returns the camera to its opening pose on the shell’s reset', async () => {
    const { get, actions } = await mountBridgedControls();
    get().camera.position.set(9, 9, 9);

    await act(async () => actions().resetCamera());

    expect(get().camera.position.toArray()).toEqual(editorCameraPosition());
  });
});
