/**
 * `<Label>` while its `label_settings` font loads: it draws the box only, and it runs no layout.
 * A file of its own, as its module mocks would wrap every Label test.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import { LABEL_SETTINGS_FONT_LOADING, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import { shapeText } from '../../../../r3f/controls/native/text/textLayout';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { Label } from './Component';
import { layoutLabelLines } from './nativeSolver';
import { applyVisibleCharsReveal } from '../shared/visibleChars';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';

vi.mock('../../../../r3f/controls/native/text/textLayout', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../r3f/controls/native/text/textLayout')>();
  return { ...original, shapeText: vi.fn(original.shapeText) };
});
vi.mock('./nativeSolver', async (importOriginal) => {
  const original = await importOriginal<typeof import('./nativeSolver')>();
  return { ...original, layoutLabelLines: vi.fn(original.layoutLabelLines) };
});
vi.mock('../shared/visibleChars', async (importOriginal) => {
  const original = await importOriginal<typeof import('../shared/visibleChars')>();
  return { ...original, applyVisibleCharsReveal: vi.fn(original.applyVisibleCharsReveal) };
});

function loadingLabel(autowrapMode: number): SolveNode {
  const tscnNode: TscnNode = controlNode('L', 'Label', { name: 'L', text: 'AB', autowrapMode });
  return {
    ...withThemeItems({ ...solveNode(), path: 'L', node: tscnNode }),
    labelSettingsFont: LABEL_SETTINGS_FONT_LOADING,
  };
}

async function renderLoading(autowrapMode: number) {
  vi.clearAllMocks();
  return ReactThreeTestRenderer.create(
    <Label
      {...painterEnv()}
      solveNode={loadingLabel(autowrapMode)}
      rect={{ x: 0, y: 0, w: 200, h: 200 }}
      renderOrder={0}
    />
  );
}

describe('<Label> while its font loads', () => {
  it('shapes no text when it wraps', async () => {
    await renderLoading(AutowrapMode.AUTOWRAP_WORD_SMART);
    expect(shapeText).not.toHaveBeenCalled();
  });

  it('places and reveals no line with autowrap off', async () => {
    await renderLoading(AutowrapMode.AUTOWRAP_OFF);
    expect(layoutLabelLines).not.toHaveBeenCalled();
    expect(applyVisibleCharsReveal).not.toHaveBeenCalled();
  });

  it('draws no mesh', async () => {
    const renderer = await renderLoading(AutowrapMode.AUTOWRAP_OFF);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});
