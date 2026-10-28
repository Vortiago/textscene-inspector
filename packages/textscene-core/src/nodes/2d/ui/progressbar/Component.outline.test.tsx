/**
 * The canvas outline of a `<ProgressBar>` percentage follows the emboldened glyph contours, as
 * Label3D's does. `<TextRun>` is stubbed to read the props the painter hands it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { createOpenSansCanvasFontMetrics } from '../../../../r3f/controls/native/text/openSansCanvasFontMetrics';
import { withVariation } from '../../../../r3f/controls/native/text/fontMetrics';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import type { SfntOutlines } from '../../../../r3f/controls/native/text/sfntOutlines';
import type { FontResource } from '../../../../resources/fonts/font/types';
import { trueTypeFontFile } from '../../../../resources/meshes/textmesh/textMeshFont.testkit';
import { ProgressBar } from './Component';

interface RunProps {
  strokeWidthPx?: number;
  glyphOutlines?: SfntOutlines | null;
}

const scene = vi.hoisted(() => ({
  metrics: undefined as FontMetrics | undefined,
  font: null as FontResource | null,
  runs: [] as RunProps[],
}));

vi.mock('../../../../r3f/controls/native/text/resolveNodeFontMetrics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../r3f/controls/native/text/resolveNodeFontMetrics')>()),
  resolveNodeFontMetrics: () => scene.metrics,
  resolveNodeFont: () => scene.font,
}));
vi.mock('../../../../r3f/controls/native/text/TextRun', () => ({
  TextRun: (props: RunProps) => {
    scene.runs.push(props);
    return null;
  },
}));

const RECT = { x: 0, y: 0, w: 100, h: 20 };

function outlinedBar(): SolveNode {
  return {
    ...emptySolveNode(),
    path: 'P',
    node: controlNode('P', 'ProgressBar', { name: 'P', value: 50 }) as TscnNode,
    colors: { font_outline_color: { r: 1, g: 0, b: 0, a: 1 } },
    constants: { outline_size: 2 },
  };
}

const strokeRuns = (): RunProps[] => scene.runs.filter((run) => run.strokeWidthPx);

async function renderBar() {
  scene.runs = [];
  await ReactThreeTestRenderer.create(
    <ProgressBar {...painterEnv()} solveNode={outlinedBar()} rect={RECT} renderOrder={0} />
  );
}

beforeEach(() => {
  const bundled = createOpenSansCanvasFontMetrics('progress-bar-outline-test');
  scene.metrics = withVariation(bundled, { embolden: 0.6 });
  scene.font = trueTypeFontFile();
});

describe('<ProgressBar> canvas outline', () => {
  it('strokes the contours of the emboldened face, and never strokes the plain ring while they load', async () => {
    await renderBar();

    await vi.waitFor(() => expect(strokeRuns().length).toBeGreaterThan(0));
    expect(strokeRuns().every((run) => run.glyphOutlines)).toBe(true);
  });

  it('strokes a face with no embolden at once, without outlines', async () => {
    scene.metrics = createOpenSansCanvasFontMetrics('progress-bar-plain-test');

    await renderBar();

    expect(strokeRuns().at(-1)?.glyphOutlines).toBeNull();
  });
});
