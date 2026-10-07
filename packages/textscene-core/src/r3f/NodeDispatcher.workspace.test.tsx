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
import type { CanvasWorkspace } from './contexts/CanvasWorkspaceContext';

import './nodes/index';

interface WorkspaceRow {
  type: string;
  mountsIn: readonly CanvasWorkspace[];
}

const MOUNTS_PER_WORKSPACE: readonly WorkspaceRow[] = [
  { type: 'Node', mountsIn: ['3d', '2d'] },
  { type: 'Node3D', mountsIn: ['3d'] },
  { type: 'MeshInstance3D', mountsIn: ['3d'] },
  { type: 'Sprite2D', mountsIn: ['2d'] },
  { type: 'Label', mountsIn: ['2d'] },
  // ClassDB puts it under Control, and this previewer has no painter for it.
  { type: 'OpenXRInteractionProfileEditor', mountsIn: ['2d'] },
  { type: 'CanvasLayer', mountsIn: ['2d'] },
  { type: 'SubViewportContainer', mountsIn: ['3d', '2d'] },
  { type: 'SubViewport', mountsIn: ['3d', '2d'] },
];

function sceneWithChild(type: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Probe" type="${type}" parent="."]
`;
}

async function render(source: string, workspace: CanvasWorkspace) {
  const scene = new TscnParser().parse(source);
  const fake = createFakeResourceLoader();
  return ReactThreeTestRenderer.create(
    <SceneStack workspace={workspace} loader={fake.loader} scene={scene}>
      <NodeDispatcher nodes={scene.nodes} />
    </SceneStack>
  );
}

const CASES = MOUNTS_PER_WORKSPACE.flatMap(({ type, mountsIn }) =>
  (['3d', '2d'] as const).map((workspace) => ({ type, workspace, mounts: mountsIn.includes(workspace) }))
);

describe('NodeDispatcher workspace split', () => {
  it.each(CASES)('$type in the $workspace workspace mounts: $mounts', async ({ type, workspace, mounts }) => {
    const renderer = await render(sceneWithChild(type), workspace);
    expect(renderer.scene.findAllByProps({ name: 'Probe' }).length > 0).toBe(mounts);
  });
});
