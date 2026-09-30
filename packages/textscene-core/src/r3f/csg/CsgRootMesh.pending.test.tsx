/**
 * The CSG library arrives through a lazy import, outside the resource bus. The root counts as a
 * pending load until it lands, so the camera's settle-fit frames the evaluated result, however
 * long the chunk takes.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { NodePathProvider } from '../contexts/NodePathContext';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';
import { ResourceLoader } from '../../resources/ResourceLoader';
import { ResourceLoaderContext } from '../../resources/ResourceLoaderContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import type { CsgModule } from './csgModule';
import '../nodes/index';

/** The library load, held open until a test lets it land. */
const libraryLoad = vi.hoisted(() => {
  let land: () => void = () => {};
  const landed = new Promise<void>((resolve) => {
    land = resolve;
  });
  return { landed, land: () => land() };
});

vi.mock('./csgModule', async (importOriginal) => {
  const original = await importOriginal<typeof import('./csgModule')>();
  return {
    ...original,
    loadCsgModule: async (): Promise<CsgModule> => {
      await libraryLoad.landed;
      return original.loadCsgModule();
    },
  };
});

const SUBTRACTION = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Block" type="CSGBox3D" parent="."]
size = Vector3(2, 2, 2)

[node name="Hole" type="CSGSphere3D" parent="Block"]
operation = 2
radius = 1.25
`;

function Tree({ node, path }: { node: TscnNode; path: string }) {
  const Component = nodeComponentRegistry.get(node.type)!;
  return (
    <NodePathProvider path={path}>
      <Component node={node}>
        {node.children.map((child) => (
          <Tree key={child.name} node={child} path={`${path}/${child.name}`} />
        ))}
      </Component>
    </NodePathProvider>
  );
}

async function mountSubtraction(loader: ResourceLoader) {
  const scene = new TscnParser().parse(SUBTRACTION);
  const block = scene.nodes[0]!.children[0]!;
  await ReactThreeTestRenderer.create(
    <ResourceLoaderContext.Provider value={loader}>
      <SceneResourcesProvider internalResources={scene.internalResources}>
        <Tree node={block} path="Root/Block" />
      </SceneResourcesProvider>
    </ResourceLoaderContext.Provider>
  );
}

describe('<CsgRootMesh> and the loader', () => {
  it('counts as a pending load while the CSG library loads, and releases it once it lands', async () => {
    const loader = new ResourceLoader();
    await mountSubtraction(loader);
    expect(loader.pendingResourceCount).toBe(1);

    await ReactThreeTestRenderer.act(async () => {
      libraryLoad.land();
      for (let tick = 0; tick < 10 && loader.pendingResourceCount > 0; tick++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
    expect(loader.pendingResourceCount).toBe(0);
  });
});
