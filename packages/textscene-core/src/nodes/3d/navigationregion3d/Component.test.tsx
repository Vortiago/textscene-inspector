/**
 * <NavigationRegion3D> renders its NavigationMesh as a translucent overlay
 * (filled faces + edge lines), gated on the showNavigation toggle. The .tres is
 * injected into the 'resource' processor cache so it resolves synchronously.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode, TscnExternalResource } from '../../../parser/types';
import type { ParsedTresFile } from '../../../parser/tresParser';
import { parseNavigationRegion3D } from './parser';
import { NavigationRegion3D } from './Component';
import { NAV_OVERLAY_COLOR } from '../../../r3f/navigationOverlay';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';
import { ResourceLoaderProvider, ResourceLoader, FileEventBus } from '../../../index';
import type { ResourceProvider } from '../../../resources/ResourceProvider';

class NoopProvider implements ResourceProvider {
  async loadResource(): Promise<string | ArrayBuffer | null> {
    return null;
  }
}

const NAVMESH_TRES: ParsedTresFile = {
  resourceType: 'NavigationMesh',
  properties: {
    vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1)',
    polygons: '[PackedInt32Array(0, 1, 2), PackedInt32Array(0, 2, 3)]',
  },
  extResources: [],
  subResources: [],
};

const EXT: TscnExternalResource[] = [
  { id: '2_nav', path: 'res://navmesh.tres', type: 'NavigationMesh' },
];

function makeLoaderWith(path: string, tres: ParsedTresFile): ResourceLoader {
  const provider = new NoopProvider();
  const loader = new ResourceLoader(new FileEventBus(provider));
  loader.setProvider(provider);
  const origGet = loader.resources.getCached.bind(loader.resources);
  const origReq = loader.resources.request.bind(loader.resources);
  loader.resources.getCached = (p: string) => (p === path ? tres : origGet(p));
  loader.resources.request = (p: string) => {
    if (p === path) loader.eventBus.emit<ParsedTresFile>('resource', 'loaded', p, tres);
    else origReq(p);
  };
  return loader;
}

function navNode(): TscnNode {
  return {
    name: 'Nav',
    type: 'NavigationRegion3D',
    children: [],
    properties: parseNavigationRegion3D(
      { type: 'node', attributes: { type: 'NavigationRegion3D', name: 'Nav' } },
      { navigation_mesh: 'ExtResource("2_nav")' }
    ),
  };
}

async function render(showNavigation: boolean) {
  const loader = makeLoaderWith('res://navmesh.tres', NAVMESH_TRES);
  const renderer = await ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowNavigation={showNavigation}>
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={EXT}>
          <NavigationRegion3D node={navNode()} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </ViewportModeProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  return renderer;
}

describe('<NavigationRegion3D>', () => {
  it('renders a translucent green overlay mesh + edge lines from the navmesh', async () => {
    const renderer = await render(true);
    const overlay = renderer.scene
      .findAllByType('Mesh')
      .map((m) => m.instance.material as THREE.MeshBasicMaterial)
      .find((mat) => mat?.transparent && mat.color?.getHex() === NAV_OVERLAY_COLOR);
    expect(overlay).toBeDefined();
    expect(overlay!.depthWrite).toBe(false);
    expect(renderer.scene.findAllByType('LineSegments').length).toBeGreaterThan(0);
  });

  it('hides the overlay when showNavigation is off', async () => {
    const renderer = await render(false);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });
});
