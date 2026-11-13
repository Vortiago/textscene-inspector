/**
 * The Button family cuts, wraps and trims a label the way `Button::_notification` does
 * (`button.cpp:428-441`). Each glyph count is the text `pnpm ref:godot` draws in that box.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ComponentType } from 'react';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { inkedGlyphCounts } from '../../../../r3f/controls/native/testing/bundledRunStub';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { Button } from '../button/Component';
import { CheckBox } from '../checkbox/Component';
import { CheckButton } from '../checkbutton/Component';
import { MenuButton } from '../menubutton/Component';
import { OptionButton } from '../optionbutton/Component';

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

function solveNode(type: string, properties: Record<string, unknown>): SolveNode {
  return { ...emptySolveNode(), path: 'N', node: controlNode('N', type, { name: 'N', ...properties }) };
}

async function inkedCount(
  Component: ComponentType<NativeControlComponentProps>,
  type: string,
  properties: Record<string, unknown>,
  width: number
): Promise<number> {
  const rect: Rect2 = { x: 0, y: 0, w: width, h: 80 };
  const rendered = await ReactThreeTestRenderer.create(
    <Component {...painterEnv()} solveNode={solveNode(type, properties)} rect={rect} renderOrder={0} />
  );
  return inkedGlyphCounts(rendered.scene).reduce((total, glyphs) => total + glyphs, 0);
}

const ALPHA_BRAVO = { text: 'alpha bravo', clipText: true };
const OPTION_ALPHA_BRAVO = { items: [{ text: 'alpha bravo', id: 0 }], selected: 0, clipText: true };

const CUT_CASES = [
  { name: 'CheckBox', Component: CheckBox, properties: ALPHA_BRAVO, narrowWidth: 40, cutGlyphs: 1 },
  { name: 'CheckButton', Component: CheckButton, properties: ALPHA_BRAVO, narrowWidth: 60, cutGlyphs: 1 },
  {
    name: 'OptionButton',
    Component: OptionButton,
    properties: OPTION_ALPHA_BRAVO,
    narrowWidth: 80,
    cutGlyphs: 5,
  },
  { name: 'MenuButton', Component: MenuButton, properties: ALPHA_BRAVO, narrowWidth: 60, cutGlyphs: 5 },
];

describe.each(CUT_CASES)('<$name> cuts its label to the paragraph box (text_paragraph.cpp:925-931)', (c) => {
  it('draws only the glyphs inside a box narrower than the text', async () => {
    expect(await inkedCount(c.Component, c.name, c.properties, c.narrowWidth)).toBe(c.cutGlyphs);
  });

  it('draws the whole label when the box fits it', async () => {
    expect(await inkedCount(c.Component, c.name, c.properties, 300)).toBe(10);
  });
});

// MenuButton draws what Button draws (`menu_button.cpp` has no draw notification), so each case
// compares the two painters rather than restating a count.
describe.each([
  { name: 'autowrap_mode = AUTOWRAP_WORD wraps the label', properties: { autowrapMode: 2 }, width: 60 },
  { name: 'OVERRUN_TRIM_WORD trims the label to whole words', properties: { overrunBehavior: 2 }, width: 80 },
  {
    name: 'OVERRUN_TRIM_ELLIPSIS trims the label with an ellipsis',
    properties: { overrunBehavior: 3 },
    width: 80,
  },
])('<MenuButton> $name as <Button> does', ({ properties, width }) => {
  it('draws the same glyphs', async () => {
    const props = { text: 'alpha bravo', ...properties };
    const asButton = await inkedCount(Button, 'Button', props, width);
    expect(await inkedCount(MenuButton, 'MenuButton', props, width)).toBe(asButton);
  });
});
