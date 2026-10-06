/** Which commits a release's notes list, and how the notes read. */
import { describe, expect, it } from 'vitest';
import { parseCommitLog, parseTagMessage, releaseSources, renderReleaseNotes } from './releaseNotes.mjs';

/** One record as `git log --format=%s%x1f%b%x1e` prints it. */
const logRecord = (subject, body = '') => `${subject}\x1f${body}\x1e\n`;

const feat = { type: 'feat', description: 'add a Scene Tree view (#591)', isBreaking: false };
const fix = { type: 'fix', description: 'stop at a scene that instances itself (#579)', isBreaking: false };

describe('releaseSources', () => {
  it('lists the package directory first, then the packages it bundles', () => {
    expect(releaseSources('linter')).toEqual(['apps/textscene-linter', 'packages/textscene-core']);
  });

  it('includes the web previewer in the extension release, which ships its build', () => {
    expect(releaseSources('vscode')).toContain('apps/textscene-web');
  });
});

describe('parseCommitLog', () => {
  it('reads the type and the description without the scope', () => {
    expect(parseCommitLog(logRecord('fix(core): stop at a scene that instances itself (#579)'))).toEqual([
      fix,
    ]);
  });

  it('marks a header with an exclamation mark as breaking', () => {
    expect(parseCommitLog(logRecord('feat(linter)!: drop the --json flag'))).toEqual([
      { type: 'feat', description: 'drop the --json flag', isBreaking: true },
    ]);
  });

  it('marks a commit with a BREAKING CHANGE footer as breaking', () => {
    const [commit] = parseCommitLog(
      logRecord('fix: rename the rule', 'Body.\n\nBREAKING CHANGE: the old name is gone')
    );

    expect(commit.isBreaking).toBe(true);
  });

  it('keeps the commits in log order across a multi-line body', () => {
    const log =
      logRecord('feat: add a Scene Tree view (#591)', 'Line one.\nLine two.\n') + logRecord('fix: x');

    expect(parseCommitLog(log).map((commit) => commit.type)).toEqual(['feat', 'fix']);
  });

  it('skips a commit in a repository tooling scope', () => {
    expect(parseCommitLog(logRecord('perf(githooks): check core once on push (#601)'))).toEqual([]);
  });

  it('skips a header that is not a Conventional Commit', () => {
    expect(parseCommitLog(logRecord('Merge branch main'))).toEqual([]);
  });

  it('reads an empty log as no commits', () => {
    expect(parseCommitLog('')).toEqual([]);
  });
});

describe('parseTagMessage', () => {
  it('reads the message of an annotated tag', () => {
    expect(parseTagMessage('tag\x1fScene Tree release\n\nThe tree follows the preview.\n\n\n')).toBe(
      'Scene Tree release\n\nThe tree follows the preview.'
    );
  });

  it('reads a lightweight tag as no message', () => {
    expect(parseTagMessage('commit\x1fa commit subject\n\n\n')).toBe('');
  });

  it('reads a missing tag as no message', () => {
    expect(parseTagMessage('')).toBe('');
  });
});

describe('renderReleaseNotes', () => {
  const release = { highlights: '', commits: [fix, feat], compareUrl: '' };

  it('groups the commits under their sections, in section order', () => {
    expect(renderReleaseNotes(release)).toBe(
      '## Features\n\n- add a Scene Tree view (#591)\n\n## Fixes\n\n- stop at a scene that instances itself (#579)'
    );
  });

  it('puts the highlights first and the changelog link last', () => {
    const notes = renderReleaseNotes({
      ...release,
      highlights: 'Highlights.',
      compareUrl: 'https://x/compare',
    });

    expect(notes).toMatch(/^Highlights\.\n\n## Features[\s\S]*\*\*Full changelog\*\*: https:\/\/x\/compare$/);
  });

  it('lists a breaking commit under breaking changes as well as its type', () => {
    const notes = renderReleaseNotes({ ...release, commits: [{ ...feat, isBreaking: true }] });

    expect(notes).toMatch(/^## Breaking changes\n\n- add a Scene Tree view \(#591\)\n\n## Features/);
  });

  it('says so when no commit is user-facing', () => {
    expect(renderReleaseNotes({ ...release, commits: [] })).toBe('No user-facing changes.');
  });
});
