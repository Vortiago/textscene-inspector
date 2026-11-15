/**
 * The report `pnpm pr:state` prints, built from git's text alone. Each case gives the text git
 * prints and reads the section of the report it decides.
 */

import { describe, expect, it } from 'vitest';
import {
  closedIssueNumbers,
  parseCheckRuns,
  parsePullRequest,
  prStateReport,
  unownedLimitLines,
  unownedScopeCutsOf,
} from './prState.mjs';

const HEAD = { sha: '55a649fd0000000000000000000000000000beef', branch: 'claude/y-sort' };
const SHEET = 'packages/textscene-core/src/nodes/control/comparison.md';
const BASE = { ref: 'origin/main', sha: '97c833d0000000000000000000000000000cafe' };

/** A report over `change`, with a head and a base that no case reads unless it names them. */
function reportOf(change) {
  return prStateReport({
    head: HEAD,
    base: BASE,
    nameStatus: '',
    diff: '',
    documents: [],
    unkeptTestOnlyExports: [],
    ...change,
  });
}

/** A pull request at the local head and on the local base, so no case reads a warning unless it names another. */
function pullRequestWith(fields = {}) {
  return {
    number: 7,
    draft: true,
    mergeableState: 'clean',
    headSha: HEAD.sha,
    baseBranch: 'main',
    body: '',
    checks: [],
    closedIssues: [],
    ...fields,
  };
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

  it('quotes a comment that names a fallback, and no code that uses the word (edge case)', () => {
    const report = reportOf({
      diff: additions('packages/textscene-core/src/r3f/ySort.ts', 7, [
        '// Fallback until the nested sort lands: scene order.',
        'const fallbackFont = theme.fallback;',
        'this.#fallback = font;',
      ]),
    });
    expect(report).toContain('ySort.ts:7` // Fallback until the nested sort lands: scene order.');
    expect(report).not.toContain('fallbackFont');
    expect(report).not.toContain('#fallback');
  });

  it('quotes a document line that names a fallback or says what stays in place', () => {
    const report = reportOf({
      diff: additions('packages/textscene-core/src/nodes/control/comparison.md', 12, [
        'Fallback: the box draws flat.',
        'A Control-only viewport stays in scene order.',
      ]),
    });
    expect(report).toContain('comparison.md:12` Fallback: the box draws flat.');
    expect(report).toContain('comparison.md:13` A Control-only viewport stays in scene order.');
  });

  it('quotes no code line that holds a phrase of a document (edge case)', () => {
    const report = reportOf({ diff: additions('a.ts', 1, ['// The cursor stays in the row.']) });
    expect(report).toContain('## Added lines that defer work or record a limit (0)');
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

  it('reads an added line that starts with "++ " as a line, not as a file header (edge case)', () => {
    const report = reportOf({ diff: additions('notes.md', 3, ['++ b/other.md', '// TODO: after the list']) });
    expect(report).toContain('- `notes.md:4` // TODO: after the list');
  });

  it('counts a context line of a diff with context (edge case)', () => {
    const diff = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -3,2 +3,3 @@',
      ' const a = 1;',
      '+// FIXME between',
      ' const b = 2;',
    ].join('\n');
    expect(reportOf({ diff })).toContain('- `a.ts:4` // FIXME between');
  });

  it('says when the working tree has uncommitted changes, and not when it is clean', () => {
    expect(reportOf({ hasUncommittedChanges: true })).toContain(
      '- The working tree has uncommitted changes.'
    );
    expect(reportOf({})).not.toContain('uncommitted changes');
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
    const report = reportOf({
      pullRequest: pullRequestWith({ number: 1448, mergeableState: 'unstable', headSha: 'fc7d2f5a' }),
    });
    expect(report).toContain('- Pull request #1448: draft, mergeable state `unstable`');
    expect(report).toContain('Its head is `fc7d2f5a`, not the local head. Push or pull first.');
  });

  it('leaves the head warning out when the pull request is at the local head', () => {
    const report = reportOf({ pullRequest: pullRequestWith({ draft: false }) });
    expect(report).toContain('- Pull request #7: ready, mergeable state `clean`');
    expect(report).not.toContain('not the local head');
  });

  it('says when the pull request has another base than the report (error path)', () => {
    const report = reportOf({ pullRequest: pullRequestWith({ baseBranch: 'feature/tsl' }) });
    expect(report).toContain(
      '- Its base is `feature/tsl`, not `origin/main`. Pass `--base origin/feature/tsl`.'
    );
    expect(reportOf({ pullRequest: pullRequestWith() })).not.toContain('Its base is');
  });

  it('counts the checks of the pull request head by result, and lists each that has not passed', () => {
    const checks = [
      { name: 'CI passed', result: 'in_progress' },
      { name: 'Unit tests (1/4)', result: 'success' },
      { name: 'Unit tests (2/4)', result: 'failure' },
      { name: 'Unit tests (3/4)', result: 'success' },
      { name: 'Visual regression (1/12)', result: 'skipped' },
    ];
    const report = reportOf({ pullRequest: pullRequestWith({ checks }) });
    expect(report).toContain('- Checks on its head: 1 in_progress, 2 success, 1 failure, 1 skipped');
    expect(report).toContain(
      ['## Checks not passed (2)', '', '- `CI passed`: in_progress', '- `Unit tests (2/4)`: failure'].join(
        '\n'
      )
    );
  });

  it('says when the pull request head has no check (edge case)', () => {
    const report = reportOf({ pullRequest: pullRequestWith() });
    expect(report).toContain('- Checks on its head: none');
    expect(report).toContain('## Checks not passed (0)\n\nNone.');
  });

  it('lists a limit line whose file the pull request body gives no owner (error path)', () => {
    const report = reportOf({
      diff: additions(SHEET, 12, ['- Known limitation: a Control-only viewport stays in scene order.']),
      pullRequest: pullRequestWith({ body: 'Sorts Controls by y.' }),
    });
    expect(report).toContain(
      [
        '## Limit lines with no owner in the pull request body (1)',
        '',
        '- `packages/textscene-core/src/nodes/control/comparison.md:12` - Known limitation: a Control-only viewport stays in scene order.',
      ].join('\n')
    );
  });

  it('lists a scope cut of the pull request body that names no owner (error path)', () => {
    const pullRequest = pullRequestWith({ body: 'The sky bake is a follow-up.' });

    expect(reportOf({ pullRequest })).toContain(
      '## Scope cuts with no owner (1)\n\n- `the pull request body:1` The sky bake is a follow-up.\n'
    );
  });

  it('leaves the owner sections out of a report with no pull request', () => {
    const report = reportOf({ diff: additions(SHEET, 12, ['- Approximated: the shadow penumbra.']) });
    expect(report).not.toContain('Limit lines with no owner');
    expect(report).not.toContain('Checks');
  });
});

describe('unownedLimitLines', () => {
  const diff = additions(SHEET, 12, ['- Approximated: the shadow penumbra.', '- The Label draws its text.']);
  const unownedWith = (body) => unownedLimitLines({ diff, pullRequest: pullRequestWith({ body }) });

  it('gives each added limit line when the body names no file', () => {
    expect(unownedWith('Sorts Controls by y.')).toEqual([
      { path: SHEET, line: 12, text: '- Approximated: the shadow penumbra.' },
    ]);
  });

  it('takes an issue number beside the file name as the owner', () => {
    expect(unownedWith('- `control/comparison.md`: the penumbra is approximated. Owner #1444.')).toEqual([]);
  });

  it('takes the words "no issue" beside the file name as the reason for no owner', () => {
    expect(unownedWith('- `control/comparison.md`: glyph edge polish, no issue.')).toEqual([]);
  });

  it('takes no owner from a line that names the file alone (edge case)', () => {
    expect(unownedWith('- `control/comparison.md`: the penumbra is approximated.')).toHaveLength(1);
  });

  it('takes no owner from a line that names another sheet (edge case)', () => {
    expect(unownedWith('- `label/comparison.md`: glyph edges. Owner #1442.')).toHaveLength(1);
  });

  it('takes no owner from a sheet whose directory name ends on the directory of the file (edge case)', () => {
    expect(unownedWith('- `rangecontrol/comparison.md`: the grabber. Owner #1442.')).toHaveLength(1);
  });

  it('takes the whole path of the file as its name', () => {
    expect(unownedWith(`- ${SHEET}: the penumbra is approximated. Owner #1444.`)).toEqual([]);
  });

  it('takes the file name that ends a sentence', () => {
    expect(unownedWith('Owner #1444 has the penumbra of control/comparison.md.')).toEqual([]);
  });

  it('takes the link of an issue beside the file name as the owner', () => {
    const body = '- `control/comparison.md`: https://github.com/godot/sheets/issues/1444';
    expect(unownedWith(body)).toEqual([]);
  });

  it('takes no owner for a file at the root from a file of that name in a directory (edge case)', () => {
    const rootDiff = additions('REVIEW.md', 3, ['Not supported: a review of a binary file.']);
    const body = '`docs/REVIEW.md`: the workflow fetches no binary patch, no issue.';
    expect(unownedLimitLines({ diff: rootDiff, pullRequest: pullRequestWith({ body }) })).toHaveLength(1);
  });

  it('takes the file name alone for a file at the root', () => {
    const rootDiff = additions('REVIEW.md', 3, ['Not supported: a review of a binary file.']);
    const body = '`REVIEW.md`: the workflow fetches no binary patch, no issue.';
    expect(unownedLimitLines({ diff: rootDiff, pullRequest: pullRequestWith({ body }) })).toEqual([]);
  });

  it('gives a comment that records a limit, and no code that holds the same words (edge case)', () => {
    const codeDiff = additions('a.ts', 1, [
      '// Not supported: a nested sort.',
      "throw new Error('unsupported format');",
    ]);
    expect(unownedLimitLines({ diff: codeDiff, pullRequest: pullRequestWith() })).toEqual([
      { path: 'a.ts', line: 1, text: '// Not supported: a nested sort.' },
    ]);
  });

  it('gives no line that only defers work (edge case)', () => {
    const todoDiff = additions('a.ts', 1, ['// TODO: merge the nested sort']);
    expect(unownedLimitLines({ diff: todoDiff, pullRequest: pullRequestWith() })).toEqual([]);
  });
});

describe('unownedScopeCutsOf', () => {
  const ADR = 'docs/adr/0072-shaders.md';
  const ADR_TEXT = [
    '# Shaders',
    '',
    '## Out of scope',
    '',
    '- The sky bake (#1775).',
    '- The fog passes.',
  ].join('\n');
  const cutsWith = (change) =>
    unownedScopeCutsOf({ diff: '', documents: [], pullRequest: pullRequestWith(), ...change });

  it('gives a cut of the body that names no issue', () => {
    const pullRequest = pullRequestWith({
      body: '## Out of scope\n\n- The fog passes.\n- The sky bake (#1775).',
    });

    expect(cutsWith({ pullRequest })).toEqual([
      { where: 'the pull request body', line: 3, text: '- The fog passes.' },
    ]);
  });

  it('gives a cut that the change adds to a document, read with the list it stands in', () => {
    const change = {
      diff: additions(ADR, 6, ['- The fog passes.']),
      documents: [{ path: ADR, text: ADR_TEXT }],
    };

    expect(cutsWith(change)).toEqual([{ where: ADR, line: 6, text: '- The fog passes.' }]);
  });

  it('gives no cut of a document that the change did not add (edge case)', () => {
    const change = { diff: additions(ADR, 1, ['# Shaders']), documents: [{ path: ADR, text: ADR_TEXT }] };

    expect(cutsWith(change)).toEqual([]);
  });

  it('gives no cut of a sheet, whose limit lines take their owner from the body (edge case)', () => {
    const text = 'The caret blink is deferred.';
    const change = { diff: additions(SHEET, 1, [text]), documents: [{ path: SHEET, text }] };

    expect(cutsWith(change)).toEqual([]);
  });

  it('gives a cut of an issue the pull request closes, since the issue ends with the cut still open', () => {
    const closedIssues = [
      { number: 1457, body: '**Out of scope:**\n- The prepass: it is a whole program and stays.' },
    ];

    expect(cutsWith({ pullRequest: pullRequestWith({ closedIssues }) })).toEqual([
      { where: 'issue #1457', line: 2, text: '- The prepass: it is a whole program and stays.' },
    ]);
  });

  it('gives no cut for a body, a document and an issue that name each owner', () => {
    const pullRequest = pullRequestWith({
      body: 'The sky bake is a follow-up (#1775).',
      closedIssues: [{ number: 1457, body: '**Out of scope:**\n- The prepass (#1782).' }],
    });

    expect(cutsWith({ pullRequest })).toEqual([]);
  });
});

describe('closedIssueNumbers', () => {
  it('reads each issue a body closes, once, in any of the words GitHub takes', () => {
    const body = 'Closes #1511. Fixes #1515 and resolves #1516.\n\nPart of #1436. closes #1511';

    expect(closedIssueNumbers(body)).toEqual([1511, 1515, 1516]);
  });

  it('reads no issue from a body that closes none (edge case)', () => {
    expect(closedIssueNumbers('Part of #1436. See #1511.')).toEqual([]);
  });
});

describe('parsePullRequest', () => {
  it('reads the draft state, the merge state, the head and the body of a GitHub pull request', () => {
    const json = JSON.stringify({
      number: 1448,
      draft: true,
      mergeable_state: 'unstable',
      head: { sha: 'fc7d2f5a' },
      base: { ref: 'main' },
      body: 'Sorts Controls by y.',
    });
    expect(parsePullRequest(json)).toEqual({
      number: 1448,
      draft: true,
      mergeableState: 'unstable',
      headSha: 'fc7d2f5a',
      baseBranch: 'main',
      body: 'Sorts Controls by y.',
    });
  });

  it('reads the body GitHub gives as null as an empty body (edge case)', () => {
    const json = JSON.stringify({
      number: 7,
      draft: false,
      mergeable_state: 'clean',
      head: { sha: 'a' },
      base: { ref: 'main' },
      body: null,
    });
    expect(parsePullRequest(json).body).toBe('');
  });
});

describe('parseCheckRuns', () => {
  it('reads the name and the result of each check, one tab-separated line for each run', () => {
    const tsv =
      'CI passed\tsuccess\t2026-11-13T01:20:00Z\nUnit tests (2/4)\tin_progress\t2026-11-13T01:21:00Z\n';
    expect(parseCheckRuns(tsv)).toEqual([
      { name: 'CI passed', result: 'success' },
      { name: 'Unit tests (2/4)', result: 'in_progress' },
    ]);
  });

  it('keeps the latest run of a check that ran more than once', () => {
    const tsv = [
      'Review\tsuccess\t2026-11-13T01:25:00Z',
      'Review\tskipped\t2026-11-13T01:20:00Z',
      'Unit tests (1/4)\tfailure\t2026-11-13T01:20:00Z',
      'Unit tests (1/4)\tsuccess\t2026-11-13T01:40:00Z',
    ].join('\n');
    expect(parseCheckRuns(tsv)).toEqual([
      { name: 'Review', result: 'success' },
      { name: 'Unit tests (1/4)', result: 'success' },
    ]);
  });

  it('reads no check from an empty answer (edge case)', () => {
    expect(parseCheckRuns('')).toEqual([]);
  });
});
