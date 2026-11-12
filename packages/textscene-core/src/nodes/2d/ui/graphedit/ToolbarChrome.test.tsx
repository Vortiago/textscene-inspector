/** `<GraphEditToolbarChrome>` draws each button with the box of its draw state, where disabled wins over pressed (`button.cpp:303-312`). */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { wholeKeySlot } from '../../../../r3f/canvasItemState';
import { GraphEditToolbarChrome } from './ToolbarChrome';
import type { GraphEditToolbar, ToolbarItem } from './toolbar';
import { graphEditToolbarTheme } from './toolbarTheme';
import { graphEditUnder } from './toolbarTheme.testkit';

const THEME = nativeTheme(1);

function toolbarOf(item: Pick<ToolbarItem, 'pressed' | 'disabled'>): GraphEditToolbar {
  return {
    panelRect: { x: 10, y: 10, w: 32, h: 28 },
    contentRect: { x: 4, y: 2, w: 24, h: 24 },
    items: [{ id: 'toggle_grid', kind: 'button', rect: { x: 4, y: 2, w: 24, h: 24 }, ...item }],
  };
}

/** The meshes of the chrome's boxes: the panel, and each button box that paints. */
async function boxMeshes(item: Pick<ToolbarItem, 'pressed' | 'disabled'>): Promise<THREE.Mesh[]> {
  const { tint } = painterEnv();
  const renderer = await ReactThreeTestRenderer.create(
    <GraphEditToolbarChrome
      toolbar={toolbarOf(item)}
      items={graphEditToolbarTheme(graphEditUnder(), THEME)}
      icons={{}}
      theme={THEME}
      tint={tint}
      text={{ zoomLabel: '100%', snappingDistance: '20' }}
      snappingArrows={{ up: 'normal', down: 'normal' }}
      shape={() => {
        throw new Error('expected no text to shape, got a request');
      }}
      rtl={false}
      slot={wholeKeySlot(9)}
    />
  );
  return renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

describe('<GraphEditToolbarChrome> button boxes (FlatButton, default_theme.cpp:366-375)', () => {
  it('draws the pressed box under a pressed toggle, beside the panel', async () => {
    expect(await boxMeshes({ pressed: true, disabled: false })).toHaveLength(2);
  });

  it('draws no box under an unpressed toggle, since the normal box is empty', async () => {
    expect(await boxMeshes({ pressed: false, disabled: false })).toHaveLength(1);
  });

  it('draws no box under a disabled and pressed toggle, since disabled wins and its box is empty', async () => {
    expect(await boxMeshes({ pressed: true, disabled: true })).toHaveLength(1);
  });
});
