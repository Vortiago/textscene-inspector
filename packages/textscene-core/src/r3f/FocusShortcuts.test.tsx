import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SelectionProvider, useSelection } from './contexts/SelectionContext';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext';
import { GodotEditorControls } from './GodotEditorControls';
import { EditorControlsHandle } from './EditorControlsHandle';
import { FocusShortcuts } from './FocusShortcuts';
import { SelectSeeder } from './testing/SelectSeeder';

let camera: THREE.Camera;
let view: HTMLCanvasElement;
let controls: unknown;
function CameraCapture() {
  camera = useThree((s) => s.camera);
  view = useThree((s) => s.gl.domElement);
  controls = useThree((s) => s.controls);
  return null;
}

/** Registers a real mesh at `path` and adds it to the scene through <primitive>. */
function RegisteredMesh({ path, position }: { path: string; position: [number, number, number] }) {
  const { registerNodeObject, unregisterNodeObject } = useSelection();
  const [mesh] = useState(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    m.position.set(...position);
    return m;
  });

  useEffect(() => {
    registerNodeObject(path, mesh);
    return () => unregisterNodeObject(path);
  }, [path, mesh, registerNodeObject, unregisterNodeObject]);

  return <primitive object={mesh} />;
}

/** A key pressed while the view holds focus. */
function press(key: string) {
  view.dispatchEvent(new KeyboardEvent('keydown', { code: `Key${key.toUpperCase()}`, key, bubbles: true }));
}

/** Makes `camera` the one R3F renders, as previewing a Camera3D does. */
function PreviewCamera({ camera }: { camera: THREE.PerspectiveCamera }) {
  const set = useThree((s) => s.set);
  useEffect(() => set({ camera }), [set, camera]);
  return null;
}

describe('<FocusShortcuts> F', () => {
  it('frames the SELECTED node, not the whole scene', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <CameraCapture />
        <RegisteredMesh path="Near" position={[0, 0, 0]} />
        <RegisteredMesh path="Far" position={[80, 0, 0]} />
        <SelectSeeder path="Far" />
        <FocusShortcuts />
      </SelectionProvider>
    );

    await renderer.advanceFrames(1, 0);
    press('f');
    await renderer.advanceFrames(1, 0);

    // Framing "Far" alone centres the camera near x=80, not the x=40
    // midpoint framing BOTH meshes together would produce.
    expect(camera.position.x).toBeGreaterThan(60);
  });

  it('hears no F that reaches the page outside the view', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <CameraCapture />
        <RegisteredMesh path="Far" position={[80, 0, 0]} />
        <SelectSeeder path="Far" />
        <FocusShortcuts />
      </SelectionProvider>
    );
    await renderer.advanceFrames(1, 0);
    const before = camera.position.clone();

    globalThis.document.body.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true })
    );
    await renderer.advanceFrames(1, 0);

    expect(camera.position.equals(before)).toBe(true);
  });

  it('frames the WHOLE scene when nothing is selected', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <CameraCapture />
        <RegisteredMesh path="Near" position={[0, 0, 0]} />
        <RegisteredMesh path="Far" position={[80, 0, 0]} />
        <SelectSeeder path={null} />
        <FocusShortcuts />
      </SelectionProvider>
    );

    await renderer.advanceFrames(1, 0);
    press('f');
    await renderer.advanceFrames(1, 0);

    // Both meshes centre on x=40, but their 81-unit extent pulls the camera far back
    // along the oblique orbit direction, which has a +X component. So x lands closer
    // to 40 than the single selection's 80.4, not at it.
    expect(camera.position.x).toBeGreaterThan(50);
    expect(camera.position.x).toBeLessThan(80);
  });

  it('does nothing when "f" fires while a text input has focus', async () => {
    const input = globalThis.document.createElement('input');
    globalThis.document.body.appendChild(input);

    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <CameraCapture />
        <RegisteredMesh path="Near" position={[0, 0, 0]} />
        <SelectSeeder path="Near" />
        <FocusShortcuts />
      </SelectionProvider>
    );
    await renderer.advanceFrames(1, 0);
    const before = camera.position.clone();

    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true }));
    await renderer.advanceFrames(1, 0);

    expect(camera.position.equals(before)).toBe(true);
    globalThis.document.body.removeChild(input);
  });

  it('does nothing while a Camera3D is previewed (never mutates it)', async () => {
    // Under a camera preview, state.camera is the authored Camera3D, and framing would
    // overwrite its position, near and far.
    const authored = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    authored.position.set(3, 1, 2);
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <GodotEditorControls />
        <RegisteredMesh path="Far" position={[80, 0, 0]} />
        <SelectSeeder path="Far" />
        <PreviewCamera camera={authored} />
        <FocusShortcuts />
      </SelectionProvider>
    );
    await renderer.advanceFrames(1, 0);

    press('f');
    await renderer.advanceFrames(1, 0);

    expect(authored.position.toArray()).toEqual([3, 1, 2]);
  });

  // A `?camera=` path whose Camera3D never mounts leaves the editor camera on screen.
  it('frames the editor camera while a previewed path names no mounted camera', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <ViewportActionsProvider initialPreviewedCameraPath="Root/Missing">
          <CameraCapture />
          <GodotEditorControls />
          <RegisteredMesh path="Far" position={[80, 0, 0]} />
          <SelectSeeder path="Far" />
          <FocusShortcuts />
        </ViewportActionsProvider>
      </SelectionProvider>
    );
    await renderer.advanceFrames(1, 0);
    const before = camera.position.clone();

    press('f');
    await renderer.advanceFrames(1, 0);

    expect(camera.position.equals(before)).toBe(false);
  });

  it('ignores keys other than "f"', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <CameraCapture />
        <RegisteredMesh path="Near" position={[0, 0, 0]} />
        <SelectSeeder path="Near" />
        <FocusShortcuts />
      </SelectionProvider>
    );
    await renderer.advanceFrames(1, 0);
    const before = camera.position.clone();

    press('g');
    await renderer.advanceFrames(1, 0);

    expect(camera.position.equals(before)).toBe(true);
  });
});

describe('<FocusShortcuts> O', () => {
  const authored = new THREE.PerspectiveCamera(75, 1, 0.1, 100);

  async function mountOrbit({ isPreviewing = false } = {}) {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <CameraCapture />
        <GodotEditorControls />
        {isPreviewing && <PreviewCamera camera={authored} />}
        <FocusShortcuts />
      </SelectionProvider>
    );
    await renderer.advanceFrames(1, 0);
    if (!(controls instanceof EditorControlsHandle))
      throw new Error('expected the editor controls, got none');
    controls.applyCursor({ ...controls.cursor(), target: new THREE.Vector3(5, 2, -3) });
    return { renderer, handle: controls };
  }

  it('puts the focus point at the origin and keeps the angles and the distance', async () => {
    const { renderer, handle } = await mountOrbit();
    const before = handle.cursor();

    press('o');
    await renderer.advanceFrames(1, 0);

    const after = handle.cursor();
    expect(after.target.toArray()).toEqual([0, 0, 0]);
    expect(after.distance).toBeCloseTo(before.distance, 6);
    expect(after.xRot).toBeCloseTo(before.xRot, 6);
    expect(after.yRot).toBeCloseTo(before.yRot, 6);
  });

  it('does nothing while a Camera3D is previewed', async () => {
    const { renderer, handle } = await mountOrbit({ isPreviewing: true });

    press('o');
    await renderer.advanceFrames(1, 0);

    expect(handle.cursor().target.toArray()).toEqual([5, 2, -3]);
  });
});
