/**
 * The report `pnpm scope:issues` prints, built from the text GitHub gives for the issues.
 */

import { describe, expect, it } from 'vitest';
import { issueScopeCutsReport, parseIssues, unownedCutsOfIssues } from './issueScopeCuts.mjs';

const OWNED = {
  number: 1458,
  title: 'Port the fog',
  body: '**Out of scope:**\n- The froxel passes (#1783).',
};
const UNOWNED = {
  number: 1248,
  title: 'Agent tools in Cursor',
  body: 'Three tools.\n\n**Out of scope:**\n- An HTTP transport.\n- A tool for `.tres` files.',
};

describe('parseIssues', () => {
  it('reads each issue of a page of the issue list, and leaves a pull request out', () => {
    const pullRequest = {
      number: 1769,
      title: 'Port the light',
      body: '',
      pull_request: { url: 'https://example.test' },
    };
    const page = JSON.stringify([{ ...OWNED, state: 'open' }, pullRequest, UNOWNED]);

    expect(parseIssues(page)).toEqual([OWNED, UNOWNED]);
  });

  it('reads the one issue GitHub gives for an issue number', () => {
    expect(parseIssues(JSON.stringify(OWNED))).toEqual([OWNED]);
  });

  it('reads the body GitHub gives as null as an empty body (edge case)', () => {
    expect(parseIssues('{"number":7,"title":"Empty","body":null}')).toEqual([
      { number: 7, title: 'Empty', body: '' },
    ]);
  });
});

describe('unownedCutsOfIssues', () => {
  it('gives each issue that holds a cut with no owner, with its cuts', () => {
    expect(unownedCutsOfIssues([OWNED, UNOWNED])).toEqual([
      {
        number: 1248,
        title: 'Agent tools in Cursor',
        cuts: [
          { line: 4, text: '- An HTTP transport.' },
          { line: 5, text: '- A tool for `.tres` files.' },
        ],
      },
    ]);
  });
});

describe('issueScopeCutsReport', () => {
  it('counts the issues and quotes each cut below its issue', () => {
    expect(issueScopeCutsReport([OWNED, UNOWNED])).toBe(
      [
        '# Scope cuts with no owner',
        '',
        'Issues that hold a scope cut with no owner: 1 of 2.',
        '',
        '## #1248 Agent tools in Cursor (2)',
        '',
        '- `4` - An HTTP transport.',
        '- `5` - A tool for `.tres` files.',
        '',
      ].join('\n')
    );
  });

  it('says so when every cut has its owner', () => {
    expect(issueScopeCutsReport([OWNED])).toBe(
      '# Scope cuts with no owner\n\nIssues that hold a scope cut with no owner: 0 of 1.\n'
    );
  });
});
