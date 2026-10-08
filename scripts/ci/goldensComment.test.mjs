/** The "Goldens touched" comment a pull request gets for the baselines it changes. */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot.mjs';
import { BASELINE_DIR, baselinePath } from '../visual/baselinePath.mjs';
import { GOLDENS_COMMENT_MARKER, goldensComment } from './goldensComment.mjs';

const SCENES = [{ name: 'glow-mix', file: 'unit-glow-mix.tscn' }];
const PULL_REQUEST = {
  repository: 'Vortiago/textscene-inspector',
  number: 640,
  branch: 'claude/issue-351-visibility',
};

describe('goldensComment', () => {
  it('links a changed golden to its image diff, the preview of the branch and main', () => {
    const comment = goldensComment(nameStatus('M', 'glow-mix'), SCENES, PULL_REQUEST);

    expect(comment).toContain(
      '| `glow-mix` | changed | ' +
        '[diff](https://github.com/Vortiago/textscene-inspector/pull/640/files#diff-6105044e0e659c3f0d07ae9a4c4cdc265d5c8448b434f39b764a28e18229f415) | ' +
        '[preview](https://claude-issue-351-visibility.textscene-inspector.pages.dev/?fixture=unit-glow-mix.tscn) | ' +
        '[main](https://textscene-inspector.pages.dev/?fixture=unit-glow-mix.tscn) |'
    );
  });

  it('writes nothing when no baseline changed', () => {
    const changes = 'M\tpackages/textscene-core/src/r3f/TscnCanvas.tsx\nM\tscripts/visual/scenes.mjs\n';

    expect(goldensComment(changes, SCENES, PULL_REQUEST)).toBeNull();
  });

  it('links an added golden to the preview of the branch only, since main has no such scene', () => {
    const comment = goldensComment(nameStatus('A', 'glow-mix'), SCENES, PULL_REQUEST);

    expect(comment).toMatch(/\| `glow-mix` \| added \| \[diff\]\(.+\) \| \[preview\]\(.+\) \| {2}\|/);
  });

  it('links a removed golden to its image diff only, since the branch drops its scene', () => {
    const comment = goldensComment(nameStatus('D', 'sprite-old'), SCENES, PULL_REQUEST);

    expect(comment).toMatch(/\| `sprite-old` \| removed \| \[diff\]\(.+\) \| {2}\| {2}\|/);
  });

  it('counts a type change as a changed golden', () => {
    const comment = goldensComment(nameStatus('T', 'glow-mix'), SCENES, PULL_REQUEST);

    expect(comment).toContain('| `glow-mix` | changed | ');
  });

  it('cuts the preview host to the 28 characters Cloudflare Pages keeps of the branch', () => {
    const pullRequest = { ...PULL_REQUEST, branch: 'claude/pr-goldens-touched-fqk1vj' };

    const comment = goldensComment(nameStatus('M', 'glow-mix'), SCENES, pullRequest);

    expect(comment).toContain('https://claude-pr-goldens-touched-fq.textscene-inspector.pages.dev/');
  });

  it('drops a hyphen the cut leaves at the end of the preview host', () => {
    const pullRequest = { ...PULL_REQUEST, branch: 'claude/pr-goldens-touched-f/x' };

    const comment = goldensComment(nameStatus('M', 'glow-mix'), SCENES, pullRequest);

    expect(comment).toContain('https://claude-pr-goldens-touched-f.textscene-inspector.pages.dev/');
  });

  it('opens with the marker that finds the comment again on the next push', () => {
    const comment = goldensComment(nameStatus('M', 'glow-mix'), SCENES, PULL_REQUEST);

    expect(comment.split('\n')[0]).toBe(GOLDENS_COMMENT_MARKER);
  });

  it('matches the marker the workflow searches for', () => {
    const workflow = readFileSync(resolve(REPO_ROOT, '.github/workflows/goldens-comment.yml'), 'utf8');

    expect(workflow).toContain(`startswith("${GOLDENS_COMMENT_MARKER}")`);
  });

  it('shows up to ten goldens open', () => {
    const comment = goldensComment(changedGoldens(10), SCENES, PULL_REQUEST);

    expect(comment).not.toContain('<details>');
  });

  it('folds more than ten goldens under a count of each kind of change', () => {
    const changes = changedGoldens(10) + nameStatus('A', 'glow-new');

    const comment = goldensComment(changes, SCENES, PULL_REQUEST);

    expect(comment).toContain('<details><summary>11 goldens: 1 added, 10 changed</summary>');
  });

  it('recognises every committed baseline, so a moved directory fails here and not silently', () => {
    const baselines = readdirSync(resolve(REPO_ROOT, BASELINE_DIR));
    const changes = baselines.map((file) => nameStatus('M', file.replace(/\.png$/, ''))).join('');

    const comment = goldensComment(changes, SCENES, PULL_REQUEST);

    expect(comment).toContain(`<summary>${baselines.length} goldens: ${baselines.length} changed</summary>`);
  });
});

function nameStatus(status, golden) {
  return `${status}\t${baselinePath(golden)}\n`;
}

function changedGoldens(count) {
  return Array.from({ length: count }, (_, i) => nameStatus('M', `golden-${i}`)).join('');
}
