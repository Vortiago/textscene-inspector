/** The dialog's painter: the panel, the message and one Button group for each button, at the rects the layout gives. */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { createSolveContext } from '../../../r3f/controls/native/controlRectSolver';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { painterEnv } from '../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../r3f/controls/native/testing/solveNode';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import '../../../r3f/controls/index';
import { wrappedWindowSize } from '../window/wrapControls';
import { DialogChrome } from './DialogChrome';
import { dialogGeometry } from './dialogLayout';
import { parseDialog } from './parser';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };

function dialog(type: string) {
  const properties = parseDialog(heading(type, { name: 'Dialog' }), { dialog_text: '"Delete?"' });
  const node = { name: 'Dialog', type, children: [], properties } as unknown as TscnNode;
  return { ...solveNode(), path: 'Dialog', node };
}

async function buttonGroupPositions(type: string) {
  const window = dialog(type);
  const size = wrappedWindowSize(window, THEME, measureText, EMBEDDER);
  const geometry = dialogGeometry(window, size, createSolveContext(THEME, measureText));
  const renderer = await ReactThreeTestRenderer.create(
    <DialogChrome
      {...painterEnv()}
      measureText={measureText}
      solveNode={window}
      rect={{ x: 0, y: 0, w: size.x, h: size.y }}
      renderOrder={0}
    />
  );
  const groups = renderer.scene
    .findAllByType('Group')
    .map((group) => [group.instance.position.x, group.instance.position.y]);
  return { geometry, groups };
}

describe('<DialogChrome>', () => {
  it('draws the OK button of an AcceptDialog at its row rect', async () => {
    const { geometry, groups } = await buttonGroupPositions('AcceptDialog');
    const [ok] = geometry.buttons;
    expect(geometry.buttons).toHaveLength(1);
    expect(groups).toContainEqual([ok!.rect.x, -ok!.rect.y]);
  });

  it('draws a Cancel button before the OK button of a ConfirmationDialog', async () => {
    const { geometry, groups } = await buttonGroupPositions('ConfirmationDialog');
    expect(geometry.buttons.map((button) => button.role)).toEqual(['cancel', 'ok']);
    for (const button of geometry.buttons) expect(groups).toContainEqual([button.rect.x, -button.rect.y]);
  });
});
