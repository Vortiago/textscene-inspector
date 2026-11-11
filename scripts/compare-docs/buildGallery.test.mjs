/** The gallery build's `--check`: the gallery is generated, so `--check` proves it builds. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BUILD_GALLERY = new URL('./build-gallery.mjs', import.meta.url).pathname;

describe('build-gallery --check', () => {
  it('passes with no gallery on disk and writes none', () => {
    const absent = join(tmpdir(), `gallery-check-absent-${process.pid}.html`);

    const run = spawnSync(process.execPath, [BUILD_GALLERY, '--check', '--out', absent], {
      encoding: 'utf8',
    });

    expect(run.stderr).not.toContain('STALE');
    expect(run.status).toBe(0);
    expect(existsSync(absent)).toBe(false);
  });
});
