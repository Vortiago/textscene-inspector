/**
 * Guards ADR-0060: a reader that takes a node out of the Live scene tree lays the live node patches
 * over it, or states here why its reads need no overlay. The scan runs over the real source tree,
 * and the cases below pin how it reads a file.
 */

import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { findRepoRoot } from './repoRoot.mjs';
import { readSourceTree } from './sourceTree.mjs';
import { readersWithoutPatches, staleReasons } from './livePatchReaders.mjs';

const CORE_SRC = resolve(findRepoRoot(), 'packages/textscene-core/src');

/** The readers of a live node that lay no patch over it, each with why its reads need none. */
const NEEDS_NO_OVERLAY = new Map([
  [
    'nodes/3d/csg/csgpolygon3d/csgPolygonPaths.ts',
    'A pass: it takes the placements of the pass before it as an argument.',
  ],
  [
    'nodes/3d/remotetransform3d/remoteTransforms.ts',
    'A pass: it reads the tree it places nodes in, and builds the placements.',
  ],
  [
    'nodes/viewport/subviewport/controlRasterViewports.ts',
    'Reads the type and the Control layout direction, which no pass patches.',
  ],
  [
    'nodes/viewport/subviewport/viewportContent.ts',
    'Reads the type of each node to classify the content, never a pose.',
  ],
  [
    'r3f/components/SceneTreeViewer/useLiveStep.ts',
    'Shows the merged instance root in the tree, which no pass patches.',
  ],
  ['r3f/components/TscnPreviewShell/SceneStats.tsx', 'Counts the cameras by type.'],
  ['r3f/components/TscnPreviewShell/ViewportArea.tsx', 'Asks whether the scene has 2D content, by type.'],
  ['r3f/components/ViewportToolbar/ViewportToolbar.tsx', 'Asks whether a node yields the preview, by type.'],
  ['r3f/liveSceneTree.ts', 'Builds the tree that the patches are keyed by.'],
  ['r3f/preview/usePreviewYield.ts', 'Asks whether a node yields the preview, by type.'],
  ['r3f/uniqueNameOwner.ts', 'Reads the `%Name` tables, which no pass patches.'],
  ['r3f/useLiveSceneTree.ts', 'The hooks that hand out the tree and its nodes.'],
]);

const READS_LIVE_NODE = 'const node = link.step.node;\n';

describe('the readers of a live node and the live node patches', () => {
  it('finds a reader of a live node that neither lays the patches over it nor says why not', () => {
    const files = new Map([['r3f/Gizmo.tsx', READS_LIVE_NODE]]);

    expect(readersWithoutPatches(files, new Map())).toEqual(['r3f/Gizmo.tsx']);
  });

  it('accepts a reader that lays the patches over the node', () => {
    const files = new Map([
      ['r3f/Gizmo.tsx', `${READS_LIVE_NODE}const placed = patchedNode(node, patch);\n`],
    ]);

    expect(readersWithoutPatches(files, new Map())).toEqual([]);
  });

  it('accepts a reader with a stated reason', () => {
    const files = new Map([['r3f/Gizmo.tsx', READS_LIVE_NODE]]);

    expect(readersWithoutPatches(files, new Map([['r3f/Gizmo.tsx', 'Reads the type only.']]))).toEqual([]);
  });

  it('leaves a test file out', () => {
    const files = new Map([['r3f/Gizmo.test.tsx', READS_LIVE_NODE]]);

    expect(readersWithoutPatches(files, new Map())).toEqual([]);
  });

  it('finds a stated reason for a file that no longer reads a live node', () => {
    const files = new Map([['r3f/Gizmo.tsx', 'export const gizmo = 1;\n']]);

    expect(staleReasons(files, new Map([['r3f/Gizmo.tsx', 'Reads the type only.']]))).toEqual([
      'r3f/Gizmo.tsx',
    ]);
  });

  it('holds for every reader in @textscene/core', () => {
    const files = readSourceTree(CORE_SRC);

    expect(readersWithoutPatches(files, NEEDS_NO_OVERLAY)).toEqual([]);
    expect(staleReasons(files, NEEDS_NO_OVERLAY)).toEqual([]);
  });
});
