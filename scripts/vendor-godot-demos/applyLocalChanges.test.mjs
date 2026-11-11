/**
 * The local changes to a godot-demo-projects checkout: a text copy replaces each binary scene,
 * and a patch edits the upstream files.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gitEnvironmentFor } from '../vendor-git.mjs';
import { applyLocalChanges } from './applyLocalChanges.mjs';

let changes;
let checkout;

function write(root, rel, text) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

/** Seeds `root` as the checkout every case starts from: one scene that points at one binary scene. */
function seedCheckout(root) {
  write(
    root,
    '3d/demo/main.tscn',
    '[gd_scene format=3]\n[ext_resource type="PackedScene" path="res://grid.scn" id="1"]\n'
  );
  write(root, '3d/demo/grid.scn', 'RSRC');
}

/** In the form `git diff` writes, as the real patch is: git reads the header's path against a repository. */
const SCENE_PATCH = `diff --git a/3d/demo/main.tscn b/3d/demo/main.tscn
--- a/3d/demo/main.tscn
+++ b/3d/demo/main.tscn
@@ -1,2 +1,2 @@
 [gd_scene format=3]
-[ext_resource type="PackedScene" path="res://grid.scn" id="1"]
+[ext_resource type="PackedScene" path="res://grid.tscn" id="1"]
`;

beforeEach(() => {
  changes = mkdtempSync(join(tmpdir(), 'local-changes-'));
  checkout = mkdtempSync(join(tmpdir(), 'demo-checkout-'));
  seedCheckout(checkout);
  write(changes, 'text-resources/3d/demo/grid.tscn', '[gd_scene format=3]\n');
  write(changes, 'local-changes.patch', SCENE_PATCH);
});

afterEach(() => {
  rmSync(changes, { recursive: true, force: true });
  rmSync(checkout, { recursive: true, force: true });
});

describe('applyLocalChanges', () => {
  it('replaces a binary scene with its text copy', () => {
    applyLocalChanges(changes, checkout);
    expect(existsSync(join(checkout, '3d/demo/grid.scn'))).toBe(false);
    expect(readFileSync(join(checkout, '3d/demo/grid.tscn'), 'utf8')).toBe('[gd_scene format=3]\n');
  });

  it('applies the patch to the upstream files', () => {
    applyLocalChanges(changes, checkout);
    expect(readFileSync(join(checkout, '3d/demo/main.tscn'), 'utf8')).toContain('path="res://grid.tscn"');
  });

  describe('in a checkout inside another git repository', () => {
    let repository;
    let nested;

    beforeEach(() => {
      repository = mkdtempSync(join(tmpdir(), 'enclosing-repository-'));
      // Under a hook's `GIT_DIR`, a bare `git init` reinitialises the hook's repository and makes none here.
      execFileSync('git', ['init', '-q', repository], { env: gitEnvironmentFor(repository) });
      nested = join(repository, 'work/godot-demo-projects');
      seedCheckout(nested);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      rmSync(repository, { recursive: true, force: true });
    });

    it('applies the patch to the checkout (edge case)', () => {
      applyLocalChanges(changes, nested);
      expect(readFileSync(join(nested, '3d/demo/main.tscn'), 'utf8')).toContain('path="res://grid.tscn"');
    });

    it('applies the patch when a git hook points git at that repository (edge case)', () => {
      vi.stubEnv('GIT_DIR', join(repository, '.git'));
      vi.stubEnv('GIT_WORK_TREE', repository);
      applyLocalChanges(changes, nested);
      expect(readFileSync(join(nested, '3d/demo/main.tscn'), 'utf8')).toContain('path="res://grid.tscn"');
    });
  });

  it('refuses a text copy that replaces no binary resource', () => {
    write(changes, 'text-resources/3d/demo/navmesh.tres', '[gd_resource format=3]\n');
    expect(() => applyLocalChanges(changes, checkout)).toThrow(
      'expected one binary resource beside 3d/demo/navmesh.tres in the checkout, found 0'
    );
  });

  it('names the patch when it does not apply to the checkout (edge case)', () => {
    write(checkout, '3d/demo/main.tscn', '[gd_scene format=3]\n[node name="Moved upstream"]\n');
    expect(() => applyLocalChanges(changes, checkout)).toThrow(/local-changes\.patch does not apply/);
  });
});
