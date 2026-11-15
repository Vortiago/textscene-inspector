/**
 * The outline rings and shadows of a `<Label>` (`label.cpp:828-883`). `<TextRunMesh>` is stubbed to
 * read the props the painter hands it, in draw order.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { Rgba } from '../../../../godot/math/math';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { LabelSettingsResource } from '../../../../resources/styles/labelsettings/types';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import { TRIANGLE_OUTLINES } from '../../../../r3f/controls/native/testing/triangleOutlines';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import { isCanvasFontMetrics } from '../../../../r3f/controls/native/text/runtimeFontMetrics';
import { useCanvasItemOrigin } from '../../../../r3f/components/CanvasItemGroup';
import type { Vector2 } from '../../../../godot/math/vector';
import { Label } from './Component';

interface RunProps {
  layout: { fontMetrics: FontMetrics };
  tint: Rgba;
  strokeWidthPx?: number;
  outlineColor?: Rgba;
  outlineWidthPx?: number;
  renderOrder?: number;
  /** The run's place in its canvas item, which its pen and baseline floor at. */
  itemOrigin: Vector2;
}

// The bundled canvas face settles at once, with no font to decode.
vi.mock('../../../../r3f/controls/native/text/sceneFontOutlines', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  peekOutlines: () => TRIANGLE_OUTLINES,
}));
vi.mock('../../../../r3f/controls/native/text/TextRunMesh', () => ({
  // A mesh in the scene graph stands for the run, so the runs read back in draw order, once each.
  TextRunMesh: (props: Omit<RunProps, 'itemOrigin'>) => (
    <mesh userData={{ run: { ...props, itemOrigin: useCanvasItemOrigin() } }} />
  ),
}));

const RECT = { x: 0, y: 0, w: 200, h: 60 };
const RED: Rgba = { r: 1, g: 0, b: 0, a: 1 };
const GREEN: Rgba = { r: 0, g: 1, b: 0, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const RENDER_ORDER = 7;

function label(overrides: Partial<SolveNode>): SolveNode {
  return withThemeItems({
    ...emptySolveNode(),
    path: 'L',
    node: controlNode('L', 'Label', { name: 'L', text: 'A' }),
    ...overrides,
  });
}

function settings(overrides: Partial<LabelSettingsResource>): LabelSettingsResource {
  return {
    lineSpacing: 3,
    paragraphSpacing: 0,
    fontSize: 16,
    fontColor: { r: 1, g: 1, b: 1, a: 1 },
    outlineSize: 0,
    outlineColor: BLACK,
    shadowSize: 0,
    shadowColor: { r: 0, g: 0, b: 0, a: 0 },
    shadowOffset: { x: 1, y: 1 },
    stackedOutlines: [],
    stackedShadows: [],
    ...overrides,
  };
}

async function draw(node: SolveNode, expectedRuns: number): Promise<RunProps[]> {
  const renderer = await ReactThreeTestRenderer.create(
    <Label {...painterEnv()} solveNode={node} rect={RECT} renderOrder={RENDER_ORDER} />
  );
  const runs = () =>
    renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance.userData.run as RunProps);
  await vi.waitFor(() => expect(runs()).toHaveLength(expectedRuns));
  return runs();
}

const rings = (runs: RunProps[]) => runs.filter((run) => run.strokeWidthPx);
const fill = (runs: RunProps[]) => runs.at(-1)!;

describe('<Label> outline ring', () => {
  const outlined = label({ colors: { font_outline_color: RED }, constants: { outline_size: 8 } });

  it('strokes the ring of the bundled font on the canvas face, at twice the radius of outline_size / 4', async () => {
    const runs = await draw(outlined, 2);
    const [ring] = rings(runs);
    // text_server_adv.cpp:1383: 8 * 16 / 64 = 2 px a side, so a stroke centred on the contour is 4 wide.
    expect(ring?.strokeWidthPx).toBe(4);
    expect(isCanvasFontMetrics(ring!.layout.fontMetrics)).toBe(true);
    expect(ring?.tint).toEqual(RED);
  });

  it('fills on the canvas face with no outline of its own, above the ring', async () => {
    const runs = await draw(outlined, 2);
    const filled = fill(runs);
    expect(filled.layout.fontMetrics.kind).toBe('canvas');
    expect(filled.outlineColor).toBeUndefined();
    expect(filled.outlineWidthPx).toBeUndefined();
    expect(filled.renderOrder).toBeGreaterThan(rings(runs)[0]!.renderOrder!);
  });

  it('rounds the ring pen at the canvas origin of its fill, so the ring stays on its glyph', async () => {
    // label.cpp:796-797: one `ofs.x` per line feeds every draw_text pass, the outline and the fill alike.
    const centred = label({
      ...outlined,
      node: controlNode('L', 'Label', { name: 'L', text: 'A', horizontalAlignment: 1 }),
    });
    const runs = await draw(centred, 2);
    expect(fill(runs).itemOrigin.x).toBeGreaterThan(0);
    expect(rings(runs)[0]?.itemOrigin).toEqual(fill(runs).itemOrigin);
  });

  it('draws no ring at outline_size 0', async () => {
    const runs = await draw(label({ colors: { font_outline_color: RED } }), 1);
    expect(rings(runs)).toHaveLength(0);
  });
});

describe('<Label> stacked effects', () => {
  const stacked = label({
    labelSettings: settings({
      outlineSize: 4,
      stackedOutlines: [
        { size: 8, color: RED },
        { size: 8, color: GREEN },
      ],
      stackedShadows: [{ offset: { x: 6, y: 6 }, color: RED, outlineSize: 4 }],
    }),
  });

  it('draws every layer in Godot order: the shadow ring, the shadow, the rings from largest, the fill', async () => {
    const runs = await draw(stacked, 6);
    // Stacked ring sizes 20 and 12, base 4: radius = size / 4 px, stroke = twice that (4 * 16 / 64 * 2 = 2).
    expect(runs.map((run) => run.strokeWidthPx ?? 0)).toEqual([2, 0, 10, 6, 2, 0]);
    expect(runs.slice(2, 5).map((run) => run.tint)).toEqual([GREEN, RED, BLACK]);
  });

  it('keeps the draw order in the render order, all of it below the next Control', async () => {
    const runs = await draw(stacked, 6);
    const orders = runs.map((run) => run.renderOrder!);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(new Set(orders).size).toBe(orders.length);
    expect(orders[0]).toBeGreaterThanOrEqual(RENDER_ORDER);
    expect(orders.at(-1)).toBeLessThan(RENDER_ORDER + 1);
  });
});
