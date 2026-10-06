/** Which commits a release's notes list, and how the notes read. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot.mjs';
import {
  RELEASE_INPUTS,
  parseCommitLog,
  parseTagMessage,
  releaseSources,
  renderReleaseNotes,
} from './releaseNotes.mjs';
import { RELEASE_PACKAGES } from './releaseVersion.mjs';

/** One record as `git log --format=%s%x1f%b%x1e` prints it. */
const logRecord = (subject, body = '') => `${subject}\x1f${body}\x1e\n`;

const feat = { type: 'feat', description: 'add a Scene Tree view (#591)', isBreaking: false };
const fix = { type: 'fix', description: 'stop at a scene that instances itself (#579)', isBreaking: false };

describe('releaseSources', () => {
  it('lists the package directory first, then the packages it bundles', () => {
    expect(releaseSources('linter-v1.1.1')).toEqual(['apps/textscene-linter', 'packages/textscene-core']);
  });

  it('includes the web previewer in the extension release, which ships its build', () => {
    expect(releaseSources('vscode-v1.2.0')).toContain('apps/textscene-web');
  });

  it('refuses a tag that names no released package', () => {
    expect(() => releaseSources('web-v1.0.0')).toThrow(
      'expected a release tag like vscode-v1.2.3, got "web-v1.0.0"'
    );
  });
});

describe('RELEASE_INPUTS', () => {
  it('names the inputs of every released package', () => {
    expect(Object.keys(RELEASE_INPUTS)).toEqual(Object.keys(RELEASE_PACKAGES));
  });

  it.each(Object.values(RELEASE_INPUTS).flat())('%s holds a package manifest', (directory) => {
    expect(existsSync(join(REPO_ROOT, directory, 'package.json'))).toBe(true);
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
  it('joins the subject and the body of an annotated tag', () => {
    expect(parseTagMessage('tag\x1fScene Tree release\x1fThe tree follows the preview.\n\n')).toBe(
      'Scene Tree release\n\nThe tree follows the preview.'
    );
  });

  it('reads a lightweight tag as no message', () => {
    expect(parseTagMessage('commit\x1fa commit subject\x1f\n')).toBe('');
  });

  it('reads a missing tag as no message', () => {
    expect(parseTagMessage('')).toBe('');
  });
});

describe('renderReleaseNotes', () => {
  const release = { highlights: '', commits: [fix, feat], previousTag: 'vscode-v1.1.0', compareUrl: '' };

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

  it('lists no commits on a first release, only the highlights', () => {
    expect(renderReleaseNotes({ ...release, previousTag: '', highlights: 'Hello.' })).toBe('Hello.');
  });

  it('falls back to a fixed line on a first release without highlights', () => {
    expect(renderReleaseNotes({ ...release, previousTag: '' })).toBe('First public release.');
  });
});
