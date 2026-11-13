/** The dialog's painter: the panel, the message and one Button group for each button, at the rects the layout gives. */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { createSolveContext } from '../../../r3f/controls/native/controlRectSolver';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { painterEnv } from '../../../r3f/controls/native/testing/painterProps';
import { solveNode, withThemeItems } from '../../../r3f/controls/native/testing/solveNode';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import '../../../r3f/controls/index';
import { wrappedWindowSize } from '../window/wrapControls';
import { DialogChrome } from './DialogChrome';
import { dialogGeometry } from './dialogLayout';
import { parseDialog } from './parser';
import { ControlCanvasWalker } from '../../../r3f/controls/native/ControlCanvasWalker';
import {
  controlComponentRegistry,
  type NativeControlComponentProps,
} from '../../../r3f/controls/ControlComponentRegistry';
import { controlProps } from '../../2d/ui/control/testing/controlProps';
import type { Rect2 } from '../../../godot/math/rect2';
import { registerDialogControls } from './controls.r3f';
import { registerDialogBody, syntheticControl, syntheticPath } from './dialogParts';

// The walker reads `gui/common/snap_controls_to_pixels` off the project settings.
vi.mock('../../../r3f/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: null, viewportSize: { width: 1152, height: 648 }, themeScale: 1 }),
}));

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };

function dialog(type: string) {
  const properties = parseDialog(heading(type, { name: 'Dialog' }), { dialog_text: '"Delete?"' });
  const node = { name: 'Dialog', type, children: [], properties } as unknown as TscnNode;
  return withThemeItems({ ...solveNode(), path: 'Dialog', node });
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

  it('lays the buttons out again when the same dialog gets a longer OK text', async () => {
    const withText = (okText: string) => {
      const window = dialog('AcceptDialog');
      const properties = { ...(window.node.properties as object), ok_button_text: okText };
      return { ...window, node: { ...window.node, properties } as unknown as TscnNode };
    };
    const element = (window: ReturnType<typeof dialog>) => (
      <DialogChrome
        {...painterEnv()}
        measureText={measureText}
        solveNode={window}
        rect={{ x: 0, y: 0, w: 640, h: 360 }}
        renderOrder={0}
      />
    );
    const renderer = await ReactThreeTestRenderer.create(element(withText('OK')));
    const groupXs = () => renderer.scene.findAllByType('Group').map((group) => group.instance.position.x);
    const before = groupXs();
    await renderer.update(element(withText('Select This Folder')));
    expect(groupXs()).not.toEqual(before);
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
registerDialogBody('ProbeDialog', (window) =>
  syntheticControl(window, {
    type: 'ChildRectProbe',
    name: 'Probe',
    properties: controlProps({ name: 'Probe', anchorRight: 1, anchorBottom: 1 }),
    children: [
      syntheticControl(window, {
        type: 'Control',
        name: 'Inner',
        parentPath: syntheticPath(window.path, 'Probe'),
        properties: controlProps({
          name: 'Inner',
          offsetLeft: 10,
          offsetTop: 20,
          offsetRight: 40,
          offsetBottom: 60,
        }),
      }),
    ],
  })
);

/** An AcceptDialog's theme items on a class that registers the probe body. */
function probeDialog() {
  const window = dialog('AcceptDialog');
  return { ...window, node: { ...window.node, type: 'ProbeDialog' } };
}

describe('a dialog body under the walker', () => {
  it("hands a body Control's painter the rects of its children", async () => {
    probedChildRects.length = 0;
    await ReactThreeTestRenderer.create(
      <ControlCanvasWalker
        tree={[probeDialog()]}
        generation={0}
        viewport={{ x: 0, y: 0, w: 320, h: 200 }}
        theme={THEME}
        measurer={measureText}
      />
    );
    expect(probedChildRects.at(-1)?.get('Dialog/@Probe/@Inner')).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });
});
