/**
 * "F" frames the selected node through resolveFrameTarget and frameSceneBounds, or the
 * whole scene without a selection, and isTypingTarget keeps "f" in a text field.
 * frameSceneBounds' maths is pinned in TscnCanvas.test.tsx. This proves the wiring.
 */
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SelectionProvider, useSelection } from './contexts/SelectionContext';
import { CameraControlProvider, useCameraControl } from './contexts/CameraControlContext';
import { FrameSelectedShortcut } from './FrameSelectedShortcut';
import { SelectSeeder } from './testing/SelectSeeder';

let camera: THREE.Camera;
function CameraCapture() {
  camera = useThree((s) => s.camera);
  return null;
}

/** Registers a real mesh at `path` and adds it to the scene through <primitive>. */
function RegisteredMesh({
  path,
  position,
}: {
  path: string;
  position: [number, number, number];
}) {
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

function fireF() {
  globalThis.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
}

describe('<FrameSelectedShortcut> (#224)', () => {
  it('frames the SELECTED node, not the whole scene', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <CameraCapture />
        <RegisteredMesh path="Near" position={[0, 0, 0]} />
        <RegisteredMesh path="Far" position={[80, 0, 0]} />
        <SelectSeeder path="Far" />
        <FrameSelectedShortcut />
      </SelectionProvider>
    );

    await renderer.advanceFrames(1, 0);
    fireF();
    await renderer.advanceFrames(1, 0);

    // Framing "Far" alone centres the camera near x=80, not the x=40
    // midpoint framing BOTH meshes together would produce.
    expect(camera.position.x).toBeGreaterThan(60);
  });

  it('frames the WHOLE scene when nothing is selected', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <CameraCapture />
        <RegisteredMesh path="Near" position={[0, 0, 0]} />
        <RegisteredMesh path="Far" position={[80, 0, 0]} />
        <SelectSeeder path={null} />
        <FrameSelectedShortcut />
      </SelectionProvider>
    );

    await renderer.advanceFrames(1, 0);
    fireF();
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
        <FrameSelectedShortcut />
      </SelectionProvider>
    );
    await renderer.advanceFrames(1, 0);
    const before = camera.position.clone();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    await renderer.advanceFrames(1, 0);

    expect(camera.position.equals(before)).toBe(true);
    globalThis.document.body.removeChild(input);
  });

  it('does nothing while an authored Camera3D is the active camera (never mutates it)', async () => {
    // The CameraFit guard: under "Use This Camera", state.camera is the authored
    // Camera3D, and framing would overwrite its position, near and far.
    function ActivateAuthoredCamera() {
      const { switchToCamera } = useCameraControl();
      useEffect(() => {
        switchToCamera('Root/Camera3D');
      }, [switchToCamera]);
      return null;
    }
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <CameraControlProvider>
          <CameraCapture />
          <RegisteredMesh path="Far" position={[80, 0, 0]} />
          <SelectSeeder path="Far" />
          <ActivateAuthoredCamera />
          <FrameSelectedShortcut />
        </CameraControlProvider>
      </SelectionProvider>
    );
    await renderer.advanceFrames(1, 0);
    const before = camera.position.clone();

    fireF();
    await renderer.advanceFrames(1, 0);

    expect(camera.position.equals(before)).toBe(true);
  });

  it('ignores keys other than "f"', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <CameraCapture />
        <RegisteredMesh path="Near" position={[0, 0, 0]} />
        <SelectSeeder path="Near" />
        <FrameSelectedShortcut />
      </SelectionProvider>
    );
    await renderer.advanceFrames(1, 0);
    const before = camera.position.clone();

    globalThis.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    await renderer.advanceFrames(1, 0);

    expect(camera.position.equals(before)).toBe(true);
  });
});
