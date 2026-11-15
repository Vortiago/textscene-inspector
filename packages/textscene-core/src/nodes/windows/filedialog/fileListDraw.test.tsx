/** The walker draws a row for each entry the file list holds, with its label, in the list the dialog solves. */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { ControlCanvasWalker } from '../../../r3f/controls/native/ControlCanvasWalker';
import { solveNode, withThemeItems } from '../../../r3f/controls/native/testing/solveNode';
import { bundledRuns } from '../../../r3f/controls/native/testing/bundledRunStub';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import '../../../parser/TscnParser';
import '../../../r3f/controls/index';
import { wrappedWindowSize } from '../window/wrapControls';
import { parseFileDialog } from './parser';
import { resolveFileDialog } from './resolve';

// The walker reads `gui/common/snap_controls_to_pixels` off the project settings.
vi.mock('../../../r3f/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: null, viewportSize: { width: 1152, height: 648 }, themeScale: 1 }),
}));

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
    <ControlCanvasWalker
      tree={[window]}
      generation={0}
      viewport={{ x: 0, y: 0, w: size.x, h: size.y }}
      theme={THEME}
      measurer={measureText}
    />
  );
  return bundledRuns(renderer.scene).length;
}

describe('FileDialog file list drawing', () => {
  it('draws one more label for each row of the list', async () => {
    expect((await labelCount(ENTRIES)) - (await labelCount([]))).toBe(3);
  });
});
