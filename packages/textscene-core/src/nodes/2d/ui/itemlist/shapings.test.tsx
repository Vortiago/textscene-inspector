/**
 * One layout serves an ItemList's minimum size and its paint (`itemListLayout`, `itemListDraw`): a
 * single-line label is shaped once and trimmed to each width, and a wrapped label is shaped again at
 * its draw width, since its lines break there (`scene/gui/item_list.cpp:1629-1632`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import { walked } from '../../../../r3f/controls/native/testing/walk';
import { controlProps } from '../control/testing/controlProps';
import { ItemListIconMode } from '../../../../godot/scene/gui';
import * as textLayout from '../../../../r3f/controls/native/text/textLayout';
import type { ItemListProperties } from './types';
import '../../../../r3f/controls/index';

vi.mock('../../../../r3f/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: null, viewportSize: { width: 1152, height: 648 }, themeScale: 1 }),
}));

vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

vi.mock('../../../../r3f/controls/native/text/textLayout', async (importOriginal) => {
  const original = await importOriginal<typeof textLayout>();
  return { ...original, shapeText: vi.fn(original.shapeText) };
});

afterEach(() => vi.mocked(textLayout.shapeText).mockClear());

const TITLES = ['Alpha', 'Bravo item', 'Charlie'];

/** An ItemList whose minimum follows its content, so the solve runs both of its passes. */
function list(properties: Partial<ItemListProperties> = {}): SolveNode {
  const props = controlProps({
    name: 'IL',
    items: TITLES.map((text) => ({ text })),
    autoWidth: true,
    autoHeight: true,
    offsetRight: 160,
    offsetBottom: 120,
    ...properties,
  });
  return withThemeItems({ ...solveNode(), path: 'IL', node: controlNode('IL', 'ItemList', props) });
}

/** The shapings of the item titles across the two-pass solve and the paint. */
async function titleShapingsOf(root: SolveNode): Promise<number> {
  await walked(root);
  return vi.mocked(textLayout.shapeText).mock.calls.filter(([text]) => TITLES.includes(text)).length;
}

describe('the shapings of an ItemList across a solve and a paint', () => {
  it('shapes each single-line label once', async () => {
    expect(await titleShapingsOf(list())).toBe(TITLES.length);
  });

  it('shapes each wrapped label twice: at the minimum-size width, then at its draw width', async () => {
    const wrapped = list({ iconMode: ItemListIconMode.ICON_MODE_TOP, maxTextLines: 2 });
    expect(await titleShapingsOf(wrapped)).toBe(TITLES.length * 2);
  });
});
