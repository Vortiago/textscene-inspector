/**
 * `<EditorControlsBridge>` gives the shell outside the canvas the reset and the freelook of the
 * canvas's navigation handle.
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext';
import { EditorControlsBridge } from './EditorControlsBridge';
import { GodotEditorControls } from './GodotEditorControls';
import { pressKey } from './GodotEditorControls.testkit';
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
  const sceneAt = (scenePath: string) => (
    <HierarchyProvider
      value={{ sceneGraph: createSceneGraphFromTscnScene({ nodes: [] }, scenePath), panelId: 'panel' }}
    >
      <ViewportActionsProvider>
        <canvas.Probe />
        <shell.Probe />
        <GodotEditorControls />
        <EditorControlsBridge />
      </ViewportActionsProvider>
    </HierarchyProvider>
  );
  const renderer: Renderer = await ReactThreeTestRenderer.create(sceneAt('res://first.tscn'));
  const openScene = (scenePath: string) => act(async () => renderer.update(sceneAt(scenePath)));
  const element = canvas.state().gl.domElement;
  const removeFakePointerLock = installFakePointerLock(element);
  unmount = async () => {
    await act(async () => renderer.unmount());
    removeFakePointerLock();
  };
  return { get: canvas.state, actions: shell.actions, element, openScene };
}

describe('<EditorControlsBridge>', () => {
  it('starts the canvas’s freelook from the shell’s toggle', async () => {
    const { actions, element } = await mountBridgedControls();

    await act(async () => actions().toggleFreelook());

    expect(holdsPointerLock(element)).toBe(true);
    expect(actions().freelookState()?.isToggled).toBe(true);
  });

  it('tells the shell that orthographic view has no freelook', async () => {
    const { actions } = await mountBridgedControls();

    await pressKey('Numpad5');

    expect(actions().freelookState()?.isAvailable).toBe(false);
  });

  it('ends the toggle on the shell’s reset', async () => {
    const { actions, element } = await mountBridgedControls();
    await act(async () => actions().toggleFreelook());

    await act(async () => actions().resetCamera());

    expect(holdsPointerLock(element)).toBe(false);
  });

  it('ends the toggle when another scene opens', async () => {
    const { actions, element, openScene } = await mountBridgedControls();
    await act(async () => actions().toggleFreelook());

    await openScene('res://second.tscn');

    expect(holdsPointerLock(element)).toBe(false);
  });

  it('keeps the toggle through a reload of the same scene', async () => {
    const { actions, element, openScene } = await mountBridgedControls();
    await act(async () => actions().toggleFreelook());

    await openScene('res://first.tscn');

    expect(holdsPointerLock(element)).toBe(true);
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
