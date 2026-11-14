/**
 * `<Label>` while its `label_settings` font loads: it draws the box only, and it shapes nothing.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import { LABEL_SETTINGS_FONT_LOADING, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import { shapeText } from '../../../../r3f/controls/native/text/textLayout';
import { Label } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';

vi.mock('../../../../r3f/controls/native/text/textLayout', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../r3f/controls/native/text/textLayout')>();
  return { ...original, shapeText: vi.fn(original.shapeText) };
});

function loadingLabel(): SolveNode {
  const tscnNode: TscnNode = controlNode('L', 'Label', { name: 'L', text: 'AB', autowrapMode: 3 });
  return {
    ...withThemeItems({ ...solveNode(), path: 'L', node: tscnNode }),
    labelSettingsFont: LABEL_SETTINGS_FONT_LOADING,
  };
}

describe('<Label> while its font loads', () => {
  it('shapes no text', async () => {
    vi.mocked(shapeText).mockClear();
    await ReactThreeTestRenderer.create(
      <Label
        {...painterEnv()}
        solveNode={loadingLabel()}
        rect={{ x: 0, y: 0, w: 200, h: 200 }}
        renderOrder={0}
      />
    );
    expect(shapeText).not.toHaveBeenCalled();
  });
});
