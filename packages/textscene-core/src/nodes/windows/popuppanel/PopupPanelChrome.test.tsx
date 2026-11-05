/**
 * PopupPanel's internal Panel: the `panel` StyleBox across the window, inset by the room its shadow
 * takes (`popup.cpp:315-344`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { flatStyleBox, type StyleBoxFlatData } from '../../../r3f/controls/native/styleBoxFlat';
import { painterEnv } from '../../../r3f/controls/native/testing/painterProps';
import { controlNode, solveNode } from '../../../r3f/controls/native/testing/solveNode';
import { PopupPanelChrome } from './PopupPanelChrome';

const WINDOW_RECT = { x: 0, y: 0, w: 300, h: 200 };
// Without anti-aliasing the fill's bounds are the panel's own rect, with no feather around it.
const PLAIN_PANEL: StyleBoxFlatData = { ...flatStyleBox({ r: 1, g: 1, b: 1, a: 1 }), antiAliased: false };

function popupPanel(panel: StyleBoxFlatData): SolveNode {
  return {
    ...solveNode(),
    path: 'Pop',
    node: controlNode('Pop', 'PopupPanel', { name: 'Pop' }),
    styleBoxes: { panel },
  };
}

/** Where the panel's one mesh starts drawing, and what it covers with its shadow, in Godot pixels. */
async function panelMesh(panel: StyleBoxFlatData) {
  const renderer = await ReactThreeTestRenderer.create(
    <PopupPanelChrome {...painterEnv()} solveNode={popupPanel(panel)} rect={WINDOW_RECT} renderOrder={0} />
  );
  const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(mesh);
  // `+ 0` folds the -0 a negated zero leaves.
  return {
    origin: { x: mesh.matrixWorld.elements[12]!, y: -mesh.matrixWorld.elements[13]! + 0 },
    covers: { x: box.min.x, y: -box.max.y + 0, w: box.max.x - box.min.x, h: box.max.y - box.min.y },
  };
}

describe('<PopupPanelChrome>', () => {
  it('draws the panel across the whole window when it casts no shadow', async () => {
    expect(await panelMesh(PLAIN_PANEL)).toEqual({
      origin: { x: 0, y: 0 },
      covers: { x: 0, y: 0, w: 300, h: 200 },
    });
  });

  it('insets the panel by the room its shadow takes, which the shadow then fills', async () => {
    const panel = { ...PLAIN_PANEL, shadowSize: 8, shadowOffset: { x: 2, y: 3 } };
    // left 8 - 2 and top 8 - 3 (`popup.cpp:339-342`). The shadow grows the 284x184 panel by 8 on
    // each side and moves it by (2, 3), back onto the window's edges.
    expect(await panelMesh(panel)).toEqual({
      origin: { x: 6, y: 5 },
      covers: { x: 0, y: 0, w: 300, h: 200 },
    });
  });
});
