/**
 * The solve reads its fonts on the snapshot its host owns: it requests a font file after the run
 * that read it, runs again with the font once the file loads, and runs not at all for the load of
 * a file it never read.
 */

import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { FontResource } from '../../../resources/fonts/font/types';
import { useBuildSolveTree } from './buildSolveTree';
import type { SolveNode } from './solveTree';
// Side-effect imports: the node parsers and the solvers the solve tree reads.
import '../../nodes/index';
import '../index';

const FONT_PATH = 'res://fonts/bold.ttf';
const EXTERNAL = [{ id: '1_font', path: FONT_PATH, type: 'FontFile' }];
const FONT: FontResource = {
  kind: 'file',
  bytes: undefined,
  mimeType: undefined,
  fallbacks: [],
  properties: {},
};

/** A Label whose font override names the font file. */
const LABEL: TscnNode = {
  rawProperties: {},
  name: 'Title',
  type: 'Label',
  children: [],
  properties: { name: 'Title', themeOverrideFonts: { font: 'ExtResource("1_font")' } },
} as TscnNode;
const NODES = [LABEL];

/** The solve of the Label under `fake`, with every tree it built in order and each font request. */
function renderSolve() {
  const fake = createFakeResourceLoader();
  const requests: string[] = [];
  fake.fonts.setRequestImpl((path) => requests.push(path));
  const trees: (readonly SolveNode[])[] = [];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  renderHook(
    () => {
      const { tree } = useBuildSolveTree(NODES, EXTERNAL, []);
      if (trees.at(-1) !== tree) trees.push(tree);
    },
    { wrapper }
  );
  return { fake, requests, trees };
}

describe("the solve's font reads", () => {
  it('requests the font file once after the first run', () => {
    const { requests, trees } = renderSolve();

    expect(trees).toHaveLength(1);
    expect(requests).toEqual([FONT_PATH]);
  });

  it('runs once more, with the font, once the file loads', async () => {
    const { fake, trees } = renderSolve();

    await act(async () => fake.fonts._resolve(FONT_PATH, FONT));

    expect(trees.map((tree) => tree[0]?.fontOverrides.font ?? null)).toEqual([null, FONT]);
  });

  it('runs not at all for the load of a font file it never read', async () => {
    const { fake, trees } = renderSolve();

    await act(async () => fake.fonts._resolve('res://fonts/other.ttf', FONT));

    expect(trees).toHaveLength(1);
  });
});
