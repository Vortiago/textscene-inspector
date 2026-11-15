/** The CodeEdit gutters against a line taller than the font, in a face shorter than a hex-code box. */
import { expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { CodeEdit } from './Component';
import type { CodeEditProperties } from './types';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import { bundledRunOf } from '../../../../r3f/controls/native/testing/bundledRunStub';

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

// Ascent 18 px and descent 6 px at 24 px, with no `一`, so a hex-code box rises above the face.
vi.mock('../../../../r3f/controls/native/text/resolveNodeFontMetrics', async (importOriginal) => {
  const { OPEN_SANS_FONT_METRICS } = await import('../../../../r3f/controls/native/text/openSansFontMetrics');
  const shortFace = {
    ...OPEN_SANS_FONT_METRICS,
    ascent: 1536,
    descent: 512,
    hasGlyph: (ch: string) => ch !== '一',
  };
  return { ...(await importOriginal<object>()), resolveNodeFontMetrics: () => shortFace };
});

function solveNode(text: string, placeholderText?: string): SolveNode {
  const properties: Partial<CodeEditProperties> = {
    text,
    placeholderText,
    gutterDrawBookmarks: true,
    themeOverrideFontSizes: { font_size: 24 },
  };
  const node: TscnNode = controlNode('MyCodeEdit', 'CodeEdit', { name: 'MyCodeEdit', ...properties });
  return withThemeItems({ ...emptySolveNode(), path: 'MyCodeEdit', node });
}

/** The x of the body text's group: the largest among the text-bearing groups. */
async function bodyXFor(text: string, placeholderText?: string): Promise<number> {
  const rendered = await ReactThreeTestRenderer.create(
    <CodeEdit
      {...painterEnv()}
      solveNode={solveNode(text, placeholderText)}
      rect={{ x: 0, y: 0, w: 300, h: 100 }}
      renderOrder={0}
    />
  );
  return Math.max(
    ...rendered.scene
      .findAllByType('Group')
      .map((g) => g.instance)
      .filter((g) => g.children.some((child) => bundledRunOf(child) !== undefined))
      .map((g) => g.position.x)
  );
}

// `get_line_height()` (`code_edit.cpp:57`) is the tallest line: ceil(25.5 + 6) = 32 over the face's 24.
it('widens the main gutter by a line that a hex-code box makes taller than the font', async () => {
  expect((await bodyXFor('a\nA一B')) - (await bodyXFor('a\nAB'))).toBe(8);
});

// `get_line_height()` reads the buffer, and an empty buffer has one empty line, whatever the placeholder holds.
it('sizes the main gutter from the empty buffer, not from the placeholder', async () => {
  expect((await bodyXFor('', 'A一B')) - (await bodyXFor('', 'AB'))).toBe(0);
});
