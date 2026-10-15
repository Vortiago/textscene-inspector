/**
 * The isometric corpus is the closure of `dungeon.tscn`: every file its `ext_resource` paths reach,
 * with the sidecar of each.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { reachableFiles } from './reachableFiles.mjs';

const root = mkdtempSync(join(tmpdir(), 'reachable-files-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function write(rel, text) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

const extResource = (path) => `[ext_resource type="Resource" path="res://${path}" id="1"]\n`;

write('main.tscn', extResource('tiles/set.tres') + extResource('player/player.tscn'));
write('tiles/set.tres', extResource('tiles/atlas.png'));
write('tiles/atlas.png', 'PNG');
write('tiles/atlas.png.import', '[remap]\n');
write('tiles/editor.tscn', extResource('tiles/set.tres'));
write('player/player.tscn', extResource('main.tscn') + extResource('player/player.gd'));
write('player/player.gd', 'extends Node2D\n');
write('project.godot', '[application]\n');
write('broken.tscn', extResource('gone.png'));

describe('reachableFiles', () => {
  it('follows ext_resource paths through scenes and resources, with their sidecars', () => {
    expect(reachableFiles(root, 'main.tscn')).toEqual([
      'main.tscn',
      'player/player.gd',
      'player/player.tscn',
      'tiles/atlas.png',
      'tiles/atlas.png.import',
      'tiles/set.tres',
    ]);
  });

  it('visits a scene once when two scenes reference each other (edge case)', () => {
    expect(reachableFiles(root, 'player/player.tscn').filter((f) => f === 'main.tscn')).toEqual([
      'main.tscn',
    ]);
  });

  it('names the referencing file when a path reaches no file', () => {
    expect(() => reachableFiles(root, 'broken.tscn')).toThrow(
      'broken.tscn references res://gone.png, which is not in the checkout'
    );
  });
});
