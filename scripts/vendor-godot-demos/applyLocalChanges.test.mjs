/**
 * The local changes to a godot-demo-projects checkout: a text copy replaces each binary scene,
 * and a patch edits the upstream files.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { applyLocalChanges } from './applyLocalChanges.mjs';

let changes;
let checkout;

function write(root, rel, text) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

const SCENE_PATCH = `--- a/3d/demo/main.tscn
+++ b/3d/demo/main.tscn
@@ -1,2 +1,2 @@
 [gd_scene format=3]
-[ext_resource type="PackedScene" path="res://grid.scn" id="1"]
+[ext_resource type="PackedScene" path="res://grid.tscn" id="1"]
`;

beforeEach(() => {
  changes = mkdtempSync(join(tmpdir(), 'local-changes-'));
  checkout = mkdtempSync(join(tmpdir(), 'demo-checkout-'));
  write(
    checkout,
    '3d/demo/main.tscn',
    '[gd_scene format=3]\n[ext_resource type="PackedScene" path="res://grid.scn" id="1"]\n'
  );
  write(checkout, '3d/demo/grid.scn', 'RSRC');
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
