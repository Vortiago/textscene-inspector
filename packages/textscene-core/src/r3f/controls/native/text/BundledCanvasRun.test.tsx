/**
 * `<BundledCanvasRun>`: the atlas fill while the bundled canvas face loads, and the canvas run once
 * it arrives. `<TextRunMesh>` is stubbed to count its mounts.
 */
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import BundledCanvasRun from './BundledCanvasRun';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import { shapeText } from './textLayout';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';

const state = vi.hoisted(() => ({
  face: undefined as CanvasFontMetrics | null | undefined,
  mounts: [] as string[],
}));

vi.mock('./bundledCanvasFace', () => ({ useBundledCanvasFace: () => () => state.face }));

vi.mock('./TextRunMesh', () => ({
  TextRunMesh: ({ layout }: { layout: { fontMetrics: { kind: string } } }) => {
    const kind = layout.fontMetrics.kind;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- counts the mount alone.
    useEffect(() => void state.mounts.push(kind), []);
    return null;
  },
}));

const LAYOUT = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.AUTOWRAP_OFF });
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

describe('<BundledCanvasRun>', () => {
  // Two runs never share one mesh: a reused atlas mesh moved a complex-2d-gui pixel 1/255 off Godot.
  it('mounts the canvas run fresh when the face arrives after the atlas fill', async () => {
    state.face = undefined;
    state.mounts = [];
    const renderer = await ReactThreeTestRenderer.create(
      <BundledCanvasRun layout={LAYOUT} fontSizePx={16} tint={WHITE} />
    );
    state.face = { ...LAYOUT.fontMetrics, kind: 'canvas' } as unknown as CanvasFontMetrics;
    await renderer.update(<BundledCanvasRun layout={LAYOUT} fontSizePx={16} tint={WHITE} />);

    expect(state.mounts).toEqual(['atlas', 'canvas']);
  });
});
