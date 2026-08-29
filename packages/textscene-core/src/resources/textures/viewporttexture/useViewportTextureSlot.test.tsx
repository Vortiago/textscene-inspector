/**
 * The consumer half of the ViewportTexture seam: a texture slot that names a
 * node instead of a file.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import * as THREE from 'three';

import type { TscnInternalResource } from '../../../parser/types';
import { TscnParser } from '../../../parser/TscnParser';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import { HierarchyProvider } from '../../../r3f/contexts/HierarchyContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import {
  ViewportTextureProvider,
  useRegisterViewportTexture,
} from '../../../r3f/contexts/ViewportTextureContext';
import { isViewportTextureRef, useViewportTextureSlot } from './useViewportTextureSlot';

const viewportTexture: TscnInternalResource = {
  id: 'ViewportTexture_1',
  type: 'ViewportTexture',
  data: { id: 'ViewportTexture_1', viewport_path: 'NodePath("SubViewport")' },
};

/** A `%Name` JUMP followed by a descent, which only a claim table can resolve. */
const aliasViewportTexture: TscnInternalResource = {
  id: 'ViewportTexture_2',
  type: 'ViewportTexture',
  data: { id: 'ViewportTexture_2', viewport_path: 'NodePath("%Hud/CombinedViewport")' },
};

const atlasTexture: TscnInternalResource = {
  id: 'Atlas_1',
  type: 'AtlasTexture',
  data: { id: 'Atlas_1', atlas: 'ExtResource("1")' },
};

const RESOURCES = [viewportTexture, aliasViewportTexture, atlasTexture];

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
  onResolve: (t: THREE.Texture | null) => void;
}) {
  onResolve(useViewportTextureSlot(slotRef, RESOURCES));
  return null;
}

/** Mounts a consumer at `consumerPath`, optionally with a publisher. */
function mount(slotRef: string | undefined, consumerPath: string | null, publishAt?: string) {
  const seen: (THREE.Texture | null)[] = [];
  const texture = new THREE.Texture();
  const consumer = <Consumer slotRef={slotRef} onResolve={(t) => seen.push(t)} />;
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
  return { resolved: () => seen.at(-1) ?? null, texture };
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
   * `get_node_or_null` treats `%Hud` as a jump to the claimant and descends from
   * there, so the key is the claimant's own path with the rest appended.
   * Concatenating the literal built `Root/%Hud/CombinedViewport`, which no
   * publisher ever registers: the alias a viewport publishes for itself is a
   * single segment.
   */
  describe('a compound %Name viewport path', () => {
    const scene = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="UI" type="Node3D" parent="."]

[node name="Hud" type="Node3D" parent="UI"]
unique_name_in_owner = true

[node name="CombinedViewport" type="SubViewport" parent="UI/Hud"]

[node name="Screen" type="MeshInstance3D" parent="."]
`;

    /** The same mount, with the scene the claim table is resolved against. */
    function mountInScene(publishAt: string) {
      const graph = createSceneGraphFromTscnScene({ nodes: new TscnParser().parse(scene).nodes });
      const seen: (THREE.Texture | null)[] = [];
      const texture = new THREE.Texture();
      render(
        <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
          <ViewportTextureProvider>
            <Publisher path={publishAt} texture={texture} />
            <NodePathProvider path="Root/Screen">
              <Consumer
                slotRef='SubResource("ViewportTexture_2")'
                onResolve={(t) => seen.push(t)}
              />
            </NodePathProvider>
          </ViewportTextureProvider>
        </HierarchyProvider>
      );
      return { resolved: () => seen.at(-1) ?? null, texture };
    }

    it('descends from the claimant to the viewport that published there', () => {
      const { resolved, texture } = mountInScene('Root/UI/Hud/CombinedViewport');
      expect(resolved()).toBe(texture);
    });

    it('does not match the literal join of the alias onto the root', () => {
      const { resolved } = mountInScene('Root/%Hud/CombinedViewport');
      expect(resolved()).toBeNull();
    });
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
    const seen: (THREE.Texture | null)[] = [];
    render(
      <ViewportTextureProvider>
        <NodePathProvider path="Root/Screen">
          <ConsumerWith resources={[empty]} onResolve={(t) => seen.push(t)} />
        </NodePathProvider>
      </ViewportTextureProvider>
    );
    expect(seen.at(-1) ?? null).toBeNull();
  });
});

function ConsumerWith({
  resources,
  onResolve,
}: {
  resources: TscnInternalResource[];
  onResolve: (t: THREE.Texture | null) => void;
}) {
  onResolve(useViewportTextureSlot('SubResource("Empty_1")', resources));
  return null;
}
