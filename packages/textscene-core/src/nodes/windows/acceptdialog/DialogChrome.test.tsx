/**
 * A dialog under the walker: its painter draws the panel, and the walker draws the message, the body
 * and one Button group for each button as internal Controls at the rects the one solve gives.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import type { Rect2 } from '../../../godot/math/rect2';
import { heading } from '../../../parser/testing/parserKit';
import { ControlCanvasWalker } from '../../../r3f/controls/native/ControlCanvasWalker';
import {
  controlComponentRegistry,
  type NativeControlComponentProps,
} from '../../../r3f/controls/ControlComponentRegistry';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { solveNode, withThemeItems } from '../../../r3f/controls/native/testing/solveNode';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import '../../../r3f/controls/index';
import { controlProps } from '../../2d/ui/control/testing/controlProps';
import { wrappedWindowSize } from '../window/wrapControls';
import { registerDialogControls } from './controls.r3f';
import { registerDialogBody } from './dialogParts';
import { parseDialog } from './parser';
import { solvedDialog } from './testing/solvedDialog';

// The walker reads `gui/common/snap_controls_to_pixels` off the project settings.
vi.mock('../../../r3f/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: null, viewportSize: { width: 1152, height: 648 }, themeScale: 1 }),
}));

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };

function dialog(type: string, lines: Record<string, string> = {}): SolveNode {
  const properties = parseDialog(heading(type, { name: 'Dialog' }), { dialog_text: '"Delete?"', ...lines });
  const node = { name: 'Dialog', type, children: [], properties } as unknown as TscnNode;
  return withThemeItems({ ...solveNode(), path: 'Dialog', node });
}

function walked(window: SolveNode, size: { x: number; y: number }) {
  return (
    <ControlCanvasWalker
      tree={[window]}
      generation={0}
      viewport={{ x: 0, y: 0, w: size.x, h: size.y }}
      theme={THEME}
      measurer={measureText}
    />
  );
}

/** The local position of every group the walk mounts, Y up as three holds it. */
function groupPositions(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  return renderer.scene
    .findAllByType('Group')
    .map((group) => [group.instance.position.x, group.instance.position.y]);
}

/** Each button's rect in the row, which is where its group sits. */
function buttonRectsInRow(window: SolveNode, size: { x: number; y: number }) {
  const { row, buttons } = solvedDialog(window, size, THEME);
  return buttons.map(({ role, rect }) => ({ role, x: rect.x - row.x, y: rect.y - row.y }));
}

describe('a dialog under the walker', () => {
  it('draws the OK button of an AcceptDialog at its row rect', async () => {
    const window = dialog('AcceptDialog');
    const size = wrappedWindowSize(window, THEME, measureText, EMBEDDER);
    const renderer = await ReactThreeTestRenderer.create(walked(window, size));
    const [ok] = buttonRectsInRow(window, size);
    expect(groupPositions(renderer)).toContainEqual([ok!.x, -ok!.y]);
  });

  it('draws a Cancel button before the OK button of a ConfirmationDialog', async () => {
    const window = dialog('ConfirmationDialog');
    const size = wrappedWindowSize(window, THEME, measureText, EMBEDDER);
    const renderer = await ReactThreeTestRenderer.create(walked(window, size));
    const buttons = buttonRectsInRow(window, size);
    expect(buttons.map(({ role }) => role)).toEqual(['cancel', 'ok']);
    for (const button of buttons) expect(groupPositions(renderer)).toContainEqual([button.x, -button.y]);
  });

  it('lays the buttons out again when the same dialog gets a longer OK text', async () => {
    const size = { x: 640, y: 360 };
    const renderer = await ReactThreeTestRenderer.create(
      walked(dialog('AcceptDialog', { ok_button_text: '"OK"' }), size)
    );
    const before = groupPositions(renderer);
    await renderer.update(walked(dialog('AcceptDialog', { ok_button_text: '"Select This Folder"' }), size));
    expect(groupPositions(renderer)).not.toEqual(before);
  });
});

/** What each `ChildRectProbe` painter was handed as `childRects`, in paint order. */
const probedChildRects: ReadonlyMap<string, Rect2>[] = [];

function ChildRectProbe({ childRects }: NativeControlComponentProps) {
  probedChildRects.push(childRects);
  return null;
}

controlComponentRegistry.register({ typeName: 'ChildRectProbe', Component: ChildRectProbe });
registerDialogControls('ProbeDialog');
registerDialogBody('ProbeDialog', () => ({
  type: 'ChildRectProbe',
  name: 'Probe',
  properties: controlProps({ name: 'Probe', anchorRight: 1, anchorBottom: 1 }),
  children: [
    {
      type: 'Control',
      name: 'Inner',
      properties: controlProps({
        name: 'Inner',
        offsetLeft: 10,
        offsetTop: 20,
        offsetRight: 40,
        offsetBottom: 60,
      }),
    },
  ],
}));

/** An AcceptDialog's theme items on a class that registers the probe body. */
function probeDialog(): SolveNode {
  const window = dialog('AcceptDialog');
  return { ...window, node: { ...window.node, type: 'ProbeDialog' } };
}

describe('a dialog body under the walker', () => {
  it("hands a body Control's painter the rects of its children", async () => {
    probedChildRects.length = 0;
    await ReactThreeTestRenderer.create(walked(probeDialog(), { x: 320, y: 200 }));
    expect(probedChildRects.at(-1)?.get('Dialog/@Probe/@Inner')).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });
});
