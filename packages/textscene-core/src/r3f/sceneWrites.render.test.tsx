import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ResourceProvider } from '../resources/ResourceProvider';
import { TscnSceneProvider } from './TscnSceneProvider';
import { TscnSceneContents } from './TscnCanvas';
import { useHierarchy } from './contexts/HierarchyContext';
import { useLiveNode } from './useLiveSceneTree';
import { openScene, type Scene } from '../scene/openScene';
import { variant } from '../scene/variant';
import { useBuildSolveTree } from './controls/native/buildSolveTree';
import { createSolveContext, solveControlTree } from './controls/native/controlRectSolver';
import { nativeTheme } from './controls/native/nativeTheme';
import type { Rect2 } from '../godot/math/rect2';
import './nodes/index';
import './controls/index';

const provider: ResourceProvider = { loadResource: async () => null };

const BOX_SCENE = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")

[node name="Hud" type="Control" parent="."]

[node name="Score" type="Label" parent="Hud"]

[node name="Sprite" type="Node2D" parent="."]

[node name="Plain" type="Node" parent="."]
`;

const SUB_SCENE = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Enemy" type="Node3D"]

[node name="Body" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`;

const WITH_INSTANCE = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Enemy" parent="." instance=ExtResource("1")]
`;

const boxScene = () => openScene({ source: BOX_SCENE, provider, rootScenePath: 'res://main.tscn' });

async function drawn(scene: Scene) {
  return ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      <TscnSceneContents />
    </TscnSceneProvider>
  );
}

function cubeOf(renderer: Awaited<ReturnType<typeof drawn>>): THREE.Mesh {
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh;
}

/** The world position of the cube as the view draws it. */
function cubePosition(renderer: Awaited<ReturnType<typeof drawn>>): number[] {
  return cubeOf(renderer).getWorldPosition(new THREE.Vector3()).toArray();
}

/** Whether the object and every ancestor of it is visible. */
function isDrawn(object: THREE.Object3D | null): boolean {
  return !object || (object.visible && isDrawn(object.parent));
}

/** A probe that records the raw text of `property` that the Live scene tree gives the node at `path`. */
function rawProbe(path: string, property: string, seen: (string | undefined)[]) {
  return function RawProbe() {
    seen.push(useLiveNode(path)?.node.rawProperties[property]);
    return null;
  };
}

describe('a write of the host', () => {
  it('draws on the first frame when it came before the view', async () => {
    const scene = boxScene();
    await scene.getNode('Cube').set('position', variant('Vector3(4, 0, 2)'));
    expect(cubePosition(await drawn(scene))).toEqual([4, 0, 2]);
  });

  it('draws after the view mounted', async () => {
    const scene = boxScene();
    const renderer = await drawn(scene);
    await act(async () => {
      await scene.getNode('Cube').set('visible', false);
    });
    expect(isDrawn(cubeOf(renderer))).toBe(false);
  });

  it('gives the views one new graph for the writes of one task', async () => {
    const scene = boxScene();
    const graphs = new Set<unknown>();
    function GraphProbe() {
      graphs.add(useHierarchy().sceneGraph);
      return null;
    }
    render(
      <TscnSceneProvider scene={scene}>
        <GraphProbe />
      </TscnSceneProvider>
    );
    const cube = scene.getNode('Cube');
    await act(async () => {
      await Promise.all([
        cube.set('position', variant('Vector3(1, 0, 0)')),
        cube.set('scale', variant('Vector3(2, 2, 2)')),
        cube.set('visible', false),
      ]);
    });
    expect(graphs.size).toBe(2);
  });

  it.each([
    ['a Control', 'Root/Hud', 'anchor_right', 1, '1.0'],
    ['a Label', 'Root/Hud/Score', 'text', 'Score: 10', '"Score: 10"'],
    ['a Node2D', 'Root/Sprite', 'z_index', 3, '3'],
    ['a plain Node', 'Root/Plain', 'process_priority', 5, '5'],
  ])('reaches the Live scene tree of %s', async (_kind, path, property, value, text) => {
    const scene = boxScene();
    const seen: (string | undefined)[] = [];
    const RawProbe = rawProbe(path, property, seen);
    render(
      <TscnSceneProvider scene={scene}>
        <RawProbe />
      </TscnSceneProvider>
    );
    await act(async () => {
      await scene.getNode(path.slice('Root/'.length)).set(property, value);
    });
    expect(seen.at(-1)).toBe(text);
  });

  it('reaches a node inside an instance as an override', async () => {
    const files: Record<string, string> = { 'res://enemy.tscn': SUB_SCENE };
    const scene = openScene({
      source: WITH_INSTANCE,
      provider: { loadResource: async (path) => files[path] ?? null },
      rootScenePath: 'res://main.tscn',
    });
    const renderer = await drawn(scene);
    await vi.waitFor(async () => {
      await renderer.advanceFrames(1, 16);
      expect(scene.getNodeOrNull('Enemy/Body')).not.toBeNull();
    });
    await act(async () => {
      await scene.getNode('Enemy/Body').set('position', variant('Vector3(0, 3, 0)'));
    });
    await vi.waitFor(async () => {
      await renderer.advanceFrames(1, 16);
      expect(cubePosition(renderer)).toEqual([0, 3, 0]);
    });
  });
});

const UI_SCENE = `[gd_scene format=3]

[node name="Ui" type="Control"]
anchor_right = 1.0
anchor_bottom = 1.0

[node name="Panel" type="ColorRect" parent="."]
anchor_right = 1.0
anchor_bottom = 1.0
`;

const UI_VIEWPORT: Rect2 = { x: 0, y: 0, w: 400, h: 300 };

/** A probe that records the rect the Control layout solves for the node at `path`. */
function layoutProbe(path: string, rects: (Rect2 | undefined)[]) {
  return function LayoutProbe() {
    const { sceneGraph } = useHierarchy();
    const root = sceneGraph?.scenes.get(sceneGraph.rootScene);
    if (!root) throw new Error('expected the scene graph of the UI scene, got none');
    const { tree } = useBuildSolveTree(root.nodes, root.externalResources, root.internalResources);
    rects.push(solveControlTree(tree, UI_VIEWPORT, createSolveContext(nativeTheme(1))).get(path)?.rect);
    return null;
  };
}

describe('a write of an anchor', () => {
  it('solves the Control layout again', async () => {
    const scene = openScene({ source: UI_SCENE, provider, rootScenePath: 'res://main.tscn' });
    const rects: (Rect2 | undefined)[] = [];
    const LayoutProbe = layoutProbe('Ui/Panel', rects);
    render(
      <TscnSceneProvider scene={scene}>
        <LayoutProbe />
      </TscnSceneProvider>
    );
    expect(rects.at(-1)).toEqual({ x: 0, y: 0, w: 400, h: 300 });
    await act(async () => {
      await scene.getNode('Panel').set('anchor_right', 0.5);
    });
    expect(rects.at(-1)).toEqual({ x: 0, y: 0, w: 200, h: 300 });
  });
});

const SPRITE_SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Icon" type="Sprite3D" parent="."]
`;

describe('a resource from scene.load', () => {
  it('swaps the texture the node draws', async () => {
    const loadResource = vi.fn<ResourceProvider['loadResource']>(async () => null);
    const scene = openScene({
      source: SPRITE_SCENE,
      provider: { loadResource },
      rootScenePath: 'res://main.tscn',
    });
    await drawn(scene);
    await act(async () => {
      await scene.getNode('Icon').set('texture', await scene.load('res://yellow.png'));
    });
    // `scene.load` reads the `.import` sidecar, `scene.files()` reads one byte: a whole read is the node's.
    const requested = () =>
      loadResource.mock.calls.filter(([, , maxBytes]) => maxBytes === undefined).map(([path]) => path);
    await vi.waitFor(() => expect(requested()).toContain('res://yellow.png'));
  });
});

describe('the layers', () => {
  it('lays a Live scene pass over a write of the host', async () => {
    const source = `${BOX_SCENE}
[node name="Mover" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)
remote_path = NodePath("../Cube")
`;
    const scene = openScene({ source, provider, rootScenePath: 'res://main.tscn' });
    await scene.getNode('Cube').set('position', variant('Vector3(1, 0, 0)'));
    const renderer = await drawn(scene);
    await renderer.advanceFrames(2, 16);
    expect(cubePosition(renderer)).toEqual([5, 0, 0]);
  });

  it('lays a write of the host over the file', async () => {
    const source = BOX_SCENE.replace('mesh = SubResource', 'position = Vector3(9, 9, 9)\nmesh = SubResource');
    const scene = openScene({ source, provider, rootScenePath: 'res://main.tscn' });
    await scene.getNode('Cube').set('position', variant('Vector3(1, 0, 0)'));
    expect(cubePosition(await drawn(scene))).toEqual([1, 0, 0]);
  });
});

describe('a new text', () => {
  it('drops the writes of the old one', async () => {
    const scene = boxScene();
    await scene.getNode('Cube').set('position', variant('Vector3(4, 0, 2)'));
    scene.setSource(`${BOX_SCENE}\n`);
    expect(cubePosition(await drawn(scene))).toEqual([0, 0, 0]);
  });
});
