/**
 * PopupMenu's internal Controls: the panel under the rows, and the vertical bar that shows only for
 * items taller than the scroll container (`scroll_container.cpp:592-593`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { flatStyleBox, type StyleBoxFlatData } from '../../../r3f/controls/native/styleBoxFlat';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import { painterEnv } from '../../../r3f/controls/native/testing/painterProps';
import { PopupMenuChrome } from './PopupMenuChrome';
import { many, menu, text } from './testing/menuNode';

const WINDOW_RECT = { x: 0, y: 0, w: 100, h: 100 };
// Without anti-aliasing a fill's bounds are its own rect, with no feather around it.
const MARGIN = 4;
const PLAIN_PANEL: StyleBoxFlatData = {
  ...flatStyleBox(
    { r: 1, g: 1, b: 1, a: 1 },
    {
      contentMargin: { left: MARGIN, top: MARGIN, right: MARGIN, bottom: MARGIN },
    }
  ),
  antiAliased: false,
};
// The bar's track is 8 px wide, and its anti-aliasing feathers half a pixel past each side.
const BAR_MESH_WIDTH = 8 + 1;

/** The bounds of every mesh the painter draws, in Godot pixels. */
async function meshBounds(window: SolveNode) {
  const renderer = await ReactThreeTestRenderer.create(
    <PopupMenuChrome
      {...painterEnv()}
      measureText={measureText}
      solveNode={window}
      rect={WINDOW_RECT}
      renderOrder={0}
    />
  );
  return renderer.scene.findAllByType('Mesh').map(({ instance }) => {
    const mesh = instance as THREE.Mesh;
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    return {
      x: box.min.x, // `0 -`, not a bare negation: it turns -0 into 0 for `toEqual`.
      y: 0 - box.max.y,
      w: box.max.x - box.min.x,
      h: box.max.y - box.min.y,
    };
  });
}

const withPanel = (window: SolveNode): SolveNode => ({
  ...window,
  styleBoxes: { ...window.styleBoxes, panel: PLAIN_PANEL },
});

describe('<PopupMenuChrome>', () => {
  it('draws the panel across the whole window', async () => {
    const [panel] = await meshBounds(withPanel(menu(text('Open'))));
    expect(panel).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it('draws no scroll bar for items that fit', async () => {
    const bounds = await meshBounds(withPanel(menu(text('Open', 'Save'))));
    expect(bounds.filter(({ w }) => w === BAR_MESH_WIDTH)).toEqual([]);
  });

  it('draws the scroll bar track down the right edge for items taller than the window', async () => {
    const bounds = await meshBounds(withPanel(menu(many(30))));
    expect(bounds.filter(({ w }) => w === BAR_MESH_WIDTH)[0]).toMatchObject({
      x: 88 - 0.5,
      y: MARGIN - 0.5,
      h: 92 + 1,
    });
  });

  it('moves the scroll bar to the left edge in right-to-left layout', async () => {
    const bounds = await meshBounds(withPanel(menu(many(30), {}, true)));
    expect(bounds.filter(({ w }) => w === BAR_MESH_WIDTH)[0]!.x).toBe(MARGIN - 0.5);
  });

  it('builds no row below the window, so a long menu costs what its visible rows cost', async () => {
    const thirty = await meshBounds(withPanel(menu(many(30))));
    const twoHundred = await meshBounds(withPanel(menu(many(200))));
    expect(twoHundred).toHaveLength(thirty.length);
  });
});
