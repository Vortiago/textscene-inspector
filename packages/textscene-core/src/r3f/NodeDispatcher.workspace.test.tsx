/**
 * Workspace-aware dispatch: the 3D viewport renders no CanvasItem, and the 2D
 * world canvas no 3D subtree. A plain Node container passes children through in both.
 */
import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';
import { SceneStack } from './testing/SceneStack';

import './nodes/index';

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Spatial" type="Node3D" parent="."]

[node name="Sprite" type="Sprite2D" parent="."]
`;

async function render(workspace?: '2d' | '3d') {
  const scene = new TscnParser().parse(SCENE);
  const fake = createFakeResourceLoader();
  return ReactThreeTestRenderer.create(
    <SceneStack workspace={workspace} loader={fake.loader} scene={scene}>
      <NodeDispatcher nodes={scene.nodes} />
    </SceneStack>
  );
}

describe('NodeDispatcher workspace split', () => {
  it('3D (default): renders Node3D content, drops CanvasItem subtrees', async () => {
    const r = await render();
    expect(r.scene.findAllByProps({ name: 'Spatial' })).toHaveLength(1);
    expect(r.scene.findAllByProps({ name: 'Sprite' })).toHaveLength(0);
  });

  it('2D world canvas: renders CanvasItems, drops 3D subtrees, passes plain Node through', async () => {
    const r = await render('2d');
    expect(r.scene.findAllByProps({ name: 'Sprite' }).length).toBeGreaterThan(0);
    expect(r.scene.findAllByProps({ name: 'Spatial' })).toHaveLength(0);
  });
});
