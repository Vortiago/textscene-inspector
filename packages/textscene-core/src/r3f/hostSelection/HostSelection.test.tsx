import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { HostSelection, type HostSelectionProps } from './HostSelection';
import { CLICK_TRAVEL_PX, useViewportSelection } from '../hooks/useViewportSelection';
import { clickWith, LEFT, RIGHT } from '../hooks/viewportClicks.testkit';
import { useSelectedNodePath, useSelection } from '../contexts/SelectionContext';
import { CanvasWorkspaceProvider, type CanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { TscnSceneContents } from '../SceneContents';
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
  return renderHook(
    () => ({ picker: useViewportSelection(), selection: useSelection(), selected: useSelectedNodePath() }),
    { wrapper }
  );
}

type Setup = ReturnType<typeof setup>;

function registeredAt({ result }: Setup, path: string): THREE.Object3D {
  const object = new THREE.Object3D();
  act(() => result.current.selection.registerNodeObject(path, object));
  return object;
}

function click({ result }: Setup, on: THREE.Object3D, button = LEFT) {
  act(() => clickWith(result.current.picker.handlers, { on, button }));
}

function clickOnNothing({ result }: Setup, button = LEFT) {
  act(() => clickWith(result.current.picker.handlers, { on: null, button }));
}

describe('the host’s click picking', () => {
  it('calls onSelect with the handle of the node a click picks', () => {
    const scene = openTestScene();
    const onSelect = vi.fn();
    const view = setup(scene, { onSelect });

    click(view, registeredAt(view, 'Root/Cube'));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(scene.getNode('Cube'));
  });

  it('picks nothing on a press and release of the right button, which looks around', () => {
    const onSelect = vi.fn();
    const view = setup(openTestScene(), { onSelect });

    click(view, registeredAt(view, 'Root/Cube'), RIGHT);

    expect(onSelect).not.toHaveBeenCalled();
    expect(view.result.current.selected).toBeNull();
  });

  it('gives the host the nearest node of a path the scene lacks, such as a mesh inside a GLB', () => {
    const scene = openTestScene();
    const onSelect = vi.fn();
    const view = setup(scene, { onSelect });

    click(view, registeredAt(view, 'Root/Cube/Armature/Body'));

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

    expect(view.result.current.selected).toBeNull();
  });

  it('keeps the selection through a right click on nothing', () => {
    const view = setup(openTestScene(), {});
    click(view, registeredAt(view, 'Root/Cube'));

    clickOnNothing(view, RIGHT);

    expect(view.result.current.selected).toBe('Root/Cube');
  });

  it('hears no pick when a drag that starts on nothing ends on a node', () => {
    const onSelect = vi.fn();
    const view = setup(openTestScene(), { onSelect });

    act(() =>
      clickWith(view.result.current.picker.handlers, {
        on: registeredAt(view, 'Root/Cube'),
        travel: CLICK_TRAVEL_PX + 1,
      })
    );

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('outlines the picked node when the host passes no selected', () => {
    const view = setup(openTestScene(), { onSelect: () => {} });

    click(view, registeredAt(view, 'Root/Cube'));

    expect(view.result.current.selected).toBe('Root/Cube');
  });

  it('keeps the host’s selected node through a click on another', () => {
    const scene = openTestScene();
    const onSelect = vi.fn();
    const view = setup(scene, { selected: scene.getNode('Other'), onSelect });

    click(view, registeredAt(view, 'Root/Cube'));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(scene.getNode('Cube'));
    expect(view.result.current.selected).toBe('Root/Other');
  });

  it('selects the node the host passes', () => {
    const scene = openTestScene();

    const view = setup(scene, { selected: scene.getNode('Cube') });

    expect(view.result.current.selected).toBe('Root/Cube');
  });

  it('outlines nothing for the root window, which the canvas does not draw', () => {
    const scene = openTestScene();

    const view = setup(scene, { selected: scene.getNode('/root') });

    expect(view.result.current.selected).toBeNull();
  });

  it('keeps nothing selected through a click when the host passes null', () => {
    const view = setup(openTestScene(), { selected: null });

    click(view, registeredAt(view, 'Root/Cube'));

    expect(view.result.current.selected).toBeNull();
  });

  it('keeps the selection through a click in the 2D workspace, which picks no node yet', () => {
    const view = setup(openTestScene(), {}, '2d');
    click(view, registeredAt(view, 'Root/Cube'));

    clickOnNothing(view);

    expect(view.result.current.selected).toBe('Root/Cube');
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
