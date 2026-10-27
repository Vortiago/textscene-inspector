/**
 * The billboard icon of a node, mounted by the dispatcher inside the node's own group: where it
 * draws, that a click on its square selects the node, and that it moves no frame or box.
 * A click is a ray through the viewport that meets the icon quad, then the pointer-up handler
 * of the delegated root group, as R3F calls it.
 */

import { useThree } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { useSelection } from './contexts/SelectionContext';
import { isNodeIcon } from './editorHelpers';
import { NodeDispatcher } from './NodeDispatcher';
import { InWorld } from './testing/InWorld';
import { SceneStack } from './testing/SceneStack';

import './nodes/index';

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Cam" type="Camera3D" parent="."]

[node name="Hidden" type="Camera3D" parent="."]
visible = false

[node name="Plain" type="Node3D" parent="."]
`;

interface Probe {
  camera: THREE.Camera | null;
  selectedPath: string | null;
}

async function renderScene(options: { showGizmos?: boolean } = {}) {
  const probe: Probe = { camera: null, selectedPath: null };
  function Observer() {
    probe.camera = useThree((state) => state.camera);
    probe.selectedPath = useSelection().selectedNodePath;
    return null;
  }
  const scene = new TscnParser().parse(SCENE);
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack scene={scene} loader={createFakeResourceLoader().loader} showGizmos={options.showGizmos}>
      <Observer />
      <InWorld>
        <NodeDispatcher nodes={scene.nodes} />
      </InWorld>
    </SceneStack>
  );
  await renderer.advanceFrames(1, 16);
  return { renderer, probe };
}

/** The icon quads of the scene, with the name of the nearest named group above each. */
function icons(renderer: Awaited<ReturnType<typeof renderScene>>['renderer']) {
  return renderer.scene
    .findAllByType('Mesh')
    .map((mesh) => mesh.instance as THREE.Mesh)
    .filter(isNodeIcon)
    .map((mesh) => {
      let group: THREE.Object3D | null = mesh.parent;
      while (group && group.name === '') group = group.parent;
      return { mesh, nodeName: group?.name };
    });
}

/** The first hit of a ray through `ndc` on `mesh`, as the object R3F reports to the pointer handlers. */
function hitThrough(probe: Probe, mesh: THREE.Mesh, ndc: [number, number]): THREE.Object3D | null {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(...ndc), probe.camera!);
  return raycaster.intersectObject(mesh)[0]?.object ?? null;
}

async function click(renderer: Awaited<ReturnType<typeof renderScene>>['renderer'], object: THREE.Object3D) {
  const root = renderer.scene.find((instance) => typeof instance.props.onPointerUp === 'function');
  const at = { clientX: 10, clientY: 10, object };
  await renderer.fireEvent(root, 'onPointerDown', at);
  await renderer.fireEvent(root, 'onPointerUp', at);
}

describe('NodeDispatcher: node icons', () => {
  it('mounts the icon of a Camera3D in its own group', async () => {
    const { renderer } = await renderScene();
    expect(icons(renderer).map(({ nodeName }) => nodeName)).toContain('Cam');
  });

  it('mounts no icon for a node whose type registers none', async () => {
    const { renderer } = await renderScene();
    expect(icons(renderer).map(({ nodeName }) => nodeName)).not.toContain('Plain');
  });

  it('hides the icon of a node that is not visible, with its group', async () => {
    const { renderer } = await renderScene();
    const hidden = icons(renderer).find(({ nodeName }) => nodeName === 'Hidden')!;
    let visible = true;
    hidden.mesh.traverseAncestors((ancestor) => (visible &&= ancestor.visible));
    expect(visible).toBe(false);
  });

  it('selects the node when a click lands inside the icon square', async () => {
    const { renderer, probe } = await renderScene();
    const { mesh } = icons(renderer).find(({ nodeName }) => nodeName === 'Cam')!;
    await click(renderer, hitThrough(probe, mesh, [0.01, 0.01])!);
    expect(probe.selectedPath).toBe('Root/Cam');
  });

  it('misses the icon outside its square', async () => {
    const { renderer, probe } = await renderScene();
    const { mesh } = icons(renderer).find(({ nodeName }) => nodeName === 'Cam')!;
    expect(hitThrough(probe, mesh, [0.3, 0.3])).toBeNull();
  });

  it('mounts no icon, so no click target, with the Gizmos toggle off', async () => {
    const { renderer } = await renderScene({ showGizmos: false });
    expect(icons(renderer)).toHaveLength(0);
  });
});
