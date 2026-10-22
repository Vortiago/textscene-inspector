import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { packTarball } from './packTarball.mjs';

describe('packTarball', () => {
  const root = mkdtempSync(join(tmpdir(), 'pack-tarball-'));
  afterAll(() => rmSync(root, { recursive: true }));

  it('returns the path of the tarball it wrote into the destination', () => {
    const packageDir = join(root, 'pkg');
    const destination = join(root, 'out');
    mkdirSync(packageDir);
    mkdirSync(destination);
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ name: 'sample', version: '1.2.3' }));

    expect(packTarball(packageDir, destination)).toBe(join(destination, 'sample-1.2.3.tgz'));
  });
});
