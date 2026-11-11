/**
 * The report `pnpm pr:state` prints, built from git's text alone. Each case gives the text git
 * prints and reads the section of the report it decides.
 */

import { describe, expect, it } from 'vitest';
import { prStateReport } from './prState.mjs';

const HEAD = { sha: '55a649fd0000000000000000000000000000beef', branch: 'claude/y-sort' };
const BASE = { ref: 'origin/main', sha: '97c833d0000000000000000000000000000cafe' };

/** A report over `change`, with a head and a base that no case reads unless it names them. */
function reportOf(change) {
  return prStateReport({
    head: HEAD,
    base: BASE,
    nameStatus: '',
    diff: '',
    unkeptTestOnlyExports: [],
    ...change,
  });
}

/** A `git diff -U0` section that adds `lines` to `path` from `firstLine` on. */
function additions(path, firstLine, lines) {
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${firstLine - 1},0 +${firstLine},${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join('\n');
}

describe('prStateReport', () => {
  it('names the head commit, its branch and the base it left', () => {
    const report = reportOf({});
    expect(report).toContain('- Head: `55a649fd0000000000000000000000000000beef` on `claude/y-sort`');
    expect(report).toContain('- Base: `origin/main` at `97c833d0000000000000000000000000000cafe`');
  });

  it('lists each baseline with its change, from any scene root', () => {
    const report = reportOf({
      nameStatus: [
        'A\tscripts/visual/baselines/control-y-sort.png',
        'M\tscripts/visual/baselines/isometric-dungeon.png',
        'D\tscripts/visual/baselines/old-golden.png',
        'M\tREADME.md',
      ].join('\n'),
    });
    expect(report).toContain(
      [
        '## Baselines (3)',
        '',
        '- added `control-y-sort`',
        '- changed `isometric-dungeon`',
        '- removed `old-golden`',
      ].join('\n')
    );
  });

  it('lists each scene and resource the change adds, changes or removes', () => {
    const report = reportOf({
      nameStatus: ['A\tscenes/fixtures/unit-control-y-sort.tscn', 'M\tscenes/isometric/theme.tres'].join(
        '\n'
      ),
    });
    expect(report).toContain(
      [
        '## Scenes and resources (2)',
        '',
        '- added `scenes/fixtures/unit-control-y-sort.tscn`',
        '- changed `scenes/isometric/theme.tres`',
      ].join('\n')
    );
  });

  it('quotes an added line that defers work, with its file and line', () => {
    const report = reportOf({
      diff: additions('packages/textscene-core/src/r3f/ySort.ts', 40, [
        'const order = sort(items);',
        '// TODO: merge the nested sort',
        'it.skip("sorts a nested Control", () => {});',
      ]),
    });
    expect(report).toContain(
      '- `packages/textscene-core/src/r3f/ySort.ts:41` // TODO: merge the nested sort'
    );
    expect(report).toContain(
      '- `packages/textscene-core/src/r3f/ySort.ts:42` it.skip("sorts a nested Control", () => {});'
    );
    expect(report).not.toContain('const order');
  });

  it('quotes an added line that records a limit of a feature', () => {
    const report = reportOf({
      diff: additions('packages/textscene-core/src/nodes/control/comparison.md', 12, [
        '- Known limitation: a Control-only viewport stays in scene order.',
        '- Approximated: the shadow penumbra.',
        '- The Label draws its text.',
      ]),
    });
    expect(report).toContain(
      'comparison.md:12` - Known limitation: a Control-only viewport stays in scene order.'
    );
    expect(report).toContain('comparison.md:13` - Approximated: the shadow penumbra.');
    expect(report).not.toContain('The Label draws its text');
  });

  it('reads no removed line and no context line as an addition (edge case)', () => {
    const diff = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -3,2 +3,1 @@',
      '-// TODO: old note',
      '-const a = 1;',
      '+const a = 2;',
    ].join('\n');
    expect(reportOf({ diff })).toContain('## Added lines that defer work or record a limit (0)\n\nNone.');
  });

  it('counts the lines of each hunk from its own start (edge case)', () => {
    const diff = [
      additions('a.ts', 5, ['// FIXME one']),
      '@@ -90,0 +92,2 @@',
      '+const b = 1;',
      '+// FIXME two',
    ].join('\n');
    const report = reportOf({ diff });
    expect(report).toContain('- `a.ts:5` // FIXME one');
    expect(report).toContain('- `a.ts:93` // FIXME two');
  });

  it('names each exemption table the change edits', () => {
    const report = reportOf({
      nameStatus: [
        'M\tpackages/textscene-core/src/linter/fixtureLint.test.ts',
        'M\tscripts/visual/run.mjs',
      ].join('\n'),
    });
    expect(report).toContain(
      '- `packages/textscene-core/src/linter/fixtureLint.test.ts`: the advisories a unit fixture may report'
    );
    expect(report).not.toContain('scripts/visual/run.mjs');
  });

  it('lists a value export that only tests import', () => {
    const report = reportOf({ unkeptTestOnlyExports: ['r3f/ySort.ts#compareSortY'] });
    expect(report).toContain(['## Test-only exports (1)', '', '- `r3f/ySort.ts#compareSortY`'].join('\n'));
  });

  it('says None for a section with nothing to list', () => {
    expect(reportOf({})).toContain('## Baselines (0)\n\nNone.');
  });

  it('gives the pull request state, and says when its head is not the local head (error path)', () => {
    const pullRequest = { number: 1448, draft: true, mergeableState: 'unstable', headSha: 'fc7d2f5a' };
    const report = reportOf({ pullRequest });
    expect(report).toContain('- Pull request #1448: draft, mergeable state `unstable`');
    expect(report).toContain('its head is `fc7d2f5a`, not the local head. Push or pull first.');
  });

  it('leaves the head warning out when the pull request is at the local head', () => {
    const report = reportOf({
      pullRequest: { number: 7, draft: false, mergeableState: 'clean', headSha: HEAD.sha },
    });
    expect(report).toContain('- Pull request #7: ready, mergeable state `clean`');
    expect(report).not.toContain('not the local head');
  });
});
