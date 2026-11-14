/**
 * One layout serves a Button's solve and its paint (`buttonLayoutOf`): a label is shaped once when it
 * does not wrap, and twice when it wraps, the unwrapped first pass and the wrap at the tentative width.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import { walked } from '../../../../r3f/controls/native/testing/walk';
import { controlProps } from '../control/testing/controlProps';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import * as buttonBase from '../../../../r3f/controls/native/buttonBase';
import '../../../../r3f/controls/index';

vi.mock('../../../../r3f/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: null, viewportSize: { width: 1152, height: 648 }, themeScale: 1 }),
}));

vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

vi.mock('../../../../r3f/controls/native/buttonBase', async (importOriginal) => {
  const original = await importOriginal<typeof buttonBase>();
  return { ...original, shapeWrappedButtonLabel: vi.fn(original.shapeWrappedButtonLabel) };
});

afterEach(() => vi.mocked(buttonBase.shapeWrappedButtonLabel).mockClear());

function button(properties: Record<string, unknown>): SolveNode {
  const props = controlProps({
    name: 'B',
    text: 'Two words',
    offsetRight: 120,
    offsetBottom: 60,
    ...properties,
  });
  return withThemeItems({ ...solveNode(), path: 'B', node: controlNode('B', 'Button', props) });
}

async function shapingsOf(root: SolveNode): Promise<number> {
  await walked(root);
  return vi.mocked(buttonBase.shapeWrappedButtonLabel).mock.calls.length;
}

describe('the shapings of one Button label across a solve and a paint', () => {
  it('shapes a label that does not wrap once', async () => {
    expect(await shapingsOf(button({}))).toBe(1);
  });

  it('shapes a wrapping label twice: unwrapped, then at the width the layout leaves', async () => {
    expect(await shapingsOf(button({ autowrapMode: AutowrapMode.AUTOWRAP_WORD }))).toBe(2);
  });
});
