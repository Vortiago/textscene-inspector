/**
 * The consumer half of the ViewportTexture seam: a texture slot that names a
 * node instead of a file.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect, useLayoutEffect } from 'react';
import * as THREE from 'three';

const warnCalls: unknown[][] = [];
vi.mock('../../../logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../logger.js')>();
  return {
    ...actual,
    warn: (...args: unknown[]) => {
      warnCalls.push(args);
    },
  };
});

import type { TscnInternalResource } from '../../../parser/types';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import {
  ViewportPassProvider,
  useRegisterViewportPass,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import {
  isViewportTextureRef,
  useViewportTextureSlot,
  type ViewportTextureView,
} from './useViewportTextureSlot';
import {
  ViewportTexturePublisher,
  countingView,
  viewportEntry,
} from '../../../r3f/testing/ViewportTexturePublisher';
import type { ViewportTextureEntry } from '../../../r3f/contexts/ViewportTextureContext';

const viewportTexture: TscnInternalResource = {
  id: 'ViewportTexture_1',
  type: 'ViewportTexture',
  data: { viewport_path: 'NodePath("SubViewport")' },
};

const atlasTexture: TscnInternalResource = {
  id: 'Atlas_1',
  type: 'AtlasTexture',
  data: { atlas: 'ExtResource("1")' },
};

const RESOURCES = [viewportTexture, atlasTexture];

function Consumer({
  slotRef,
  onResolve,
}: {
  slotRef: string | undefined;
  onResolve: (result: ReturnType<typeof useViewportTextureSlot>) => void;
}) {
  onResolve(useViewportTextureSlot(slotRef, RESOURCES, 'plain'));
  return null;
}

/** Mounts a consumer at `consumerPath`, optionally with a publisher. */
function mount(slotRef: string | undefined, consumerPath: string | null, publishAt?: string) {
  const seen: ReturnType<typeof useViewportTextureSlot>[] = [];
  const texture = new THREE.Texture();
  const consumer = <Consumer slotRef={slotRef} onResolve={(r) => seen.push(r)} />;
  render(
    <ViewportTextureProvider>
      {publishAt ? (
        <ViewportTexturePublisher path={publishAt} entry={viewportEntry(texture, { x: 256, y: 256 })} />
      ) : null}
      {consumerPath === null ? consumer : <NodePathProvider path={consumerPath}>{consumer}</NodePathProvider>}
    </ViewportTextureProvider>
  );
  return {
    resolved: () => seen.at(-1)?.texture ?? null,
    cyclic: () => seen.at(-1)?.cyclic ?? false,
    texture,
  };
}

describe('isViewportTextureRef', () => {
  it('recognises a ViewportTexture sub-resource', () => {
    expect(isViewportTextureRef('SubResource("ViewportTexture_1")', RESOURCES)).toBe(true);
  });

  it('rejects a different texture sub-resource', () => {
    expect(isViewportTextureRef('SubResource("Atlas_1")', RESOURCES)).toBe(false);
  });

  it('rejects an ExtResource and an absent reference', () => {
    expect(isViewportTextureRef('ExtResource("1")', RESOURCES)).toBe(false);
    expect(isViewportTextureRef(undefined, RESOURCES)).toBe(false);
  });
});

describe('useViewportTextureSlot', () => {
  /**
   * `viewport_path` counts from the local scene root (`ViewportTexture::_setup_local_to_scene`,
   * `p_loc_scene->get_node_or_null(path)`), and the registry uses dispatcher-absolute
   * paths. A deep consumer still finds a sub-viewport that is a child of the root.
   */
  it('resolves a root-relative viewport path from a consumer deep in the tree', () => {
    const { resolved, texture } = mount(
      'SubResource("ViewportTexture_1")',
      'Root/Rig/Screen',
      'Root/SubViewport'
    );
    expect(resolved()).toBe(texture);
  });

  it('resolves for a consumer that is a direct child of the root', () => {
    const { resolved, texture } = mount(
      'SubResource("ViewportTexture_1")',
      'Root/Screen',
      'Root/SubViewport'
    );
    expect(resolved()).toBe(texture);
  });

  /**
   * An unpublished target is null, never a placeholder: the publisher's effect
   * runs after mount, so a consumer re-renders when the reactive map updates.
   */
  it('returns null until the sub-viewport publishes', () => {
    const { resolved } = mount('SubResource("ViewportTexture_1")', 'Root/Screen');
    expect(resolved()).toBeNull();
  });

  it('returns null when the named viewport is not the one that published', () => {
    const { resolved } = mount('SubResource("ViewportTexture_1")', 'Root/Screen', 'Root/OtherViewport');
    expect(resolved()).toBeNull();
  });

  it('returns null for a non-ViewportTexture reference', () => {
    const { resolved } = mount('SubResource("Atlas_1")', 'Root/Screen', 'Root/SubViewport');
    expect(resolved()).toBeNull();
  });

  it('returns null for an absent reference', () => {
    const { resolved } = mount(undefined, 'Root/Screen', 'Root/SubViewport');
    expect(resolved()).toBeNull();
  });

  /**
   * Without a `NodePathProvider` there is no scene root to rebase against, so
   * the slot resolves to nothing rather than guessing a key.
   */
  it('returns null outside a NodePathProvider rather than throwing', () => {
    const { resolved } = mount('SubResource("ViewportTexture_1")', null, 'Root/SubViewport');
    expect(resolved()).toBeNull();
  });

  /** A ViewportTexture naming no viewport is inert, not an error. */
  it('returns null for an empty viewport_path', () => {
    const empty: TscnInternalResource = {
      id: 'Empty_1',
      type: 'ViewportTexture',
      data: { viewport_path: 'NodePath("")' },
    };
    const seen: ReturnType<typeof useViewportTextureSlot>[] = [];
    render(
      <ViewportTextureProvider>
        <NodePathProvider path="Root/Screen">
          <ConsumerWith resources={[empty]} onResolve={(r) => seen.push(r)} />
        </NodePathProvider>
      </ViewportTextureProvider>
    );
    expect(seen.at(-1)?.texture ?? null).toBeNull();
  });

  describe('a target sitting in an unrenderable pass cycle', () => {
    /**
     * `SubResource("ViewportTexture_1")` resolves to the registry key
     * `Root/SubViewport`, the path the cyclic pass registers under.
     */
    const VIEWPORT_TEXTURE_REF = 'SubResource("ViewportTexture_1")';
    const ATLAS_REF = 'SubResource("Atlas_1")';

    function mountCyclic(slotRef: string, consumerPath: string, publish: boolean) {
      const seen: ReturnType<typeof useViewportTextureSlot>[] = [];
      const texture = new THREE.Texture();
      render(
        <ViewportTextureProvider>
          <ViewportPassProvider>
            <CyclicRegistration />
            {publish ? (
              <ViewportTexturePublisher
                path="Root/SubViewport"
                entry={viewportEntry(texture, { x: 256, y: 256 })}
              />
            ) : null}
            <NodePathProvider path={consumerPath}>
              <Consumer slotRef={slotRef} onResolve={(r) => seen.push(r)} />
            </NodePathProvider>
          </ViewportPassProvider>
        </ViewportTextureProvider>
      );
      return { last: () => seen.at(-1)! };
    }

    /** Registers `Root/SubViewport` into a two-node cycle with `Root/Other`. */
    function CyclicRegistration() {
      const register = useRegisterViewportPass();
      useEffect(
        () => register('Root/Other', { dependsOn: ['Root/SubViewport'], render: () => {} }),
        [register]
      );
      useEffect(
        () => register('Root/SubViewport', { dependsOn: ['Root/Other'], render: () => {} }),
        [register]
      );
      return null;
    }

    it('keeps no decoding view filled for a target it cannot sample', () => {
      const { entry, retainers } = entryWithDecodingView();
      render(
        <ViewportTextureProvider>
          <ViewportPassProvider>
            <CyclicRegistration />
            <ViewportTexturePublisher path="Root/SubViewport" entry={entry} />
            <NodePathProvider path="Root/Screen">
              <ViewConsumer view="decoding" onResolve={() => {}} />
            </NodePathProvider>
          </ViewportPassProvider>
        </ViewportTextureProvider>
      );
      expect(retainers.count).toBe(0);
    });

    it('reports cyclic: true and a null texture even though an entry was published', () => {
      const { last } = mountCyclic(VIEWPORT_TEXTURE_REF, 'Root/Screen', true);
      expect(last().cyclic).toBe(true);
      expect(last().texture).toBeNull();
    });

    it('logs a warning naming the consuming node path', () => {
      warnCalls.length = 0;
      mountCyclic(VIEWPORT_TEXTURE_REF, 'Root/Screen', true);
      const matched = warnCalls.filter((args) => String(args[0]).includes('Root/Screen'));
      expect(matched.length).toBeGreaterThan(0);
    });

    /**
     * `ViewportPassProvider` warns for the cycle itself. This hook's own "falls
     * back" warning must not fire for a slot that names no ViewportTexture.
     */
    it('does not warn its own fallback message when the slot names no ViewportTexture at all', () => {
      warnCalls.length = 0;
      const { last } = mountCyclic(ATLAS_REF, 'Root/Screen', false);
      expect(last().cyclic).toBe(false);
      const matched = warnCalls.filter((args) => String(args[0]).includes('falls back'));
      expect(matched).toHaveLength(0);
    });
  });
});

describe('useViewportTextureSlot views', () => {
  /** Mounts a consumer of `view` at `Root/Screen` beside a target that publishes both views. */
  function mountView(view: ViewportTextureView) {
    const seen: ReturnType<typeof useViewportTextureSlot>[] = [];
    const { entry, retainers } = entryWithDecodingView();
    const { unmount } = render(
      <ViewportTextureProvider>
        <ViewportTexturePublisher path="Root/SubViewport" entry={entry} />
        <NodePathProvider path="Root/Screen">
          <ViewConsumer view={view} onResolve={(r) => seen.push(r)} />
        </NodePathProvider>
      </ViewportTextureProvider>
    );
    return { resolved: () => seen.at(-1)?.texture ?? null, entry, retainers, unmount };
  }

  /** A `source_color` slot reads Godot's sRGB view (`material_storage.cpp:1067,1073`). */
  it('resolves the decoding view and keeps it filled while mounted', () => {
    const { resolved, entry, retainers } = mountView('decoding');
    expect(resolved()).toBe(entry.decoding.texture);
    expect(retainers.count).toBe(1);
  });

  it('releases the decoding view on unmount', () => {
    const { retainers, unmount } = mountView('decoding');
    unmount();
    expect(retainers.count).toBe(0);
  });

  /**
   * The pass fills a copy only while it is retained, and a frame can run between a commit and its
   * passive effects. A layout effect runs inside the commit, so it sees what that frame would.
   */
  it('retains the decoding view in the commit that binds it, before any frame can draw', () => {
    const { entry, retainers } = entryWithDecodingView();
    const commits: { texture: THREE.Texture | null; retainers: number }[] = [];
    const tree = (withConsumer: boolean) => (
      <ViewportTextureProvider>
        <ViewportTexturePublisher path="Root/SubViewport" entry={entry} />
        <NodePathProvider path="Root/Screen">
          {withConsumer && (
            <CommitRecorder onCommit={(texture) => commits.push({ texture, retainers: retainers.count })} />
          )}
        </NodePathProvider>
      </ViewportTextureProvider>
    );
    const { rerender } = render(tree(false));
    rerender(tree(true));
    const bound = commits.filter((commit) => commit.texture === entry.decoding.texture);
    expect(bound.length).toBeGreaterThan(0);
    expect(bound.every((commit) => commit.retainers === 1)).toBe(true);
  });

  it('resolves the plain view without retaining the decoding view (edge case)', () => {
    const { resolved, entry, retainers } = mountView('plain');
    expect(resolved()).toBe(entry.plain.texture);
    expect(retainers.count).toBe(0);
  });

  it('keeps the plain view filled while mounted', () => {
    const { view, retainers } = countingView(new THREE.Texture());
    const entry = viewportEntry(new THREE.Texture(), { x: 256, y: 256 }, { plain: view });
    render(
      <ViewportTextureProvider>
        <ViewportTexturePublisher path="Root/SubViewport" entry={entry} />
        <NodePathProvider path="Root/Screen">
          <ViewConsumer view="plain" onResolve={() => {}} />
        </NodePathProvider>
      </ViewportTextureProvider>
    );
    expect(retainers.count).toBe(1);
  });
});

/** An entry whose decoding view counts the consumers that retain it. */
function entryWithDecodingView(): { entry: ViewportTextureEntry; retainers: { count: number } } {
  const { view, retainers } = countingView(new THREE.Texture());
  return { entry: viewportEntry(new THREE.Texture(), { x: 256, y: 256 }, { decoding: view }), retainers };
}

function ViewConsumer({
  view,
  onResolve,
}: {
  view: ViewportTextureView;
  onResolve: (result: ReturnType<typeof useViewportTextureSlot>) => void;
}) {
  onResolve(useViewportTextureSlot('SubResource("ViewportTexture_1")', RESOURCES, view));
  return null;
}

/** A decoding consumer that reports, inside each commit, the view it binds. */
function CommitRecorder({ onCommit }: { onCommit: (texture: THREE.Texture | null) => void }) {
  const { texture } = useViewportTextureSlot('SubResource("ViewportTexture_1")', RESOURCES, 'decoding');
  useLayoutEffect(() => {
    onCommit(texture);
  });
  return null;
}

function ConsumerWith({
  resources,
  onResolve,
}: {
  resources: TscnInternalResource[];
  onResolve: (result: ReturnType<typeof useViewportTextureSlot>) => void;
}) {
  onResolve(useViewportTextureSlot('SubResource("Empty_1")', resources, 'plain'));
  return null;
}
