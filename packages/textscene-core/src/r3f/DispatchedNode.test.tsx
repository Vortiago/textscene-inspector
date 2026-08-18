/**
 * The resource scope a grafted node renders under.
 *
 * A node carrying `authoredResources` was grafted into content loaded from
 * another scene, so its subtree must read the ExtResource table it was authored
 * against — while the SubResource pool it already had stays exactly as it was,
 * once each. `SceneResourcesProvider` inherits the ambient pool on its own, so a
 * graft that also hands that pool back doubles it at every nesting level.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../parser/types';
import { DispatchedNode } from './DispatchedNode';
import { nodeComponentRegistry, type NodeComponentProps } from './NodeComponentRegistry';
import { SelectionProvider } from './contexts/SelectionContext';
import {
  SceneResourcesProvider,
  useSceneResources,
  type SceneResources,
} from './SceneResourcesContext';

const seen = new Map<string, SceneResources>();

function ResourceProbe({ node, children }: NodeComponentProps) {
  seen.set(node.name, useSceneResources());
  return <group>{children}</group>;
}

nodeComponentRegistry.register({
  typeName: 'ResourceProbe',
  Component: ResourceProbe,
  container: true,
});

const hostInternal: TscnInternalResource[] = [{ id: 'BoxMesh_host', type: 'BoxMesh', data: {} }];
const hostExternal: TscnExternalResource[] = [
  { id: '1_tex', type: 'Texture2D', path: 'res://host.png' },
];
const authored: TscnExternalResource[] = [
  { id: '1_tex', type: 'Texture2D', path: 'res://outer.png' },
];

function grafted(name: string, children: TscnNode[] = []): TscnNode {
  return {
    name,
    type: 'ResourceProbe',
    properties: {},
    children,
    authoredResources: authored,
  };
}

async function renderUnderHost(node: TscnNode) {
  seen.clear();
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      <SceneResourcesProvider internalResources={hostInternal} externalResources={hostExternal}>
        <DispatchedNode node={node} path={node.name} />
      </SceneResourcesProvider>
    </SelectionProvider>
  );
}

describe('a grafted node’s resource scope', () => {
  it('swaps in the authored ExtResource table, ahead of the host one', async () => {
    await renderUnderHost(grafted('Graft'));

    expect(seen.get('Graft')!.externalResources).toEqual([...authored, ...hostExternal]);
    // Precedence: the id the graft was authored against wins on a collision.
    expect(seen.get('Graft')!.externalResources.find((r) => r.id === '1_tex')?.path).toBe(
      'res://outer.png'
    );
  });

  it('leaves the inherited SubResource pool holding each resource once', async () => {
    await renderUnderHost(grafted('Graft'));

    expect(seen.get('Graft')!.internalResources).toEqual(hostInternal);
  });

  it('does not grow the pool per nesting level', async () => {
    await renderUnderHost(grafted('Outer', [grafted('Inner', [grafted('Innermost')])]));

    expect(seen.get('Innermost')!.internalResources).toEqual(hostInternal);
  });
});
