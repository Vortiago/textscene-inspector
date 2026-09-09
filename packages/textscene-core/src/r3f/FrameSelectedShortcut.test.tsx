/**
 * FrameSelectedShortcut (F-to-frame) — pressing "F" frames the camera
 * on the selected node (via resolveFrameTarget + the already-tested
 * frameSceneBounds); with nothing selected it frames the whole scene.
 * Guarded by isTypingTarget so it doesn't hijack "f" from a text field.
 *
 * frameSceneBounds' own math (near-plane, distance, isometric angle) is
 * pinned in TscnCanvas.test.tsx; this file only proves the NEW wiring: the
 * keydown listener resolves the right target and actually moves the camera.
 */
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SelectionProvider, useSelection } from './contexts/SelectionContext';
import { CameraControlProvider, useCameraControl } from './contexts/CameraControlContext';
import { FrameSelectedShortcut } from './FrameSelectedShortcut';

let camera: THREE.Camera;
function CameraCapture() {
  camera = useThree((s) => s.camera);
  return null;
}

/** Registers a real mesh at `path` and adds it to the scene via <primitive>. */
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

function Seeder({ selectedPath }: { selectedPath: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(selectedPath);
  }, [selectedPath, setSelectedNodePath]);
  return null;
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
        <Seeder selectedPath="Far" />
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
        <Seeder selectedPath={null} />
        <FrameSelectedShortcut />
      </SelectionProvider>
    );

    await renderer.advanceFrames(1, 0);
    fireF();
    await renderer.advanceFrames(1, 0);

    // Framing both meshes together centres on their midpoint (x=40) rather
    // than "Far"'s own x=80 — but the union's much larger extent (81 units
    // vs "Far"'s single 1-unit box) pulls the camera back much farther along
    // Godot's oblique editor-orbit direction, which has its own +X component,
    // so the resulting x does not land near the x=40 midpoint itself. What
    // distinguishes this from the single-selection case is that it is
    // measurably CLOSER to that midpoint than "Far"'s own ~80.4 (the previous
    // test's assertion), never at or past it.
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
        <Seeder selectedPath="Near" />
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
    // Same guard as CameraFit: with "Use This Camera" active, state.camera IS
    // the authored Camera3D node's camera — framing would overwrite its
    // position/near/far and corrupt the authored preview.
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
          <Seeder selectedPath="Far" />
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
        <Seeder selectedPath="Near" />
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
