/**
 * The minimum-size walk sizes a ViewportTexture slot as Godot's `ViewportTexture::get_size` does: the
 * viewport's size once set up, and 0 for one its scene never sets up (`viewport.cpp:156-166`).
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { ViewportTextureProvider } from '../../contexts/ViewportTextureContext';
import { ViewportTexturePublisher, viewportEntry } from '../../testing/ViewportTexturePublisher';
import { createCanvasTarget } from '../../../nodes/viewport/subviewport/offscreenViewport';
import { useBuildSolveTree } from './buildSolveTree';
import '../../nodes/index';
import '../index';

const NO_EXTERNAL: readonly TscnExternalResource[] = [];

const VIEWPORT_TEXTURE: TscnInternalResource = {
  id: 'ViewportTexture_1',
  type: 'ViewportTexture',
  data: { viewport_path: 'NodePath("SubViewport")' },
};

/** A CanvasTexture around the ViewportTexture, local to scene or not. */
function canvasTexture(isLocal: boolean): TscnInternalResource {
  return {
    id: 'CanvasTexture_1',
    type: 'CanvasTexture',
    data: {
      diffuse_texture: 'SubResource("ViewportTexture_1")',
      resource_local_to_scene: String(isLocal),
    },
  };
}

/** `Root/Shown`, a TextureRect whose texture is `ref`, so its viewport path counts from `Root`. */
function shownBy(ref: string): TscnNode[] {
  return [node('Root', 'Node2D', { children: [node('Shown', 'TextureRect', { texture: ref })] })];
}

function node(name: string, type: string, extra: Partial<TscnNode> & Record<string, unknown> = {}): TscnNode {
  const { children = [], ...properties } = extra;
  return { rawProperties: {}, name, type, children, properties: { name, ...properties } } as TscnNode;
}

/** The textureSize the walk gives `Root/Shown`, with a 64 by 32 target published at `published`. */
function shownTextureSize(nodes: TscnNode[], resources: TscnInternalResource[], published: string | null) {
  const target = createCanvasTarget(64, 32, 'SubViewport');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
      <ViewportTextureProvider>
        {published && (
          <ViewportTexturePublisher
            path={published}
            entry={viewportEntry(target.texture, { x: 64, y: 32 })}
          />
        )}
        {children}
      </ViewportTextureProvider>
    </ResourceLoaderProvider>
  );
  const { result } = renderHook(() => useBuildSolveTree(nodes, [], resources), { wrapper });
  return result.current.tree[0]?.textureSize;
}

describe('useBuildSolveTree: a ViewportTexture slot', () => {
  it('takes the size of the viewport its scene sets up', () => {
    const size = shownTextureSize(
      shownBy('SubResource("ViewportTexture_1")'),
      [VIEWPORT_TEXTURE],
      'Root/SubViewport'
    );
    expect(size).toEqual({ x: 64, y: 32 });
  });

  it('takes size 0 for a ViewportTexture its scene never sets up', () => {
    const size = shownTextureSize(
      shownBy('SubResource("CanvasTexture_1")'),
      [VIEWPORT_TEXTURE, canvasTexture(false)],
      'Root/SubViewport'
    );
    expect(size).toEqual({ x: 0, y: 0 });
  });

  it('takes the viewport size through a CanvasTexture that is local to scene', () => {
    const size = shownTextureSize(
      shownBy('SubResource("CanvasTexture_1")'),
      [VIEWPORT_TEXTURE, canvasTexture(true)],
      'Root/SubViewport'
    );
    expect(size).toEqual({ x: 64, y: 32 });
  });

  it('waits for a viewport that has not published its target yet', () => {
    expect(
      shownTextureSize(shownBy('SubResource("ViewportTexture_1")'), [VIEWPORT_TEXTURE], null)
    ).toBeNull();
  });
});

/**
 * The walk for `nodes`, which a 64 by 32 target at `Root/SubViewport` joins once `publish` runs. A
 * publish re-renders every reader of the viewport textures.
 */
function solveBeforeAndAfterPublish(nodes: TscnNode[], resources: TscnInternalResource[]) {
  const target = createCanvasTarget(64, 32, 'SubViewport');
  const { loader } = createFakeResourceLoader();
  let isPublished = false;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={loader}>
      <ViewportTextureProvider>
        {isPublished && (
          <ViewportTexturePublisher
            path="Root/SubViewport"
            entry={viewportEntry(target.texture, { x: 64, y: 32 })}
          />
        )}
        {children}
      </ViewportTextureProvider>
    </ResourceLoaderProvider>
  );
  const { result, rerender } = renderHook(() => useBuildSolveTree(nodes, NO_EXTERNAL, resources), {
    wrapper,
  });
  const before = result.current.tree;
  isPublished = true;
  act(() => rerender());
  return { before, after: result.current.tree };
}

describe('useBuildSolveTree: a viewport publish', () => {
  it('keeps the forest when no slot reads the viewport', () => {
    const { before, after } = solveBeforeAndAfterPublish(shownBy('SubResource("Missing")'), []);
    expect(after).toBe(before);
  });

  it('rebuilds the forest when a slot reads the viewport', () => {
    const { after } = solveBeforeAndAfterPublish(shownBy('SubResource("ViewportTexture_1")'), [
      VIEWPORT_TEXTURE,
    ]);
    expect(after[0]?.textureSize).toEqual({ x: 64, y: 32 });
  });
});
