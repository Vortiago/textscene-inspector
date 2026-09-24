/**
 * <NavigationRegion2D> renders its NavigationPolygon as a translucent overlay
 * in the 2D workspace, gated on the showNavigation toggle. The .tres is
 * injected into the 'resource' processor cache so it resolves synchronously.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode, TscnExternalResource } from '../../../parser/types';
import type { ParsedResource } from '../../../parser/parsedResource';
import { parseNavigationRegion2D } from './parser';
import { NavigationRegion2D } from './Component';
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

const NAVPOLY_TRES: ParsedResource = {
  resourceType: 'NavigationPolygon',
  properties: {
    vertices: 'PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)',
    polygons: 'Array[PackedInt32Array]([PackedInt32Array(0, 1, 2, 3)])',
  },
  extResources: [],
  subResources: [],
};

const EXT: TscnExternalResource[] = [
  { id: '2_poly', path: 'res://nav_polygon.tres', type: 'NavigationPolygon' },
];

function makeLoaderWith(path: string, tres: ParsedResource): ResourceLoader {
  const provider = new NoopProvider();
  const loader = new ResourceLoader(new FileEventBus(provider));
  loader.setProvider(provider);
  const origGet = loader.resources.getCached.bind(loader.resources);
  const origReq = loader.resources.request.bind(loader.resources);
  loader.resources.getCached = (p: string) => (p === path ? tres : origGet(p));
  loader.resources.request = (p: string) => {
    if (p === path) loader.eventBus.emit<ParsedResource>('resource', 'loaded', p, tres);
    else origReq(p);
  };
  return loader;
}

function navNode(): TscnNode {
  return {
    name: 'Nav2D',
    type: 'NavigationRegion2D',
    children: [],
    properties: parseNavigationRegion2D(
      { type: 'node', attributes: { type: 'NavigationRegion2D', name: 'Nav2D' } },
      { navigation_polygon: 'ExtResource("2_poly")' }
    ),
  };
}

async function render(showNavigation: boolean, tres: ParsedResource = NAVPOLY_TRES) {
  const loader = makeLoaderWith('res://nav_polygon.tres', tres);
  const renderer = await ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowNavigation={showNavigation}>
      <ResourceLoaderProvider loader={loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={EXT}>
          <NavigationRegion2D node={navNode()} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </ViewportModeProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  return renderer;
}

describe('<NavigationRegion2D>', () => {
  it('renders the translucent navigation overlay from the polygon', async () => {
    const renderer = await render(true);
    const overlay = renderer.scene
      .findAllByType('Mesh')
      .map((m) => (m.instance as THREE.Mesh).material as THREE.MeshBasicMaterial)
      .find((mat) => mat?.transparent && mat.color?.getHex() === NAV_OVERLAY_COLOR);
    expect(overlay).toBeDefined();
    expect(renderer.scene.findAllByType('LineSegments').length).toBeGreaterThan(0);
  });

  it('hides the overlay when showNavigation is off', async () => {
    const renderer = await render(false);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws nothing when the polygon is unreadable, instead of faulting the render', async () => {
    // The decode is total, so an unreadable polygon cannot throw out of a render pass.
    const renderer = await render(true, {
      ...NAVPOLY_TRES,
      properties: { vertices: 'PackedVector2Array(0, oops)', polygons: '[PackedInt32Array(0, 1, 2)]' },
    });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });
});
