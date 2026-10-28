/**
 * An `[editable]` heading with no `path` is an error: the text loader returns `ERR_FILE_CORRUPT`, so nothing in the
 * file loads (`resource_format_text.cpp:391-395`). One whose path names no node is not: the scene loads and the
 * instantiate skips the path (`packed_scene.cpp:691-696`).
 */

import { describe, expect, it } from 'vitest';
import { instanced, lint, node, packedScene, scene } from './testing/testkit.js';
import './index.js';

const MISSING_PATH = 'editable-missing-path';

/** A scene with a root and an instanced `Body`, then the given headings after the nodes. */
function sceneWith(...headings: string[]): string {
  return scene(
    packedScene,
    node('Node', {}, { name: 'Root' }),
    instanced('Body', { parent: '.' }),
    ...headings
  );
}

const named = (source: string) => lint(source).filter((d) => d.ruleName === MISSING_PATH);

describe('an editable heading with no path', () => {
  it('errors once on the line of the heading', () => {
    const reports = named(sceneWith('[editable]'));
    expect(reports).toHaveLength(1);
    expect(reports[0]).toBeAtTier('error');
    expect(reports[0]?.location?.line).toBe(9);
  });

  it('errors on each heading that lacks a path and on none that has one', () => {
    const reports = named(sceneWith('[editable]', '[editable path="Body"]', '[editable]'));
    expect(reports.map((d) => d.location?.line)).toEqual([9, 13]);
  });

  it('stays silent for a heading whose path names an instance', () => {
    expect(named(sceneWith('[editable path="Body"]'))).toEqual([]);
  });

  it('stays silent for a path that names no node, which the instantiate skips', () => {
    expect(named(sceneWith('[editable path="Nope"]'))).toEqual([]);
  });
});
