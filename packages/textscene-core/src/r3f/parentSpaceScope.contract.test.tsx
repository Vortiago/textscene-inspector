/**
 * A node escapes a parent whose transform and visibility do not reach it (`godot/parentSpace.ts`):
 * a Node3D composes both only through a Node3D parent (`node_3d.cpp:150`, `:656-660`,
 * `:1132-1143`), and a CanvasItem only through a CanvasItem parent (`canvas_item.cpp:309-348`).
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { useSelection } from './contexts/SelectionContext';
import type { CanvasWorkspace } from './contexts/CanvasWorkspaceContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';
import { SceneStack } from './testing/SceneStack';

import './nodes/index';

interface RenderOptions {
  workspace?: CanvasWorkspace;
  subScenes?: Readonly<Record<string, string>>;
  hiddenPaths?: readonly string[];
}

function HiddenPathSeeder({ paths }: { paths: readonly string[] }) {
  const { toggleHidden } = useSelection();
  useEffect(() => {
    for (const p of paths) toggleHidden(p);
  }, [paths, toggleHidden]);
  return null;
}

async function renderWorld(tscn: string, options: RenderOptions = {}): Promise<THREE.Object3D> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  for (const [path, source] of Object.entries(options.subScenes ?? {})) {
    fake.scenes.seed(path, new TscnParser().parse(source));
  }
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace={options.workspace ?? '3d'} loader={fake.loader} scene={parsed}>
      <HiddenPathSeeder paths={options.hiddenPaths ?? []} />
      <NodeDispatcher nodes={parsed.nodes} />
    </SceneStack>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  if (!root) throw new Error('the dispatcher mounted nothing');
  root.updateMatrixWorld(true);
  return root;
}

/** The named node's own group: the first object carrying its name. */
function named(root: THREE.Object3D, name: string): THREE.Object3D {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`node "${name}" mounted no group`);
  return found;
}

function worldOrigin(root: THREE.Object3D, name: string): number[] {
  return named(root, name).getWorldPosition(new THREE.Vector3()).toArray();
}

/** What three's renderer draws: an object whose every ancestor is visible. */
function isRenderedVisible(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function isAncestor(ancestor: THREE.Object3D, object: THREE.Object3D): boolean {
  for (let o = object.parent; o; o = o.parent) if (o === ancestor) return true;
  return false;
}

const MOVED_ROOT_3D = `[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)`;

const CHILD_3D = `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)`;

describe('a Node3D below a plain Node', () => {
  it('drops the transform of the Node3D above the plain Node', async () => {
    const root = await renderWorld(`[gd_scene format=3]

${MOVED_ROOT_3D}

[node name="Folder" type="Node" parent="."]

[node name="Child" type="Node3D" parent="Folder"]
${CHILD_3D}
`);
    expect(worldOrigin(root, 'Child')).toEqual([0, 1, 0]);
  });

  it('draws although the Node3D above the plain Node is hidden', async () => {
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node3D"]
visible = false

[node name="Folder" type="Node" parent="."]

[node name="Child" type="Node3D" parent="Folder"]
`);
    expect(isRenderedVisible(named(root, 'Child'))).toBe(true);
  });

  it('draws although the eye toggle hides the Node3D above the plain Node', async () => {
    const root = await renderWorld(
      `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Folder" type="Node" parent="."]

[node name="Child" type="Node3D" parent="Folder"]
`,
      { hiddenPaths: ['Root'] }
    );
    expect(isRenderedVisible(named(root, 'Child'))).toBe(true);
  });

  it('stays inside the dispatcher’s pointer root, so a click still reaches it', async () => {
    const root = await renderWorld(`[gd_scene format=3]

${MOVED_ROOT_3D}

[node name="Folder" type="Node" parent="."]

[node name="Child" type="Node3D" parent="Folder"]
`);
    expect(isAncestor(root.children[0]!, named(root, 'Child'))).toBe(true);
  });

  it('keeps composing a Node3D directly under a Node3D', async () => {
    const root = await renderWorld(`[gd_scene format=3]

${MOVED_ROOT_3D}
visible = false

[node name="Child" type="Node3D" parent="."]
${CHILD_3D}
`);
    expect(worldOrigin(root, 'Child')).toEqual([5, 1, 0]);
    expect(isRenderedVisible(named(root, 'Child'))).toBe(false);
  });

  it('keeps an instance that has not merged in place, since its class is unknown', async () => {
    const root = await renderWorld(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://missing.tscn" id="1"]

${MOVED_ROOT_3D}

[node name="Inst" parent="." instance=ExtResource("1")]
${CHILD_3D}
`);
    expect(worldOrigin(root, 'Inst')).toEqual([5, 1, 0]);
  });

  it('frees the children of a merged instance whose root is a plain Node', async () => {
    const root = await renderWorld(
      `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://folder.tscn" id="1"]

${MOVED_ROOT_3D}

[node name="Inst" parent="." instance=ExtResource("1")]
`,
      {
        subScenes: {
          'res://folder.tscn': `[gd_scene format=3]

[node name="Folder" type="Node"]

[node name="Child" type="Node3D" parent="."]
${CHILD_3D}
`,
        },
      }
    );
    expect(worldOrigin(root, 'Child')).toEqual([0, 1, 0]);
  });
});

describe('a node that escapes inside a sub-viewport', () => {
  it('stays in the sub-viewport’s own world, not the host’s', async () => {
    const root = await renderWorld(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
own_world_3d = true

[node name="Inner" type="Node3D" parent="Viewport"]

[node name="Folder" type="Node" parent="Viewport/Inner"]

[node name="Escaped" type="Node3D" parent="Viewport/Inner/Folder"]
`);
    expect(root.getObjectByName('Inner')).toBeUndefined();
    expect(root.getObjectByName('Escaped')).toBeUndefined();
  });
});

const RECT = 'polygon = PackedVector2Array(0, 0, 160, 0, 160, 80, 0, 80)';

describe('a CanvasItem below a node that is not a CanvasItem', () => {
  it('draws although the Node2D above the plain Node is hidden', async () => {
    const root = await renderWorld(
      `[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false

[node name="Holder" type="Node" parent="."]

[node name="Detached" type="Polygon2D" parent="Holder"]
${RECT}
`,
      { workspace: '2d' }
    );
    expect(isRenderedVisible(named(root, 'Detached'))).toBe(true);
  });

  it('draws although the Node2D above its CanvasLayer is hidden', async () => {
    const root = await renderWorld(
      `[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false

[node name="Layer" type="CanvasLayer" parent="."]

[node name="Art" type="Polygon2D" parent="Layer"]
${RECT}
`,
      { workspace: '2d' }
    );
    expect(isRenderedVisible(named(root, 'Art'))).toBe(true);
  });

  it('still drops the ancestor transform once, not twice', async () => {
    const root = await renderWorld(
      `[gd_scene format=3]

[node name="Root" type="Node2D"]
position = Vector2(300, 200)

[node name="Holder" type="Node" parent="."]

[node name="Detached" type="Polygon2D" parent="Holder"]
position = Vector2(40, 10)
${RECT}
`,
      { workspace: '2d' }
    );
    expect(worldOrigin(root, 'Detached')).toEqual([40, -10, 0]);
  });

  it('keeps a hidden Node2D hiding its CanvasItem child', async () => {
    const root = await renderWorld(
      `[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false

[node name="Nested" type="Polygon2D" parent="."]
${RECT}
`,
      { workspace: '2d' }
    );
    expect(isRenderedVisible(named(root, 'Nested'))).toBe(false);
  });
});
