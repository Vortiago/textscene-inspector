/**
 * The theme text outline of `<LineEdit>` (`line_edit.cpp:1512-1519`). `<TextRunMesh>` is stubbed to read
 * the props the painter hands it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { Rgba } from '../../../../godot/math/math';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import { TEST_SCENE_FONT_METRICS } from '../../../../r3f/controls/native/testing/sceneFontMetrics';
import { TRIANGLE_OUTLINES } from '../../../../r3f/controls/native/testing/triangleOutlines';
import * as sceneFontLoader from '../../../../r3f/controls/native/text/sceneFontLoader';
import { outlineStrokeWidthPx } from '../../../../r3f/controls/native/text/textOutline';
import { LineEdit } from './Component';

interface RunProps {
  layout: { fontMetrics: { kind: string } };
  tint: Rgba;
  strokeWidthPx?: number;
  renderOrder?: number;
}

const scene = vi.hoisted(() => ({ runs: [] as RunProps[] }));

vi.mock('../../../../r3f/controls/native/text/TextRunMesh', () => ({
  TextRunMesh: (props: RunProps) => {
    scene.runs.push(props);
    return null;
  },
}));

// The bundled canvas face settles at once, with no font to decode.
vi.mock('../../../../r3f/controls/native/text/sceneFontOutlines', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  peekOutlines: () => TRIANGLE_OUTLINES,
}));

const RECT = { x: 0, y: 0, w: 200, h: 30 };
const RED: Rgba = { r: 1, g: 0, b: 0, a: 1 };
const OUTLINE_SIZE = 8;

function outlined(colors: SolveNode['colors'], constants: SolveNode['constants'], text = 'Edit'): SolveNode {
  const node: TscnNode = controlNode('N', 'LineEdit', { name: 'N', text });
  return withThemeItems({ ...emptySolveNode(), path: 'N', node, colors, constants });
}

async function render(solveNode: SolveNode) {
  scene.runs = [];
  await ReactThreeTestRenderer.create(
    <LineEdit {...painterEnv()} solveNode={solveNode} rect={RECT} renderOrder={0} />
  );
}

// The anchor ref of the clip planes re-renders the painter, so the stub sees each run more than once.
const strokeRuns = () => scene.runs.filter((run) => run.strokeWidthPx);
const ringRun = () => strokeRuns().at(-1)!;
const fillRun = () => scene.runs.filter((run) => !run.strokeWidthPx).at(-1)!;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<LineEdit> theme text outline', () => {
  describe('on a scene font', () => {
    beforeEach(() => {
      vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
    });

    it('strokes a ring below the fill', async () => {
      await render(outlined({ font_outline_color: RED }, { outline_size: OUTLINE_SIZE }));

      expect(ringRun().strokeWidthPx).toBe(outlineStrokeWidthPx(OUTLINE_SIZE));
      expect(ringRun().tint).toEqual(RED);
      expect(ringRun().renderOrder).toBeLessThan(fillRun().renderOrder!);
    });

    it('draws no ring at outline_size 0', async () => {
      await render(outlined({ font_outline_color: RED }, { outline_size: 0 }));

      expect(strokeRuns()).toHaveLength(0);
    });

    it('draws no ring at a zero alpha', async () => {
      await render(outlined({ font_outline_color: { ...RED, a: 0 } }, { outline_size: OUTLINE_SIZE }));

      expect(strokeRuns()).toHaveLength(0);
    });

    it('draws no ring by default', async () => {
      await render(outlined({}, {}));

      expect(strokeRuns()).toHaveLength(0);
    });

    it('draws no ring for an empty text', async () => {
      await render(outlined({ font_outline_color: RED }, { outline_size: OUTLINE_SIZE }, ''));

      expect(scene.runs).toHaveLength(0);
    });
  });

  describe('on the bundled font', () => {
    it('strokes the ring and fills the text on the canvas face, as FreeType draws both', async () => {
      await render(outlined({ font_outline_color: RED }, { outline_size: OUTLINE_SIZE }));

      await vi.waitFor(() => expect(strokeRuns().length).toBeGreaterThan(0));
      expect(ringRun().layout.fontMetrics.kind).toBe('canvas');
      expect(fillRun().layout.fontMetrics.kind).toBe('canvas');
    });
  });
});
