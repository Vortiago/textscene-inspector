import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { NodeDispatcher } from './NodeDispatcher';
import { WorldEnvironmentScope } from './environment/WorldEnvironmentScope';
import { nodeComponentRegistry } from './NodeComponentRegistry';
import type { CanvasWorkspace } from './contexts/CanvasWorkspaceContext';
import { SceneStack } from './testing/SceneStack';
import { settleLoads } from './testing/settleLoads';
import { withStubbedGl } from './testing/stubbedGl';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { ViewportPassStack } from '../nodes/viewport/subviewport/viewportPasses.testkit';
import './nodes';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect } from 'react';
import { TscnParser } from '../parser/TscnParser';
import { UndrawnNodeChildren } from './UndrawnNodeChildren';
import {
  ViewportPassOrchestrator,
  ViewportPassProvider,
  useRegisterViewportPass,
  type ViewportPass,
} from './contexts/ViewportPassRegistryContext';

const SCENE = `[gd_scene format=3]

[node name="Panel" type="Control"]

[node name="Early" type="SubViewport" parent="."]

[node name="Box" type="Control" parent="."]

[node name="Late" type="SubViewport" parent="Box"]
`;

function Registrar({ path, pass }: { path: string; pass: ViewportPass }) {
  const register = useRegisterViewportPass();
  useEffect(() => register(path, pass), [register, path, pass]);
  return null;
}

// A viewport's pass draws in tree order, not in the order it registers.
describe('UndrawnNodeChildren', () => {
  it('places the viewports below an undrawn node in tree order', async () => {
    const panel = new TscnParser().parse(SCENE).nodes[0]!;
    const order: string[] = [];
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportPassProvider>
        <Registrar path="Panel/Box/Late" pass={{ dependsOn: [], render: () => order.push('Late') }} />
        <Registrar path="Panel/Early" pass={{ dependsOn: [], render: () => order.push('Early') }} />
        <UndrawnNodeChildren node={panel} path="Panel" />
        <ViewportPassOrchestrator />
      </ViewportPassProvider>
    );
    await renderer.advanceFrames(1, 16);
    expect(order).toEqual(['Early', 'Late']);
  });
});

/** The names of the scenes one frame of `tscn` draws in `workspace`, and the dispatcher's root object. */
async function frameOf(tscn: string, workspace: CanvasWorkspace, parsed = new TscnParser().parse(tscn)) {
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace={workspace} loader={createFakeResourceLoader().loader} scene={parsed} source={tscn}>
      <ViewportPassStack captured={captured}>
        <WorldEnvironmentScope world="root">
          <NodeDispatcher nodes={parsed.nodes} />
        </WorldEnvironmentScope>
      </ViewportPassStack>
    </SceneStack>
  );
  await settleLoads();
  const drawn: string[] = [];
  await withStubbedGl(captured.current!, { onRender: (_bound, scene) => drawn.push(scene.name) }, () =>
    renderer.advanceFrames(1, 16)
  );
  return { drawn, renderer };
}

const VIEWPORT_BELOW_NODE2D = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Hud" type="Node2D" parent="."]

[node name="Sub" type="SubViewport" parent="Hud"]
own_world_3d = true
render_target_update_mode = 4

[node name="Camera3D" type="Camera3D" parent="Hud/Sub"]

[node name="Box" type="CSGBox3D" parent="Hud/Sub"]
`;

const LATE_TYPE = 'ZzLateCanvasItem';

const LATE_TYPE_BELOW_NODE3D = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Late" type="${LATE_TYPE}" parent="."]
`;

function LateItem() {
  return <mesh name="LateMesh" />;
}

describe('a child below an undrawn node', () => {
  it('mounts the pass of a SubViewport whose parent the workspace does not draw', async () => {
    const { drawn, renderer } = await frameOf(VIEWPORT_BELOW_NODE2D, '3d');
    expect(drawn).toContain('Sub::offscreen');
    await renderer.unmount();
  });

  it('draws a type that registers after the first walk', async () => {
    // One parsed tree for both walks, so an answer kept for its nodes would be read again.
    const parsed = new TscnParser().parse(LATE_TYPE_BELOW_NODE3D);
    const { renderer } = await frameOf(LATE_TYPE_BELOW_NODE3D, '2d', parsed);
    expect(renderer.scene.findAll((node) => node.props.name === 'LateMesh')).toHaveLength(0);
    await renderer.unmount();
    nodeComponentRegistry.register({ typeName: LATE_TYPE, Component: LateItem, canvasItem: true });
    const second = await frameOf(LATE_TYPE_BELOW_NODE3D, '2d', parsed);
    expect(second.renderer.scene.findAll((node) => node.props.name === 'LateMesh')).toHaveLength(1);
    await second.renderer.unmount();
  });
});
