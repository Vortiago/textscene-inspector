/**
 * A Label reads the `normal` StyleBox of its Theme (`label.cpp:141-142,472-512,591-616,757-775,983`):
 * the box adds its minimum size, narrows the shaping width, offsets the lines and draws under the text.
 * Hand numbers use OpenSans at size 16: font height 23, 'AB' shaped 22 wide (see `nativeSolver.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { drawnStyleBox } from '../../../../r3f/controls/native/testing/drawnStyleBox';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { shapeText } from '../../../../r3f/controls/native/text/textLayout';
import { Label } from './Component';
import { labelMinimumSize, labelShapingWidthPx, layoutLabelLines } from './nativeSolver';
import type { LabelProperties } from './types';

/** Margins 10 left, 6 top, 14 right, 4 bottom: a different number on each side, so a swapped side fails. */
const MARGINS = {
  content_margin_left: '10',
  content_margin_top: '6',
  content_margin_right: '14',
  content_margin_bottom: '4',
};
const BOX = drawnStyleBox(MARGINS);
const MARGIN = { left: 10, top: 6, right: 14, bottom: 4 };

function label(props: Partial<LabelProperties>, withBox = true): SolveNode {
  return {
    ...emptySolveNode(),
    path: 'L',
    node: controlNode('L', 'Label', { name: 'L', ...props }),
    styleBoxes: withBox ? { normal: BOX } : {},
  };
}

const ctx = { theme: nativeTheme(1), measureText, combinedMinimumSize: () => ({ x: 0, y: 0 }) };

describe('Label minimum size with a normal box (label.cpp:983-996)', () => {
  it('adds the box minimum to the text width and height', () => {
    expect(labelMinimumSize(label({ text: 'AB' }, false), ctx)).toEqual({ x: 22, y: 23 });
    expect(labelMinimumSize(label({ text: 'AB' }), ctx)).toEqual({ x: 22 + 24, y: 23 + 10 });
  });

  it('adds the box minimum to the empty-text height and its width of 1', () => {
    expect(labelMinimumSize(label({}), ctx)).toEqual({ x: 1 + 24, y: 23 + 10 });
  });

  it('adds the box minimum to the width of 1 that autowrap leaves', () => {
    expect(labelMinimumSize(label({ text: 'AB', autowrapMode: 3 }), ctx).x).toBe(1 + 24);
  });
});

describe('Label shaping width with a normal box (label.cpp:141-142)', () => {
  it('truncates the width less the box margins', () => {
    expect(labelShapingWidthPx(100.7, MARGIN)).toBe(76);
    expect(labelShapingWidthPx(100.7)).toBe(100);
  });
});

describe('Label line placement with a normal box (label.cpp:491-512,591-616)', () => {
  const layout = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: 0, lineSpacingPx: 3 });
  const lineWidth = layout.lines[0]!.widthPx;
  const place = (horizontal: number | undefined, vertical: number | undefined) =>
    layoutLabelLines(layout, 200, 100, horizontal, vertical, undefined, { contentMargin: MARGIN })[0]!;

  it('starts a left-aligned line at the left margin and the top at the top margin', () => {
    expect(place(0, 0)).toMatchObject({ x: 10, y: 6 });
  });

  it('ends a right-aligned line at the right margin', () => {
    expect(place(2, 0).x).toBe(Math.trunc(200 - 14 - lineWidth));
  });

  it('ignores the margins when it centres a line horizontally', () => {
    expect(place(1, 0).x).toBe(Math.trunc(Math.trunc(200 - lineWidth) / 2));
  });

  it('centres vertically over the height less both vertical margins, then offsets by the top margin', () => {
    const content = layout.heightPx - 3;
    expect(place(0, 1).y).toBe(6 + Math.trunc((100 - (content + 10)) / 2));
  });
});

describe('<Label> with a normal box', () => {
  it('draws the box as a mesh beside the text mesh', async () => {
    const withBox = await ReactThreeTestRenderer.create(
      <Label
        {...painterEnv()}
        solveNode={label({ text: 'AB' })}
        rect={{ x: 0, y: 0, w: 200, h: 100 }}
        renderOrder={5}
      />
    );
    const without = await ReactThreeTestRenderer.create(
      <Label
        {...painterEnv()}
        solveNode={label({ text: 'AB' }, false)}
        rect={{ x: 0, y: 0, w: 200, h: 100 }}
        renderOrder={5}
      />
    );
    const meshes = (r: typeof withBox) => r.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes(withBox)).toHaveLength(meshes(without).length + 1);
  });
});
