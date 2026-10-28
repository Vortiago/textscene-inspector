/**
 * `useTexture2D` given a ViewportTexture: the slot samples the live target of the SubViewport its
 * `viewport_path` names, through the same resolver as every other Texture2D source.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { useTexture2D, NODE_PROPERTY, useTexture2DRid } from './useTexture2D';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import { parseTresFile } from '../parser/parsedResource';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { NodePathProvider } from '../r3f/contexts/NodePathContext';
import { ViewportTextureProvider } from '../r3f/contexts/ViewportTextureContext';
import { ViewportPassProvider, useRegisterViewportPass } from '../r3f/contexts/ViewportPassRegistryContext';
import { ViewportTexturePublisher, viewportEntry } from '../r3f/testing/ViewportTexturePublisher';
import { copiesFilledFrom } from '../r3f/liveTargets.testkit';
import { createCanvasTarget } from '../nodes/viewport/subviewport/offscreenViewport';
import { unconfiguredViewportTexture } from './textures/viewporttexture/unconfiguredViewportTexture';

const RESOURCES: TscnInternalResource[] = [
  { id: 'ViewportTexture_1', type: 'ViewportTexture', data: { viewport_path: 'NodePath("SubViewport")' } },
  {
    id: 'CanvasTexture_1',
    type: 'CanvasTexture',
    data: { resource_local_to_scene: 'true', diffuse_texture: 'SubResource("ViewportTexture_1")' },
  },
  {
    id: 'AtlasTexture_1',
    type: 'AtlasTexture',
    data: {
      resource_local_to_scene: 'true',
      atlas: 'SubResource("ViewportTexture_1")',
      region: 'Rect2(0, 0, 16, 16)',
    },
  },
  {
    id: 'SharedCanvasTexture',
    type: 'CanvasTexture',
    data: { diffuse_texture: 'SubResource("ViewportTexture_1")' },
  },
  {
    id: 'SharedAtlasTexture',
    type: 'AtlasTexture',
    data: { atlas: 'SubResource("ViewportTexture_1")', region: 'Rect2(0, 0, 16, 16)' },
  },
  {
    id: 'SharedViewportTexture',
    type: 'ViewportTexture',
    data: { resource_local_to_scene: 'false', viewport_path: 'NodePath("SubViewport")' },
  },
];

const VIEWPORT_REF = 'SubResource("ViewportTexture_1")';

const plain = createCanvasTarget(32, 32, 'plain view').texture;
const decoding = createCanvasTarget(32, 32, 'decoding view').texture;

/** A consumer at `Root/Consumer`, with the target published at `Root/SubViewport` unless told otherwise. */
function wrapper({ isPublished = true, fake = createFakeResourceLoader() } = {}) {
  const loader = fake.loader;
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ResourceLoaderProvider loader={loader}>
        <ViewportTextureProvider>
          {isPublished && (
            <ViewportTexturePublisher
              path="Root/SubViewport"
              entry={viewportEntry(
                plain,
                { x: 32, y: 32 },
                { decoding: { texture: decoding, retain: () => () => {} } }
              )}
            />
          )}
          <NodePathProvider path="Root/Consumer">{children}</NodePathProvider>
        </ViewportTextureProvider>
      </ResourceLoaderProvider>
    );
  };
}

/** Two passes that each sample the other's target, a cycle Godot cannot draw. */
function CyclicPasses() {
  const register = useRegisterViewportPass();
  useEffect(() => register('Root/Other', { dependsOn: ['Root/SubViewport'], render: () => {} }), [register]);
  useEffect(() => register('Root/SubViewport', { dependsOn: ['Root/Other'], render: () => {} }), [register]);
  return null;
}

describe('useTexture2D with a ViewportTexture', () => {
  it("samples the target's plain view, as a canvas item does", () => {
    const { result } = renderHook(() => useTexture2D(VIEWPORT_REF, [], RESOURCES), { wrapper: wrapper() });
    expect(result.current).toEqual({ texture: plain, missing: false, isArriving: false });
  });

  it('peels a CanvasTexture down to the ViewportTexture it wraps', () => {
    const { result } = renderHook(() => useTexture2D('SubResource("CanvasTexture_1")', [], RESOURCES), {
      wrapper: wrapper(),
    });
    expect(result.current.texture).toBe(plain);
  });

  it("resolves a ViewportTexture saved as a .tres against the consumer's scene", () => {
    // `make_local_resource` sets up any local-to-scene value, a file's too (`packed_scene.cpp:701-727`).
    const fake = createFakeResourceLoader();
    fake.resources.seed(
      'res://viewport.tres',
      parseTresFile(`[gd_resource type="ViewportTexture" format=3]

[resource]
viewport_path = NodePath("SubViewport")
`)
    );
    const external: TscnExternalResource[] = [{ id: '1', type: 'Texture2D', path: 'res://viewport.tres' }];
    const { result } = renderHook(() => useTexture2D('ExtResource("1")', external, []), {
      wrapper: wrapper({ fake }),
    });
    expect(result.current.texture).toBe(plain);
  });

  it('draws nothing, and reports nothing missing, before the target publishes (edge case)', () => {
    const { result } = renderHook(() => useTexture2D(VIEWPORT_REF, [], RESOURCES), {
      wrapper: wrapper({ isPublished: false }),
    });
    expect(result.current).toEqual({ texture: null, missing: false, isArriving: false });
  });

  it('reports a target in an unrenderable pass cycle as missing, so the slot draws its placeholder', () => {
    const Inner = wrapper();
    const { result } = renderHook(() => useTexture2D(VIEWPORT_REF, [], RESOURCES), {
      wrapper: ({ children }) => (
        <ViewportPassProvider>
          <CyclicPasses />
          <Inner>{children}</Inner>
        </ViewportPassProvider>
      ),
    });
    expect(result.current).toEqual({ texture: null, missing: true, isArriving: false });
  });
});

/**
 * Godot sets a ViewportTexture up only through holders that are local to scene:
 * `make_local_resource` reads the property's own resource (`packed_scene.cpp:701-704`), and
 * `configure_for_local_scene` recurses only into local sub-resources (`core/io/resource.cpp:497-503`).
 * One that is never set up samples the magenta and black placeholder (`texture_storage.cpp:589-594`).
 */
describe('a ViewportTexture Godot never sets up for the scene', () => {
  it('draws the placeholder under a CanvasTexture that is not local to scene', () => {
    const { result } = renderHook(() => useTexture2D('SubResource("SharedCanvasTexture")', [], RESOURCES), {
      wrapper: wrapper(),
    });
    expect(result.current.texture).toBe(unconfiguredViewportTexture());
  });

  it('gives the placeholder as the sheet of an AtlasTexture that is not local to scene', () => {
    const { result } = renderHook(
      () => useTexture2DRid('SubResource("SharedAtlasTexture")', [], RESOURCES, 'plain', NODE_PROPERTY),
      { wrapper: wrapper() }
    );
    expect(result.current.texture).toBe(unconfiguredViewportTexture());
  });

  it('draws the placeholder for a ViewportTexture authored as not local to scene', () => {
    const { result } = renderHook(() => useTexture2D('SubResource("SharedViewportTexture")', [], RESOURCES), {
      wrapper: wrapper(),
    });
    expect(result.current.texture).toBe(unconfiguredViewportTexture());
  });

  it('draws the placeholder for a holder the caller names as not local to scene', () => {
    const material = { id: 'Material_shared', type: 'StandardMaterial3D', data: {} };
    const { result } = renderHook(() => useTexture2DRid(VIEWPORT_REF, [], RESOURCES, 'plain', [material]), {
      wrapper: wrapper(),
    });
    expect(result.current.texture).toBe(unconfiguredViewportTexture());
  });

  it('keeps its placeholder four texels square', () => {
    const { image } = unconfiguredViewportTexture();
    expect([image.width, image.height]).toEqual([4, 4]);
  });

  /** Godot's `Image` row 0 is the top row (`drivers/gles3/storage/texture_storage.cpp:264-267`). */
  it("puts magenta in Godot's top-left texel and black beside it, in the bottom-up DataTexture's last row", () => {
    const { image } = unconfiguredViewportTexture();
    const topRow = image.data!.subarray(3 * 4 * 4, 3 * 4 * 4 + 8);
    expect([...topRow]).toEqual([255, 0, 255, 255, 0, 0, 0, 255]);
    expect([...image.data!.subarray(0, 4)]).toEqual([0, 0, 0, 255]);
  });
});

describe('an AtlasTexture over a ViewportTexture', () => {
  it("draws a live crop of the target, at the region's size, which the pass fills", () => {
    const { result, unmount } = renderHook(
      () => useTexture2D('SubResource("AtlasTexture_1")', [], RESOURCES),
      { wrapper: wrapper() }
    );
    const crop = result.current.texture!;
    expect(crop.image).toMatchObject({ width: 16, height: 16 });
    expect(copiesFilledFrom(plain)).toEqual([crop]);
    unmount();
  });

  it('frees the crop once the slot unmounts', async () => {
    const { unmount } = renderHook(() => useTexture2D('SubResource("AtlasTexture_1")', [], RESOURCES), {
      wrapper: wrapper(),
    });
    unmount();
    await Promise.resolve();
    expect(copiesFilledFrom(plain)).toEqual([]);
  });

  it('gives a slot read by RID the whole live target, as Godot names the sheet', () => {
    const { result } = renderHook(
      () => useTexture2DRid('SubResource("AtlasTexture_1")', [], RESOURCES, 'plain', NODE_PROPERTY),
      {
        wrapper: wrapper(),
      }
    );
    expect(result.current.texture).toBe(plain);
  });
});

describe('useTexture2DRid with a ViewportTexture', () => {
  it('samples the view the slot asks for: the decoding view for a source_color slot', () => {
    const { result } = renderHook(
      () => useTexture2DRid(VIEWPORT_REF, [], RESOURCES, 'decoding', NODE_PROPERTY),
      {
        wrapper: wrapper(),
      }
    );
    expect(result.current.texture).toBe(decoding);
    expect(result.current.namesTexture).toBe(true);
  });
});
