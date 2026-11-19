import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { HostSelection, type HostSelectionProps } from './HostSelection';
import { useViewportSelection } from '../hooks/useViewportSelection';
import { useSelection } from '../contexts/SelectionContext';
import { CanvasWorkspaceProvider, type CanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { TscnSceneContents } from '../TscnCanvas';
import { openScene, type Scene } from '../../scene/openScene';
import type { ResourceProvider } from '../../resources/ResourceProvider';

import '../nodes/index';

const NO_FILES: ResourceProvider = { loadResource: async () => null };
const SCENE = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")

[node name="Other" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`;

const openTestScene = () => openScene({ source: SCENE, provider: NO_FILES });

/** The picker and the selection of a view of `scene`, as `TscnCanvas` mounts them. */
function setup(scene: Scene, host: HostSelectionProps, workspace: CanvasWorkspace = '3d') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TscnSceneProvider scene={scene}>
      <HostSelection {...host}>
        <CanvasWorkspaceProvider workspace={workspace}>{children}</CanvasWorkspaceProvider>
      </HostSelection>
    </TscnSceneProvider>
  );
  return renderHook(() => ({ picker: useViewportSelection(), selection: useSelection() }), { wrapper });
}

type Setup = ReturnType<typeof setup>;

function registeredAt({ result }: Setup, path: string): THREE.Object3D {
  const object = new THREE.Object3D();
  act(() => result.current.selection.registerNodeObject(path, object));
  return object;
}

function click({ result }: Setup, object: THREE.Object3D) {
  const event = { clientX: 10, clientY: 10, object, stopPropagation: () => {} };
  act(() => {
    result.current.picker.handlers.onPointerDown(event as never);
    result.current.picker.handlers.onPointerUp(event as never);
  });
}

function missOf({ result }: Setup, type: 'click' | 'contextmenu' | 'pointerup') {
  act(() => result.current.picker.handlers.onPointerMissed?.(new MouseEvent(type)));
}

const clickOnNothing = (view: Setup) => missOf(view, 'click');

describe('the host’s click picking', () => {
  it('calls onSelect with the handle of the node a click picks', () => {
    const scene = openTestScene();
    const onSelect = vi.fn();
    const view = setup(scene, { onSelect });

    click(view, registeredAt(view, 'Root/Cube'));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(scene.getNode('Cube'));
  });

  it('calls onSelect with null for a click on nothing', () => {
    const onSelect = vi.fn();
    const view = setup(openTestScene(), { onSelect });

    clickOnNothing(view);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('clears the view’s own selection on a click on nothing, as the 3D editor does', () => {
    const view = setup(openTestScene(), {});
    click(view, registeredAt(view, 'Root/Cube'));

    clickOnNothing(view);

    expect(view.result.current.selection.selectedNodePath).toBeNull();
  });

  it('keeps the selection through a right click on nothing', () => {
    const view = setup(openTestScene(), {});
    click(view, registeredAt(view, 'Root/Cube'));

    missOf(view, 'contextmenu');

    expect(view.result.current.selection.selectedNodePath).toBe('Root/Cube');
  });

  it('hears no pick when a drag that starts on nothing ends on a node', () => {
    const onSelect = vi.fn();
    const view = setup(openTestScene(), { onSelect });

    missOf(view, 'pointerup');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('outlines the picked node when the host passes no selected', () => {
    const view = setup(openTestScene(), { onSelect: () => {} });

    click(view, registeredAt(view, 'Root/Cube'));

    expect(view.result.current.selection.selectedNodePath).toBe('Root/Cube');
  });

  it('keeps the host’s selected node through a click on another', () => {
    const scene = openTestScene();
    const onSelect = vi.fn();
    const view = setup(scene, { selected: scene.getNode('Other'), onSelect });

    click(view, registeredAt(view, 'Root/Cube'));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(scene.getNode('Cube'));
    expect(view.result.current.selection.selectedNodePath).toBe('Root/Other');
  });

  it('selects the node the host passes', () => {
    const scene = openTestScene();

    const view = setup(scene, { selected: scene.getNode('Cube') });

    expect(view.result.current.selection.selectedNodePath).toBe('Root/Cube');
  });

  it('keeps nothing selected through a click when the host passes null', () => {
    const view = setup(openTestScene(), { selected: null });

    click(view, registeredAt(view, 'Root/Cube'));

    expect(view.result.current.selection.selectedNodePath).toBeNull();
  });

  it('keeps the selection through a click in the 2D workspace, which picks no node yet', () => {
    const view = setup(openTestScene(), {}, '2d');
    click(view, registeredAt(view, 'Root/Cube'));

    clickOnNothing(view);

    expect(view.result.current.selection.selectedNodePath).toBe('Root/Cube');
  });
});

function boxHelperIn(scene: THREE.Object3D): THREE.BoxHelper | null {
  let found: THREE.BoxHelper | null = null;
  scene.traverse((object) => {
    if (object instanceof THREE.BoxHelper) found ??= object;
  });
  return found;
}

describe('the host’s selected node', () => {
  it('outlines the node with no click', async () => {
    const scene = openTestScene();

    const renderer = await ReactThreeTestRenderer.create(
      <TscnSceneProvider scene={scene}>
        <HostSelection selected={scene.getNode('Cube')}>
          <TscnSceneContents />
        </HostSelection>
      </TscnSceneProvider>
    );

    await vi.waitFor(() =>
      expect(boxHelperIn(renderer.scene.instance as unknown as THREE.Scene)).not.toBeNull()
    );
  });
});
