/**
 * Tests for the WI-R3F-7 missing-texture chain (WEB-03/04/05).
 *
 * Verifies that `<MeshInstance3D>` walks `material_override → SubResource
 * StandardMaterial3D → ExtResource Texture2D` and renders a magenta
 * placeholder when the texture comes back missing from `useResource`.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import {
  ResourceLoaderProvider,
  ResourceLoader,
  FileEventBus,
} from '../../../index';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';

class MissingFileProvider implements ResourceProvider {
  async loadResource(): Promise<string | ArrayBuffer | null> {
    return null;
  }
  hasResource(): boolean {
    return false;
  }
}

function makeFixture(): {
  node: TscnNode;
  internalResources: TscnInternalResource[];
  externalResources: TscnExternalResource[];
} {
  const node: TscnNode = {
    name: 'Mesh1',
    type: 'MeshInstance3D',
    children: [],
    properties: {
      name: 'Mesh1',
      mesh: 'SubResource("box")',
      materialOverride: 'SubResource("3")',
      surfaceMaterialOverrides: new Map(),
    } as MeshInstance3DProperties,
  };

  const internalResources: TscnInternalResource[] = [
    { id: 'box', type: 'BoxMesh', data: { id: 'box' } },
    {
      id: '3',
      type: 'StandardMaterial3D',
      data: {
        id: '3',
        albedo_texture: 'ExtResource("1")',
      } as Record<string, string>,
    },
  ];

  const externalResources: TscnExternalResource[] = [
    { id: '1', path: 'res://textures/shared.png', type: 'Texture2D' },
  ];

  return { node, internalResources, externalResources };
}

async function renderInLoader(
  node: TscnNode,
  internalResources: TscnInternalResource[],
  externalResources: TscnExternalResource[],
  loader: ResourceLoader
) {
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={internalResources}
        externalResources={externalResources}
      >
        <MeshInstance3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('<MeshInstance3D> missing-texture chain (WI-R3F-7 / WEB-03/04/05)', () => {
  it('renders a magenta placeholder when the albedo texture is missing', async () => {
    const { node, internalResources, externalResources } = makeFixture();
    const provider = new MissingFileProvider();
    const bus = new FileEventBus(provider);
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);

    const renderer = await renderInLoader(node, internalResources, externalResources, loader);

    // Let the synchronous chain settle: useResource fires `request()`
    // which routes through FileEventBus.loadAsync (Promise) which
    // returns null and emits `texture:failed`. The hook flips to
    // `missing`, and a React re-render swaps to the magenta material.
    await new Promise<void>((r) => setTimeout(r, 50));
    await renderer.update(
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider
          internalResources={internalResources}
          externalResources={externalResources}
        >
          <MeshInstance3D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const materials = renderer.scene.findAllByType('MeshStandardMaterial');
    const magenta = materials.find((m) => {
      const color = (m.instance as THREE.MeshStandardMaterial).color;
      // "magenta" in CSS is the same as r=1, g=0, b=1 in linear-ish space.
      return color.r > 0.9 && color.g < 0.1 && color.b > 0.9;
    });
    expect(magenta).toBeDefined();
  });

  it('walks ExtResource references in the material via externalResources to find the texture path', async () => {
    const { node, internalResources, externalResources } = makeFixture();
    const provider = new MissingFileProvider();
    const bus = new FileEventBus(provider);
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);

    // Spy on the texture processor's request() so we can confirm
    // the hook resolved the ExtResource("1") chain to the path.
    let requestedPath: string | undefined;
    const originalRequest = loader.textures.request.bind(loader.textures);
    loader.textures.request = (path: string) => {
      requestedPath = path;
      originalRequest(path);
    };

    await renderInLoader(node, internalResources, externalResources, loader);
    await new Promise<void>((r) => setTimeout(r, 50));

    expect(requestedPath).toBe('res://textures/shared.png');
  });
});
