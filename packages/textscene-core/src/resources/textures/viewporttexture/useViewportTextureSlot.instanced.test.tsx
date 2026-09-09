/**
 * A `%Name` claimed INSIDE an instanced sub-scene, seen from both sides of the
 * owner boundary.
 *
 * `_acquire_unique_name_in_owner` registers the name on the node's OWNER
 * (node.cpp:2222-2234) — the sub-scene root for everything the sub-scene
 * declares — and `get_node` consults the caller's own table, else its owner's
 * (node.cpp:1930-1938). So a consumer inside the instance resolves `%Panel`
 * through the sub-scene root, and an outer consumer never sees that table.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';

import type { TscnNode } from '../../../parser/types';
import { TscnParser } from '../../../parser/TscnParser';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import { HierarchyProvider } from '../../../r3f/contexts/HierarchyContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import {
  ViewportTextureProvider,
  usePublishViewportTexture,
  type ViewportTextureEntry,
} from '../../../r3f/contexts/ViewportTextureContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { setLogAdapter } from '../../../logger';
import { useViewportTextureSlot } from './useViewportTextureSlot';

const main = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://hud.tscn" id="1"]

[sub_resource type="ViewportTexture" id="ViewportTexture_outer"]
viewport_path = NodePath("%View")

[node name="Root" type="Node2D"]

[node name="HudInstance" parent="." instance=ExtResource("1")]

[node name="Screen" type="Sprite2D" parent="."]
texture = SubResource("ViewportTexture_outer")
`);

const hud = new TscnParser().parse(`[gd_scene format=3]

[sub_resource type="ViewportTexture" id="ViewportTexture_1"]
viewport_path = NodePath("%Panel/View")

[node name="Hud" type="Node2D"]

[node name="Panel" type="Node2D" parent="."]
unique_name_in_owner = true

[node name="View" type="SubViewport" parent="Panel"]
unique_name_in_owner = true

[node name="Sprite" type="Sprite2D" parent="."]
texture = SubResource("ViewportTexture_1")
`);

const graph = createSceneGraphFromTscnScene(main);
const viewNode: TscnNode = hud.nodes[0]!.children[0]!.children[0]!;
const VIEW_PATH = 'Root/HudInstance/Panel/View';

/** The sub-scene's `View`, publishing at its composed live path. */
function Publisher({ entry }: { entry: ViewportTextureEntry }) {
  usePublishViewportTexture(viewNode, VIEW_PATH, entry);
  return null;
}

function Consumer({
  slotRef,
  resources,
  onResolve,
}: {
  slotRef: string;
  resources: typeof hud.internalResources;
  onResolve: (t: THREE.Texture | null) => void;
}) {
  onResolve(useViewportTextureSlot(slotRef, resources));
  return null;
}

function mount(consumerPath: string, slotRef: string, resources: typeof hud.internalResources) {
  const fake = createFakeResourceLoader();
  fake.scenes.seed('res://hud.tscn', hud);
  const entry: ViewportTextureEntry = { texture: new THREE.Texture(), size: { x: 8, y: 8 } };
  const seen: (THREE.Texture | null)[] = [];
  render(
    <ResourceLoaderProvider loader={fake.loader}>
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <ViewportTextureProvider>
          <Publisher entry={entry} />
          <NodePathProvider path={consumerPath}>
            <Consumer slotRef={slotRef} resources={resources} onResolve={(t) => seen.push(t)} />
          </NodePathProvider>
        </ViewportTextureProvider>
      </HierarchyProvider>
    </ResourceLoaderProvider>
  );
  return { resolved: () => seen.at(-1) ?? null, texture: entry.texture };
}

describe('a %Name claimed inside an instanced sub-scene', () => {
  const warn = vi.fn();
  afterEach(() => {
    warn.mockClear();
    setLogAdapter(null);
  });

  it('resolves for a consumer inside the instance, without an unclaimed-alias warning', () => {
    setLogAdapter({ trace() {}, debug() {}, info() {}, warn, error() {} });
    const { resolved, texture } = mount(
      'Root/HudInstance/Sprite',
      'SubResource("ViewportTexture_1")',
      hud.internalResources
    );
    expect(warn).not.toHaveBeenCalled();
    expect(resolved()).toBe(texture);
  });

  it('is invisible to an outer consumer, which the sub-scene root does not own', () => {
    setLogAdapter({ trace() {}, debug() {}, info() {}, warn, error() {} });
    const { resolved } = mount(
      'Root/Screen',
      'SubResource("ViewportTexture_outer")',
      main.internalResources
    );
    expect(resolved()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('%View');
  });
});
