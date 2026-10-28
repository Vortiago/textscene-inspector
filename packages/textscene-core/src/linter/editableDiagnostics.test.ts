/** An `[editable]` heading with no `path` is an error. One whose path names no node is not. */

import { describe, expect, it } from 'vitest';
import { instanced, lintRule, node, packedScene, scene } from './testing/testkit.js';
import './index.js';

/** A scene with a root and an instanced `Body`, then the given headings after the nodes. */
function sceneWith(...headings: string[]): string {
  return scene(
    packedScene,
    node('Node', {}, { name: 'Root' }),
    instanced('Body', { parent: '.' }),
    ...headings
  );
}

const named = (source: string) => lintRule(source, 'editable-missing-path');

describe('an editable heading with no path', () => {
  it('errors on each heading that lacks a path and on none that has one', () => {
    const reports = named(sceneWith('[editable]', '[editable path="Body"]', '[editable]'));
    expect(reports.map((d) => d.location?.line)).toEqual([9, 13]);
    for (const report of reports) expect(report).toBeAtTier('error');
  });

  it('stays silent for a heading whose path names an instance', () => {
    expect(named(sceneWith('[editable path="Body"]'))).toEqual([]);
  });

  it('stays silent for a path that names no node, which the instantiate skips', () => {
    expect(named(sceneWith('[editable path="Nope"]'))).toEqual([]);
  });
});
