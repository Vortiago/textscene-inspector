/** The parser test kit's path resolvers and its scene walk. */
import { describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { TscnParser } from '../TscnParser';
import { fixturesDir, flatten, repoRoot } from './parserKit';

describe('repoRoot', () => {
  it('finds the directory that holds pnpm-workspace.yaml', () => {
    expect(existsSync(resolve(repoRoot(), 'pnpm-workspace.yaml'))).toBe(true);
  });

  it('is the directory five levels above this kit, the answer a fixed derivation gives', () => {
    expect(repoRoot()).toBe(resolve(import.meta.dirname, '../../../../..'));
  });

  it('gives the same answer whatever the working directory is', () => {
    const fromHere = repoRoot();
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(tmpdir());
    try {
      expect(repoRoot()).toBe(fromHere);
    } finally {
      cwd.mockRestore();
    }
  });
});

describe('fixturesDir', () => {
  it('is the committed scenes/fixtures corpus under the repo root', () => {
    expect(fixturesDir()).toBe(resolve(repoRoot(), 'scenes/fixtures'));
    expect(basename(fixturesDir())).toBe('fixtures');
    expect(existsSync(fixturesDir())).toBe(true);
  });
});

describe('flatten', () => {
  const parse = (source: string) => new TscnParser().parse(`[gd_scene format=3]\n\n${source}`);

  it('lists every node depth first, each parent before its children', () => {
    const scene = parse(
      [
        '[node name="Root" type="Node3D"]',
        '[node name="A" type="Node3D" parent="."]',
        '[node name="A1" type="Node3D" parent="A"]',
        '[node name="B" type="Node3D" parent="."]',
      ].join('\n\n')
    );
    expect(flatten(scene).map((n) => n.name)).toEqual(['Root', 'A', 'A1', 'B']);
  });

  it('returns one node for a scene that is only a root', () => {
    expect(flatten(parse('[node name="Root" type="Node"]'))).toHaveLength(1);
  });

  it('returns no nodes for a scene without any', () => {
    expect(flatten(parse(''))).toEqual([]);
  });
});
