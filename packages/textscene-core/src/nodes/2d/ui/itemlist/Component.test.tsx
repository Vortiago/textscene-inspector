/**
 * `<ItemList>` render contract — the panel StyleBox, then each row's icon
 * and label, packed per `packItemListRows`. Structure/tint/render-order
 * assertions only (pixels are a golden-image concern via `pnpm ref:godot`,
 * not this suite).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { ItemList } from './Component';
import type { ItemListProperties } from './types';

const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
const ICON_PATH = 'res://icon.png';
const SCOPE = {
  externalResources: [{ id: '1', type: 'Texture2D', path: ICON_PATH }],
  internalResources: [],
};

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(properties: Partial<ItemListProperties>): SolveNode {
  const node: TscnNode = {
    name: 'MyItemList',
    type: 'ItemList',
    children: [],
    properties: { name: 'MyItemList', items: [], ...properties } as ItemListProperties,
  };
  return { ...emptySolveNode(), path: 'MyItemList', node, resources: SCOPE };
}

/** A `<StyleBoxQuad>` mesh — the only kind carrying a `color` vertex attribute. */
function findChromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/** `<TextRun>`'s mesh carries the MSDF `ShaderMaterial` (`uColor`/`uOpacity` uniforms). */
function findTextMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

/** `<ControlQuad>` (an item's icon) — a `PlaneGeometry`, identified by its own `.parameters.width`. */
function findIconMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
}

function fakeTexture(w: number, h: number): THREE.Texture {
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: w, height: h };
  return tex;
}

async function renderWithIconLoaded(properties: Partial<ItemListProperties>) {
  const fake = createFakeResourceLoader();
  fake.textures.seed(ICON_PATH, fakeTexture(16, 16));
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider externalResources={[{ id: '1', type: 'Texture2D', path: ICON_PATH }]}>
        <ItemList {...painterEnv()} solveNode={solveNode(properties)} rect={RECT} renderOrder={0} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('<ItemList> — panel + rows', () => {
  it('draws exactly one panel chrome mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ItemList {...painterEnv()} solveNode={solveNode({ items: [{ text: 'Sword' }] })} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMeshes(renderer.scene).length).toBe(1);
  });

  it('draws one text mesh per item that has text', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ItemList
        {...painterEnv()}
        solveNode={solveNode({ items: [{ text: 'Sword' }, { text: '' }, { text: 'Shield' }] })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findTextMeshes(renderer.scene).length).toBe(2);
  });

  it('draws no icon mesh at all when no item names one', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ItemList {...painterEnv()} solveNode={solveNode({ items: [{ text: 'Sword' }] })} rect={RECT} renderOrder={0} />
    );
    expect(findIconMeshes(renderer.scene).length).toBe(0);
  });

  it('draws the resolved icon texture once it loads', async () => {
    const renderer = await renderWithIconLoaded({ items: [{ text: 'Sword', icon: 'ExtResource("1")' }] });
    const meshes = findIconMeshes(renderer.scene);
    expect(meshes.length).toBe(1);
    expect((meshes[0]!.material as THREE.MeshBasicMaterial).map).not.toBeNull();
  });

  it('dims a disabled item\'s text below a non-disabled one\'s', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ItemList
        {...painterEnv()}
        solveNode={solveNode({ items: [{ text: 'Sword' }, { text: 'Cursed Blade', disabled: true }] })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const [normal, disabled] = findTextMeshes(renderer.scene);
    const normalOpacity = (normal!.material as THREE.ShaderMaterial).uniforms.uOpacity!.value;
    const disabledOpacity = (disabled!.material as THREE.ShaderMaterial).uniforms.uOpacity!.value;
    expect(disabledOpacity).toBeLessThan(normalOpacity);
  });

  it('forwards renderOrder to the panel chrome and every text mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ItemList
        {...painterEnv()}
        solveNode={solveNode({ items: [{ text: 'Sword' }] })}
        rect={RECT}
        renderOrder={5}
      />
    );
    expect(findChromeMeshes(renderer.scene)[0]!.renderOrder).toBe(5);
    expect(findTextMeshes(renderer.scene)[0]!.renderOrder).toBe(5);
  });
});

describe('<ItemList> — row packing', () => {
  it('places a second column item to the right of the first, under max_columns=2', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ItemList
        {...painterEnv()}
        solveNode={solveNode({ items: [{ text: 'A' }, { text: 'B' }], maxColumns: 2, sameColumnWidth: true, fixedColumnWidth: 40 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const textMeshes = findTextMeshes(renderer.scene);
    expect(textMeshes.length).toBe(2);
    // mesh -> its own text-offset group -> the row's own outer group.
    const rowX = (mesh: THREE.Mesh) => (mesh.parent!.parent as THREE.Object3D).position.x;
    const xs = textMeshes.map(rowX).sort((a, b) => a - b);
    expect(xs[1]).toBeGreaterThan(xs[0]!);
  });

  it('wraps to a new row once max_columns=1 (single column)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ItemList
        {...painterEnv()}
        solveNode={solveNode({ items: [{ text: 'A' }, { text: 'B' }], maxColumns: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findTextMeshes(renderer.scene).length).toBe(2);
  });
});
