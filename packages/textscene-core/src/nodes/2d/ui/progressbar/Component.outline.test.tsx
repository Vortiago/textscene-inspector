/**
 * The canvas outline of a `<ProgressBar>` percentage draws beneath the percentage. `<TextRun>` is
 * stubbed to read the props the painter hands it.
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
import { ProgressBar } from './Component';

interface RunProps {
  strokeWidthPx?: number;
  renderOrder?: number;
}

const scene = vi.hoisted(() => ({
  metrics: undefined as FontMetrics | undefined,
  runs: [] as RunProps[],
}));

vi.mock('../../../../r3f/controls/native/text/resolveNodeFontMetrics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../r3f/controls/native/text/resolveNodeFontMetrics')>()),
  resolveNodeFont: () => null,
}));
vi.mock('../../../../r3f/controls/native/text/sceneFontLoader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../r3f/controls/native/text/sceneFontLoader')>()),
  peekSceneFontMetrics: () => scene.metrics,
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
});

describe('<ProgressBar> canvas outline', () => {
  it('draws the percentage above its outline', async () => {
    await renderBar();

    await vi.waitFor(() => expect(strokeRuns().length).toBeGreaterThan(0));
    const outline = strokeRuns().at(-1);
    const percentage = scene.runs.find((run) => !run.strokeWidthPx);
    expect(percentage?.renderOrder).toBeGreaterThan(outline?.renderOrder ?? Infinity);
  });
});
