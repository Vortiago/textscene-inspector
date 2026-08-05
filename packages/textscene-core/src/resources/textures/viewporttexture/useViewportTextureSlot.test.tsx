/**
 * The consumer half of the ViewportTexture seam: a texture slot that names a
 * node instead of a file.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
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
import {
  ViewportTextureProvider,
  useRegisterViewportTexture,
} from '../../../r3f/contexts/ViewportTextureContext';
import {
  ViewportPassProvider,
  useRegisterViewportPass,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import { isViewportTextureRef, useViewportTextureSlot } from './useViewportTextureSlot';

const viewportTexture: TscnInternalResource = {
  id: 'ViewportTexture_1',
  type: 'ViewportTexture',
  data: { id: 'ViewportTexture_1', viewport_path: 'NodePath("SubViewport")' },
};

const atlasTexture: TscnInternalResource = {
  id: 'Atlas_1',
  type: 'AtlasTexture',
  data: { id: 'Atlas_1', atlas: 'ExtResource("1")' },
};

const RESOURCES = [viewportTexture, atlasTexture];

/** Publishes `texture` at `path` for as long as it is mounted. */
function Publisher({ path, texture }: { path: string; texture: THREE.Texture }) {
  const registerViewportTexture = useRegisterViewportTexture();
  useEffect(
    () => registerViewportTexture(path, { texture, size: { x: 256, y: 256 } }),
    [registerViewportTexture, path, texture]
  );
  return null;
}

function Consumer({
  slotRef,
  onResolve,
}: {
  slotRef: string | undefined;
  onResolve: (result: ReturnType<typeof useViewportTextureSlot>) => void;
}) {
  onResolve(useViewportTextureSlot(slotRef, RESOURCES));
  return null;
}

/** Mounts a consumer at `consumerPath`, optionally with a publisher. */
function mount(slotRef: string | undefined, consumerPath: string | null, publishAt?: string) {
  const seen: ReturnType<typeof useViewportTextureSlot>[] = [];
  const texture = new THREE.Texture();
  const consumer = <Consumer slotRef={slotRef} onResolve={(r) => seen.push(r)} />;
  render(
    <ViewportTextureProvider>
      {publishAt ? <Publisher path={publishAt} texture={texture} /> : null}
      {consumerPath === null ? (
        consumer
      ) : (
        <NodePathProvider path={consumerPath}>{consumer}</NodePathProvider>
      )}
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
   * `viewport_path` counts from the LOCAL SCENE ROOT
   * (`ViewportTexture::_setup_local_to_scene` resolves it with
   * `p_loc_scene->get_node_or_null(path)`), while the registry is keyed by the
   * dispatcher-absolute path. A consumer deep in the tree must still find a
   * sub-viewport that is a child of the root, not of itself.
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
   * A target that has not been published yet is null, never a placeholder
   * texture — the publisher's effect runs after mount, so every consumer sees
   * null on its first render and re-renders when the reactive map updates.
   */
  it('returns null until the sub-viewport publishes', () => {
    const { resolved } = mount('SubResource("ViewportTexture_1")', 'Root/Screen');
    expect(resolved()).toBeNull();
  });

  it('returns null when the named viewport is not the one that published', () => {
    const { resolved } = mount(
      'SubResource("ViewportTexture_1")',
      'Root/Screen',
      'Root/OtherViewport'
    );
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
      data: { id: 'Empty_1', viewport_path: 'NodePath("")' },
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
     * `viewport_path` counts from the local scene root, so
     * `SubResource("ViewportTexture_1")` above resolves to the registry key
     * `Root/SubViewport` — the exact path a cyclic pass registers under.
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
            {publish ? <Publisher path="Root/SubViewport" texture={texture} /> : null}
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
      useEffect(() => register('Root/Other', { dependsOn: ['Root/SubViewport'], render: () => {} }), [register]);
      useEffect(
        () => register('Root/SubViewport', { dependsOn: ['Root/Other'], render: () => {} }),
        [register]
      );
      return null;
    }

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
     * `CyclicRegistration` alone makes `ViewportPassProvider`'s own
     * cycle-detection effect warn (unrelated to this hook) — the assertion
     * here is specifically that THIS hook's own "falls back" warning, keyed
     * off a real ViewportTexture resolution, does not additionally fire for
     * a slot that never named one.
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

function ConsumerWith({
  resources,
  onResolve,
}: {
  resources: TscnInternalResource[];
  onResolve: (result: ReturnType<typeof useViewportTextureSlot>) => void;
}) {
  onResolve(useViewportTextureSlot('SubResource("Empty_1")', resources));
  return null;
}
