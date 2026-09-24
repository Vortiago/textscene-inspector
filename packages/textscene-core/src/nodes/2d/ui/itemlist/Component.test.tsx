/**
 * `<ItemList>` render contract: the panel, then each row's icon and label as
 * `packItemListRows` packs them. Structure, tint and render order only: the
 * golden images own the pixels.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { ItemList } from './Component';
import { ICON_MODE_LEFT, ITEM_LIST_THEME_FONT_KEY, shapeItemListText } from './nativeSolver';
import type { ItemListProperties } from './types';

const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
const ICON_PATH = 'res://icon.png';
const SCOPE = {
  externalResources: [{ id: '1', type: 'Texture2D', path: ICON_PATH }],
  internalResources: [],
};

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(properties: Partial<ItemListProperties>, rtl = false, iconSlots = {}): SolveNode {
  const node: TscnNode = {
    name: 'MyItemList',
    type: 'ItemList',
    children: [],
    properties: { name: 'MyItemList', items: [], ...properties } as ItemListProperties,
  };
  return { ...emptySolveNode(), path: 'MyItemList', node, resources: SCOPE, rtl, textureSlots: iconSlots };
}

/** A `<StyleBoxQuad>` mesh: the only kind carrying a `color` vertex attribute. */
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

/** `<ControlQuad>` (an item's icon): a `PlaneGeometry`, identified by its own `.parameters.width`. */
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

async function renderWithIconLoaded(properties: Partial<ItemListProperties>, rtl = false) {
  const fake = createFakeResourceLoader();
  fake.textures.seed(ICON_PATH, fakeTexture(16, 16));
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider externalResources={[{ id: '1', type: 'Texture2D', path: ICON_PATH }]}>
        <ItemList
          {...painterEnv()}
          solveNode={solveNode(properties, rtl, { item_0: { x: 16, y: 16 } })}
          rect={RECT}
          renderOrder={0}
        />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

/** Sums `position.x` up the parent chain: the control-relative x a mesh actually lands at. */
function absoluteX(object: THREE.Object3D): number {
  let x = 0;
  for (let node: THREE.Object3D | null = object; node; node = node.parent) x += node.position.x;
  return x;
}

/** The same, down the y axis: negated back into Godot's own downward-y. */
function absoluteY(object: THREE.Object3D): number {
  let y = 0;
  for (let node: THREE.Object3D | null = object; node; node = node.parent) y += node.position.y;
  return -y;
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

describe('<ItemList> — RTL', () => {
  // rect.w 200, panel margin 4, h_separation/icon_margin 4, a 16x16 icon and
  // fixed_column_width 100 (so rect_cache.size.width is 100 + h_separation).
  const RTL_ITEMS: Partial<ItemListProperties> = {
    items: [{ text: 'Sword', icon: 'ExtResource("1")' }],
    fixedColumnWidth: 100,
  };

  // item_list.cpp:1582-1584: the icon draws at 4 + h_separation/2 = 6 under
  // LTR, mirrored to `200 - 6 - 16` under RTL.
  it('mirrors the row icon inside the control own width', async () => {
    const ltr = await renderWithIconLoaded(RTL_ITEMS);
    const rtl = await renderWithIconLoaded(RTL_ITEMS, true);
    // `<ControlQuad>`'s own mesh is centred on its quad, so 16/2 sits on top.
    expect(absoluteX(findIconMeshes(ltr.scene)[0]!)).toBeCloseTo(6 + 8, 5);
    expect(absoluteX(findIconMeshes(rtl.scene)[0]!)).toBeCloseTo(178 + 8, 5);
  });

  // item_list.cpp:1664-1668: the LTR pen is 4 + (16 + 4) + 2 = 26; the RTL
  // pen is `200 - 104 + 16 - 26 + 4` = 90, and the line is then right-aligned
  // inside its own `104 - 22` wide box (text_paragraph.cpp:916-921).
  it('moves the row label to Godot own RTL pen, right-aligned in its box', async () => {
    const node = solveNode(RTL_ITEMS, false, { item_0: { x: 16, y: 16 } });
    const shaped = shapeItemListText({
      text: 'Sword',
      fontSizePx: nativeTheme(1).fontSize,
      fontMetrics: resolveNodeFontMetrics(node, ITEM_LIST_THEME_FONT_KEY),
      iconMode: ICON_MODE_LEFT,
      maxTextLines: 1,
      fixedColumnWidth: 100,
    })!;
    const ltr = await renderWithIconLoaded(RTL_ITEMS);
    const rtl = await renderWithIconLoaded(RTL_ITEMS, true);
    expect(absoluteX(findTextMeshes(ltr.scene)[0]!)).toBeCloseTo(26, 5);
    expect(absoluteX(findTextMeshes(rtl.scene)[0]!)).toBeCloseTo(90 + (82 - shaped.widthPx), 5);
  });
});

describe('<ItemList> — row-relative vertical placement', () => {
  // item_list.cpp:1556 centres the icon against the row's own height. An
  // icon-only row is `16 + v_separation` tall, so the icon sits 2px down from
  // the row top and 4 + 0 + 2 from the list's own top.
  it('centres a row icon against the row height, not its y position', async () => {
    const renderer = await renderWithIconLoaded({
      items: [{ icon: 'ExtResource("1")' }],
      fixedIconSize: { x: 16, y: 16 },
    });
    expect(absoluteY(findIconMeshes(renderer.scene)[0]!)).toBeCloseTo(6 + 8, 5);
  });

  // item_list.cpp:1649 centres the label against the same height. A text-only
  // row is `text height + v_separation` tall, so the pen sits exactly
  // `v_separation / 2` down whatever the font measures.
  it('centres a row label against the row height, not its y position', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ItemList {...painterEnv()} solveNode={solveNode({ items: [{ text: 'Sword' }] })} rect={RECT} renderOrder={0} />
    );
    expect(absoluteY(findTextMeshes(renderer.scene)[0]!.parent!)).toBeCloseTo(4 + 2, 5);
  });
});
