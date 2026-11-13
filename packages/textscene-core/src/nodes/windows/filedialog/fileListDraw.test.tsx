/** The dialog's painter draws a row for each entry the file list holds, with its label, in the list the dialog solves. */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { painterEnv } from '../../../r3f/controls/native/testing/painterProps';
import { solveNode, withThemeItems } from '../../../r3f/controls/native/testing/solveNode';
import { bundledRuns } from '../../../r3f/controls/native/testing/bundledRunStub';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import '../../../parser/TscnParser';
import '../../../r3f/controls/index';
import { wrappedWindowSize } from '../window/wrapControls';
import { DialogChrome } from '../acceptdialog/DialogChrome';
import { parseFileDialog } from './parser';
import { resolveFileDialog } from './resolve';

// A run of the bundled face is a stub that carries its props, so no test decodes the font.
vi.mock('../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };

const ENTRIES = [
  { name: 'Alpha', isDirectory: true },
  { name: 'a.png', isDirectory: false },
  { name: 'b.png', isDirectory: false },
];

async function labelCount(entries: typeof ENTRIES) {
  const lines = { filters: 'PackedStringArray("*.png ; PNG Image")' };
  const raw = {
    name: 'Dialog',
    type: 'FileDialog',
    children: [],
    rawProperties: lines,
    properties: parseFileDialog(heading('FileDialog', { name: 'Dialog' }), lines),
  } as unknown as TscnNode;
  const node = resolveFileDialog(raw, { 'res://': { kind: 'listed', entries } });
  const window = withThemeItems({ ...solveNode(), path: 'Dialog', node });
  const size = wrappedWindowSize(window, THEME, measureText, EMBEDDER);
  const renderer = await ReactThreeTestRenderer.create(
    <DialogChrome
      {...painterEnv()}
      measureText={measureText}
      solveNode={window}
      rect={{ x: 0, y: 0, w: size.x, h: size.y }}
      renderOrder={0}
    />
  );
  return bundledRuns(renderer.scene).length;
}

describe('FileDialog file list drawing', () => {
  it('draws one more label for each row of the list', async () => {
    expect((await labelCount(ENTRIES)) - (await labelCount([]))).toBe(3);
  });
});
